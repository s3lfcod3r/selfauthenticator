"""Vault-Sync: speichert/liest verschlüsselte TOTP-Einträge.

Der Server behandelt jeden Eintrag als Blackbox-Ciphertext. Konflikte werden per
Optimistic Concurrency (revision) erkannt. Löschungen werden als Tombstone
(deleted=True, leerer Ciphertext) gehalten, damit andere Geräte sie mitbekommen.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, select

from ..core import security
from ..core.db import get_session
from ..core.ratelimit import limiter
from ..models import VaultEntry

router = APIRouter(prefix="/api/vault", tags=["vault"])

# Obergrenze an Einträgen je Nutzer (gegen DB-Flutung mit gestohlenem Token).
_MAX_ENTRIES_PER_USER = 1000


class EntryIn(BaseModel):
    id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    # Obergrenze gegen DB-Flutung; ein TOTP-Eintrag ist nur wenige hundert Byte.
    ciphertext: str = Field(min_length=24, max_length=20000)
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
@limiter.limit("120/minute")
def list_entries(
    request: Request,
    user_id: int = Depends(security.get_current_user_id),
    session: Session = Depends(get_session),
) -> VaultOut:
    rows = session.exec(select(VaultEntry).where(VaultEntry.user_id == user_id)).all()
    return VaultOut(entries=[EntryOut(**r.model_dump()) for r in rows], server_time=_utcnow())


@router.post("", response_model=EntryOut)
@limiter.limit("120/minute")
def upsert_entry(
    request: Request,
    body: EntryIn,
    user_id: int = Depends(security.get_current_user_id),
    session: Session = Depends(get_session),
) -> EntryOut:
    existing = session.exec(
        select(VaultEntry).where(VaultEntry.id == body.id, VaultEntry.user_id == user_id)
    ).first()

    if existing is None:
        # Eintragslimit pro Nutzer (Schutz vor DB-Flutung).
        count = session.exec(
            select(func.count()).select_from(VaultEntry).where(VaultEntry.user_id == user_id)
        ).one()
        if count >= _MAX_ENTRIES_PER_USER:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Maximale Eintragszahl ({_MAX_ENTRIES_PER_USER}) erreicht",
            )
        entry = VaultEntry(id=body.id, user_id=user_id, ciphertext=body.ciphertext)
        session.add(entry)
        try:
            session.commit()
        except IntegrityError:
            # ID global bereits vergeben (Kollision mit fremdem Nutzer o. Race).
            session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Eintrags-ID bereits vergeben")
        session.refresh(entry)
        return EntryOut(**entry.model_dump())

    # Gelöschte Einträge nicht stillschweigend wiederbeleben.
    if existing.deleted:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Eintrag wurde gelöscht (Tombstone) — Neuanlage mit neuer ID erforderlich",
        )

    # Update: Konflikt, wenn der Client von einer veralteten Revision ausgeht.
    if body.base_revision is not None and body.base_revision != existing.revision:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Konflikt: Server-Revision {existing.revision}, Client kannte {body.base_revision}",
        )
    existing.ciphertext = body.ciphertext
    existing.revision += 1
    existing.updated_at = _utcnow()
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return EntryOut(**existing.model_dump())


@router.delete("/{entry_id}", response_model=EntryOut)
@limiter.limit("120/minute")
def delete_entry(
    request: Request,
    entry_id: str = Path(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
    user_id: int = Depends(security.get_current_user_id),
    session: Session = Depends(get_session),
) -> EntryOut:
    entry = session.exec(
        select(VaultEntry).where(VaultEntry.id == entry_id, VaultEntry.user_id == user_id)
    ).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eintrag nicht gefunden")

    # Tombstone: Ciphertext verwerfen, Revision erhöhen.
    entry.deleted = True
    entry.ciphertext = ""
    entry.revision += 1
    entry.updated_at = _utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return EntryOut(**entry.model_dump())
