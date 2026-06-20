# SelfAuthenticator

Self-hosted, **Zero-Knowledge** 2FA-/TOTP-Tresor — die eigene Alternative zu
Synology Secure SignIn, Authy & Co. Ein einzelner Docker-Container liefert die
Web-App (PWA) **und** die API, an die sich später das Android-APK andockt.

> Teil der **Self**-Reihe (SelfMailer, SelfArchiver, SelfDashboard …) – gleiches
> Design-System, gleicher Deploy-Stil (GHCR → Unraid).

---

## Sicherheitsmodell (Zero-Knowledge)

Der Server speichert **niemals** Klartext. Alle TOTP-Seeds werden ausschließlich
im Client (Browser/APK) ver- und entschlüsselt.

```
Master-Passwort ──Argon2id──► MasterKey   (verlässt das Gerät nie)
                                  │
                                  ├─ AuthHash = BLAKE2b(MasterKey‖pw)  ──► Server (nur Login-Beweis)
                                  │
                                  └─ entschlüsselt ProtectedVaultKey ──► VaultKey
                                                                            │
                          TOTP-Seeds ──XChaCha20-Poly1305(VaultKey)──► Server (nur Ciphertext)
```

- **Argon2id** (libsodium, 64 MiB / 3 Iterationen) leitet den MasterKey ab.
- **XChaCha20-Poly1305** verschlüsselt VaultKey und alle Einträge (192-bit-Nonce).
- Der Server kennt nur: E-Mail, öffentlichen KDF-Salt, einen Argon2-Hash des
  AuthHash und undurchsichtige Ciphertext-Blobs. **DB-Diebstahl ⇒ Datenmüll.**
- ⚠️ Das Master-Passwort kann **nicht** zurückgesetzt werden. Vergessen = Codes
  unwiederbringlich verschlüsselt.

---

## Schnellstart (Docker / Unraid)

```bash
cp .env.example .env
# Secret erzeugen und in .env eintragen:
python -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d
```

Aufrufen: `http://<host>:8091` → ersten Account anlegen → danach in `.env`
`SELFAUTH_ALLOW_REGISTRATION=false` setzen und neu starten, um den Server zu
schließen.

### Konfiguration (ENV, Prefix `SELFAUTH_`)

| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `SELFAUTH_SECRET` | ✅ | – | JWT-Signatur + Anti-Enumeration-Salt (≥32 Zeichen) |
| `SELFAUTH_ALLOW_REGISTRATION` | – | `true` | Selbst-Registrierung erlauben |
| `SELFAUTH_DB_PATH` | – | `/data/selfauthenticator.db` | SQLite-Pfad |
| `PORT` | – | `8091` | Host-Port |

---

## Entwicklung

```bash
# Backend
cd backend
pip install -r requirements.txt
export SELFAUTH_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload --port 8091

# Frontend (zweites Terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173 , proxyt /api → :8091
```

---

## API-Contract (auch fürs APK)

Alle Krypto passiert clientseitig; die API tauscht nur Blobs.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/auth/state` | `{has_users, allow_registration}` |
| `POST` | `/api/auth/prelogin` | `{email}` → KDF-Salt + Parameter |
| `POST` | `/api/auth/register` | Account anlegen → JWT + protected_vault_key |
| `POST` | `/api/auth/login` | AuthHash prüfen → JWT + protected_vault_key |
| `GET` | `/api/auth/me` | aktueller Nutzer |
| `GET` | `/api/vault` | alle (verschlüsselten) Einträge inkl. Tombstones |
| `POST` | `/api/vault` | Eintrag anlegen/aktualisieren (Optimistic Concurrency) |
| `DELETE` | `/api/vault/{id}` | Eintrag als Tombstone löschen |

Eintrag-Klartext (nur im Client): `{issuer, label, secret, algorithm, digits, period}`.

---

## Roadmap

- [ ] **Android-APK** als TWA-Wrapper derselben PWA (Bubblewrap), dockt an dieselbe API
- [ ] Biometrisches Entsperren (WebAuthn / Android Keystore)
- [ ] Verschlüsselter Export/Import (Backup)
- [ ] Optionale Erweiterung um Passwörter (Vault-Schema ist bereits generisch)
- [ ] Tests (Backend pytest, Frontend Vitest) auf 80 % Coverage

## Lizenz

Privates Self-Projekt.
