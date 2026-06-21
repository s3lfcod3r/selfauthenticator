"""Rate-Limiting (slowapi). Bremst Brute-Force gegen /login & /register.

Eigenes Modul, damit Limiter sowohl in main.py (App-State/Handler) als auch in
den Routern (Decorator) ohne zirkulaeren Import verfuegbar ist.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
