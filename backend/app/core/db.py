"""SQLite-Anbindung via SQLModel. Speichert ausschliesslich Ciphertext."""
from __future__ import annotations

import os
from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

_db_path = get_settings().db_path
os.makedirs(os.path.dirname(os.path.abspath(_db_path)) or ".", exist_ok=True)

engine = create_engine(
    f"sqlite:///{_db_path}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    # Modelle importieren, damit SQLModel.metadata sie kennt.
    from .. import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
