"""Zentrale Konfiguration aus Environment-Variablen (Prefix SELFAUTH_).

WICHTIG (Zero-Knowledge): SELFAUTH_SECRET signiert NUR JWTs und leitet den
Pseudo-Salt für die Account-Enumeration-Abwehr ab. Es ver-/entschlüsselt
NIEMALS Vault-Daten — das passiert ausschließlich im Client (Browser/APK).
Der Server sieht TOTP-Seeds zu keinem Zeitpunkt im Klartext.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_MIN_SECRET_LEN = 32
_ALLOWED_JWT_ALGS = {"HS256", "HS384", "HS512"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SELFAUTH_", extra="ignore")

    app_name: str = "SelfAuthenticator"
    # Master-Secret: PFLICHT. Ohne gültiges SELFAUTH_SECRET startet die App nicht
    # (ein bekannter Default-Key würde JWTs fälschbar machen).
    secret: str = ""
    db_path: str = "./data/selfauthenticator.db"
    base_url: str = ""

    # Selbst-Registrierung. Für Single-/Family-Use offen lassen, danach
    # SELFAUTH_ALLOW_REGISTRATION=false setzen, um den Server zu schließen.
    allow_registration: bool = True

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 Tage — App soll lange eingeloggt bleiben

    # CORS (Dev: Vite-Devserver)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _validate(self) -> "Settings":
        if len(self.secret) < _MIN_SECRET_LEN:
            raise ValueError(
                "SELFAUTH_SECRET fehlt oder ist zu kurz "
                f"(min. {_MIN_SECRET_LEN} Zeichen). Erzeugen mit: "
                'python -c "import secrets; print(secrets.token_hex(32))"'
            )
        if self.jwt_algorithm not in _ALLOWED_JWT_ALGS:
            raise ValueError(f"SELFAUTH_JWT_ALGORITHM muss in {_ALLOWED_JWT_ALGS} liegen")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
