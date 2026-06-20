"""Vault-Sync: speichert/liest verschluesselte TOTP-Eintraege.

Der Server behandelt jeden Eintrag als Blackbox-Ciphertext. Konflikte werden per
Optimistic Concurrency (revision) erkannt. Loeschungen werden als Tombstone
(deleted=True, leerer Ciphertext) gehalten, damit andere Geraete sie mitbekommen.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..core import security
from ..core.db import get_session
from ..models import User, VaultEntry

router = APIRouter(prefix="/api/vault", tags=["vault"])


class EntryIn(BaseModel):
    id: str = Field(min_length=8, max_length=64)
    ciphertext: str = Field(min_length=1)
    # Bekannte Revision des Clients; None = Neuanlage.
    base_revision: int | None = None


class EntryOut(BaseModel):
    id: str
    ciphertext: str
    revision: int
    deleted: bool
    updated_at: datetime


class VaultOut(BaseModel):
    entries: list[EntryOut]
    server_time: datetime


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=VaultOut)
def list_entries(
    user: User = Depends(security.get_current_user),
    session: Session = Depends(get_session),
) -> VaultOut:
    rows = session.exec(select(VaultEntry).where(VaultEntry.user_id == user.id)).all()
    return VaultOut(entries=[EntryOut(**r.model_dump()) for r in rows], server_time=_utcnow())


@router.post("", response_model=EntryOut)
def upsert_entry(
    body: EntryIn,
    user: User = Depends(security.get_current_user),
    session: Session = Depends(get_session),
) -> EntryOut:
    existing = session.exec(
        select(VaultEntry).where(VaultEntry.id == body.id, VaultEntry.user_id == user.id)
    ).first()

    if existing is None:
        entry = VaultEntry(id=body.id, user_id=user.id, ciphertext=body.ciphertext)
        session.add(entry)
        session.commit()
        session.refresh(entry)
        return EntryOut(**entry.model_dump())

    # Update: Konflikt, wenn der Client von einer veralteten Revision ausgeht.
    if body.base_revision is not None and body.base_revision != existing.revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Konflikt: Server-Revision {existing.revision}, Client kannte {body.base_revision}",
        )
    existing.ciphertext = body.ciphertext
    existing.revision += 1
    existing.deleted = False
    existing.updated_at = _utcnow()
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return EntryOut(**existing.model_dump())


@router.delete("/{entry_id}", response_model=EntryOut)
def delete_entry(
    entry_id: str,
    user: User = Depends(security.get_current_user),
    session: Session = Depends(get_session),
) -> EntryOut:
    entry = session.exec(
        select(VaultEntry).where(VaultEntry.id == entry_id, VaultEntry.user_id == user.id)
    ).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eintrag nicht gefunden")

    # Tombstone: Ciphertext verwerfen, Revision erhoehen.
    entry.deleted = True
    entry.ciphertext = ""
    entry.revision += 1
    entry.updated_at = _utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return EntryOut(**entry.model_dump())
