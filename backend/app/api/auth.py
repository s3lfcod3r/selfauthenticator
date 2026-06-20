"""Auth-Endpoints: Zero-Knowledge Registrierung & Login.

Flow:
  1. Client ruft /prelogin mit E-Mail -> bekommt kdf_salt + Argon2-Parameter.
  2. Client leitet lokal ab: MasterKey = Argon2id(master_pw, kdf_salt);
     AuthHash = Argon2id(MasterKey, master_pw). Nur AuthHash geht zum Server.
  3. /register legt den Nutzer an (inkl. client-verschluesseltem protected_vault_key).
  4. /login verifiziert den AuthHash und gibt JWT + protected_vault_key zurueck.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, func, select

from ..core import security
from ..core.config import get_settings
from ..core.db import get_session
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Default-KDF-Parameter fuer neue Accounts (Client darf sie ueberschreiben).
_DEFAULT_KDF_MEM_KIB = 65536  # 64 MiB
_DEFAULT_KDF_OPS = 3


class PreloginIn(BaseModel):
    email: EmailStr


class PreloginOut(BaseModel):
    kdf_salt: str
    kdf_algorithm: str = "argon2id"
    kdf_mem_kib: int
    kdf_ops: int


class RegisterIn(BaseModel):
    email: EmailStr
    kdf_salt: str = Field(min_length=8)
    kdf_mem_kib: int = _DEFAULT_KDF_MEM_KIB
    kdf_ops: int = _DEFAULT_KDF_OPS
    auth_hash: str = Field(min_length=16)
    protected_vault_key: str = Field(min_length=16)


class LoginIn(BaseModel):
    email: EmailStr
    auth_hash: str = Field(min_length=16)


class TokenOut(BaseModel):
    token: str
    protected_vault_key: str
    kdf_salt: str
    kdf_mem_kib: int
    kdf_ops: int


class StateOut(BaseModel):
    has_users: bool
    allow_registration: bool


def _find_user(session: Session, email: str) -> User | None:
    norm = email.strip().lower()
    return session.exec(select(User).where(User.email == norm)).first()


@router.get("/state", response_model=StateOut)
def state(session: Session = Depends(get_session)) -> StateOut:
    count = session.exec(select(func.count()).select_from(User)).one()
    return StateOut(has_users=count > 0, allow_registration=get_settings().allow_registration)


@router.post("/prelogin", response_model=PreloginOut)
def prelogin(body: PreloginIn, session: Session = Depends(get_session)) -> PreloginOut:
    user = _find_user(session, body.email)
    if user is None:
        # Anti-Enumeration: stabiler Fake-Salt, identische Default-Parameter.
        return PreloginOut(
            kdf_salt=security.pseudo_salt(body.email),
            kdf_mem_kib=_DEFAULT_KDF_MEM_KIB,
            kdf_ops=_DEFAULT_KDF_OPS,
        )
    return PreloginOut(
        kdf_salt=user.kdf_salt,
        kdf_algorithm=user.kdf_algorithm,
        kdf_mem_kib=user.kdf_mem_kib,
        kdf_ops=user.kdf_ops,
    )


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, session: Session = Depends(get_session)) -> TokenOut:
    if not get_settings().allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registrierung ist deaktiviert")
    if _find_user(session, body.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "E-Mail bereits registriert")

    user = User(
        email=body.email.strip().lower(),
        kdf_salt=body.kdf_salt,
        kdf_mem_kib=body.kdf_mem_kib,
        kdf_ops=body.kdf_ops,
        auth_hash=security.hash_auth(body.auth_hash),
        protected_vault_key=body.protected_vault_key,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    return TokenOut(
        token=security.create_access_token(user.id),
        protected_vault_key=user.protected_vault_key,
        kdf_salt=user.kdf_salt,
        kdf_mem_kib=user.kdf_mem_kib,
        kdf_ops=user.kdf_ops,
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(get_session)) -> TokenOut:
    user = _find_user(session, body.email)
    # Konstante Fehlermeldung egal ob E-Mail oder AuthHash falsch ist.
    if user is None or not security.verify_auth(user.auth_hash, body.auth_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "E-Mail oder Master-Passwort falsch")

    return TokenOut(
        token=security.create_access_token(user.id),
        protected_vault_key=user.protected_vault_key,
        kdf_salt=user.kdf_salt,
        kdf_mem_kib=user.kdf_mem_kib,
        kdf_ops=user.kdf_ops,
    )


@router.get("/me")
def me(user: User = Depends(security.get_current_user)) -> dict:
    return {"email": user.email}
