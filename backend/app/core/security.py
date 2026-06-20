"""JWT-Ausstellung/-Pruefung + serverseitiges Hashing des Client-AuthHash.

Zero-Knowledge-Login: Der Client leitet aus dem Master-Passwort einen AuthHash
ab und schickt NUR diesen. Wir legen davon einen langsamen Argon2-Hash ab. Selbst
bei DB-Diebstahl ist daraus weder Passwort noch VaultKey rekonstruierbar.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
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


def hash_auth(client_auth_hash: str) -> str:
    """Langsamer Server-Hash des (hochentropischen) Client-AuthHash."""
    return _ph.hash(client_auth_hash)


def verify_auth(stored: str, client_auth_hash: str) -> bool:
    try:
        return _ph.verify(stored, client_auth_hash)
    except VerifyMismatchError:
        return False
    except Exception:  # pragma: no cover - defensiv (korrupter Hash)
        return False


def pseudo_salt(email: str) -> str:
    """Deterministischer Fake-Salt fuer unbekannte E-Mails (Anti-Enumeration).

    Liefert fuer nicht existierende Accounts einen stabilen, aber gefaelschten
    Salt, damit /prelogin nicht verraet, ob ein Account existiert.
    """
    secret = get_settings().secret.encode("utf-8")
    digest = hmac.new(secret, email.strip().lower().encode("utf-8"), hashlib.sha256).digest()
    return base64.b64encode(digest[:16]).decode("ascii")


def create_access_token(user_id: int) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=s.jwt_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, s.secret, algorithm=s.jwt_algorithm)


def get_current_user_id(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> int:
    s = get_settings()
    try:
        payload = jwt.decode(creds.credentials, s.secret, algorithms=[s.jwt_algorithm])
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
