"""JWT-Ausstellung/-Pruefung + serverseitiges Hashing des Client-AuthHash.

Zero-Knowledge-Login: Der Client leitet aus dem Master-Passwort einen AuthHash
ab und schickt NUR diesen. Wir legen davon einen langsamen Argon2-Hash ab. Selbst
bei DB-Diebstahl ist daraus weder Passwort noch VaultKey rekonstruierbar.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .config import get_settings
from .db import get_session

_ph = PasswordHasher()
_bearer = HTTPBearer(auto_error=True)
# Oeffentlicher Alias fuer Router, die das Bearer-Token direkt brauchen (z. B. /logout).
bearer_scheme = _bearer

# JWT-Decode akzeptiert NUR diese (symmetrischen) Algorithmen — hart verdrahtet,
# damit weder "none" noch ein asymmetrischer Confusion-Trick je greifen kann.
_ALLOWED_DECODE_ALGS = ["HS256", "HS384", "HS512"]

# Konstanter Dummy-Hash. Bei unbekannter E-Mail verifizieren wir dagegen, damit
# die Antwortzeit dieselbe ist wie bei existierenden Accounts (kein Timing-Orakel,
# das "Konto existiert nicht" verraten wuerde).
_DUMMY_HASH = _ph.hash("anti-timing-dummy-constant")


def _derive_subkey(purpose: str) -> bytes:
    """Zweckgebundener Teilschluessel aus dem Master-Secret (Key-Separation).

    So fuehrt das Bekanntwerden eines abgeleiteten Schluessels (z. B. fuer den
    Pseudo-Salt) nicht direkt zum JWT-Signaturschluessel.
    """
    secret = get_settings().secret.encode("utf-8")
    return hmac.new(secret, purpose.encode("utf-8"), hashlib.sha256).digest()


def hash_auth(client_auth_hash: str) -> str:
    """Langsamer Server-Hash des (hochentropischen) Client-AuthHash."""
    return _ph.hash(client_auth_hash)


def verify_auth(stored: str | None, client_auth_hash: str) -> bool:
    """Verifiziert den AuthHash. Laeuft auch bei unbekanntem Account (stored=None)
    die volle Argon2-Pruefung gegen einen Dummy-Hash, um Timing-Leaks zu vermeiden.
    """
    target = stored if stored is not None else _DUMMY_HASH
    try:
        ok = _ph.verify(target, client_auth_hash)
        return ok and stored is not None
    except VerifyMismatchError:
        return False
    except Exception:  # pragma: no cover - defensiv (korrupter Hash)
        return False


def pseudo_salt(email: str) -> str:
    """Deterministischer Fake-Salt fuer unbekannte E-Mails (Anti-Enumeration).

    Liefert fuer nicht existierende Accounts einen stabilen, aber gefaelschten
    Salt, damit /prelogin nicht verraet, ob ein Account existiert. Schluessel ist
    ein zweckgebundener Teilschluessel (NICHT der JWT-Signaturschluessel selbst).
    Laenge entspricht echten Salts (16 Byte -> 24 base64-Zeichen).
    """
    digest = hmac.new(
        _derive_subkey("prelogin-pseudo-salt"),
        email.strip().lower().encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest[:16]).decode("ascii")


def create_access_token(user_id: int) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=s.jwt_expire_minutes)).timestamp()),
        # Eindeutige Token-ID, damit einzelne Tokens via /logout widerrufbar sind.
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, s.secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Dekodiert + validiert ein JWT (Signatur, Algorithmus, Ablauf). Wirft bei
    ungueltig. Prueft NICHT die Blocklist — dafuer get_current_user_id."""
    s = get_settings()
    return jwt.decode(token, s.secret, algorithms=_ALLOWED_DECODE_ALGS)


def _is_revoked(session: Session, jti: str) -> bool:
    from ..models import RevokedToken

    return session.exec(select(RevokedToken).where(RevokedToken.jti == jti)).first() is not None


def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    session: Session = Depends(get_session),
) -> int:
    try:
        payload = decode_token(creds.credentials)
        jti = payload.get("jti")
        if jti and _is_revoked(session, jti):
            raise ValueError("token revoked")
        return int(payload["sub"])
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungueltiges oder abgelaufenes Token",
        ) from exc


def get_current_user(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    from ..models import User

    user = session.exec(select(User).where(User.id == user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unbekannter Nutzer")
    return user
