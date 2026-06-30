"""Datenmodelle. Der Server kennt nur öffentliche KDF-Parameter und
Ciphertext-Blobs — niemals Master-Passwort, VaultKey oder TOTP-Seeds.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)

    # Öffentliche KDF-Parameter: der Client leitet daraus MasterKey =
    # Argon2id(master_password, kdf_salt) ab. Salt ist nicht geheim.
    kdf_salt: str  # base64
    kdf_algorithm: str = "argon2id"
    kdf_mem_kib: int = 65536  # 64 MiB
    kdf_ops: int = 3

    # Server-seitiger langsamer Hash des client-seitigen AuthHash. Der AuthHash
    # selbst ist eine vom MasterKey abgeleitete Größe — das Master-Passwort
    # verlässt das Gerät nie.
    auth_hash: str

    # XChaCha20-Poly1305(VaultKey, key=MasterKey), nonce vorangestellt, base64.
    # Nur mit dem MasterKey des Nutzers entschlüsselbar → für den Server Muell.
    protected_vault_key: str

    created_at: datetime = Field(default_factory=_utcnow)


class VaultEntry(SQLModel, table=True):
    # Client-generierte UUID, damit Offline-Anlegen + Sync ohne Server-Roundtrip geht.
    id: str = Field(primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")

    # XChaCha20-Poly1305(payload, key=VaultKey), nonce vorangestellt, base64.
    # payload = JSON {issuer,label,secret,algorithm,digits,period}.
    ciphertext: str

    # Monoton steigende Revision je Eintrag → Optimistic Concurrency beim Sync.
    revision: int = 1
    # Tombstone: gelöschte Einträge bleiben als Marker erhalten, damit andere
    # Geräte die Löschung mitbekommen.
    deleted: bool = False
    updated_at: datetime = Field(default_factory=_utcnow)


class RevokedToken(SQLModel, table=True):
    """Blocklist widerrufener JWTs (Logout). Einträge können nach Ablauf
    (expires_at) gefahrlos entfernt werden."""

    jti: str = Field(primary_key=True)
    expires_at: datetime
    revoked_at: datetime = Field(default_factory=_utcnow)
