<div align="center">

<img src="assets/logo.png" width="240" alt="SelfAuthenticator logo" />


**Self-hosted, zero-knowledge 2FA / TOTP vault — your own alternative to Synology Secure SignIn, Authy & Co.**

[![Build](https://github.com/s3lfcod3r/selfauthenticator/actions/workflows/docker.yml/badge.svg)](https://github.com/s3lfcod3r/selfauthenticator/actions/workflows/docker.yml)
![Version](https://img.shields.io/badge/version-2.2.0-33A78C)
![License](https://img.shields.io/badge/license-private-8A9CAA)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Web](https://img.shields.io/badge/web-React%20PWA-43D3AD)
![App](https://img.shields.io/badge/android-Kotlin%20%2B%20Compose-9DBDD0)

[English](#english) · [Deutsch](#deutsch)

</div>

---

<a id="english"></a>

## 🇬🇧 English

A single Docker container that runs a **2FA / TOTP vault** — the web UI **and** the API that the native Android app talks to. Your TOTP secrets are stored **end-to-end encrypted**; the server only ever sees ciphertext.

Part of the **Self** family (SelfMailer, SelfArchiver, SelfDashboard …) — same design system, same deploy style (GHCR → Unraid).

### ✨ Features

- 🔐 **Zero-knowledge** — secrets are encrypted on your device; the server can never read them
- 🌐 **Web UI (PWA)** — installable, works in any browser
- 📱 **Native Android app** — Kotlin + Jetpack Compose, talks directly to the API
- 👆 **Biometric unlock** — fingerprint replaces the master password on the app
- 📷 **Native QR scanner** — add accounts by scanning (works even over HTTP)
- 🔄 **Multi-device sync** — encrypted, with per-entry revisions
- 💾 **Encrypted backup / restore** — password-protected file, portable between web & app
- 🐳 **Single container** — FastAPI + SQLite, no external database
- 🎨 **On-brand** — Self design system, dark by default

### 🛡️ Security model (zero-knowledge)

The server **never** stores plaintext. All TOTP seeds are encrypted/decrypted **only** on the client (browser / app).

```
Master password ──Argon2id──► MasterKey   (never leaves your device)
                                  │
                                  ├─ AuthHash = BLAKE2b(MasterKey‖pw) ──► Server (login proof only)
                                  │
                                  └─ decrypts ProtectedVaultKey ──► VaultKey
                                                                       │
                     TOTP seeds ──XChaCha20-Poly1305(VaultKey)──► Server (ciphertext only)
```

- **Argon2id** (64 MiB / 3 iterations) derives the MasterKey
- **XChaCha20-Poly1305** encrypts the VaultKey and every entry (192-bit nonce)
- The server only knows: e-mail, public KDF salt, an Argon2 hash of the AuthHash, and opaque ciphertext blobs → **DB theft yields garbage**
- ⚠️ The master password **cannot** be reset. Forget it = your codes are irreversibly encrypted.

**Hardening (v2.0.9):** rate limiting on login/register, hard-pinned JWT algorithms, server-side KDF minimums, security headers + CSP, ciphertext/ID size limits. Android: `allowBackup=false`, JWT token kept in the Android Keystore. Reviewed with the ECC security reviewer.

**Hardening (v2.2.0):** full line-by-line review of container + app. Added: session logout with **server-side JWT revocation** (blocklist), **constant-time login** (no account-enumeration via timing), rate-limited vault endpoints + per-user entry cap, **biometric unlock bound to an Android Keystore key via `BiometricPrompt.CryptoObject`** (the vault key is released only after OS-verified biometrics, not a UI-only gate), key separation, **non-root container**, `Permissions-Policy`, in-memory key zeroing.

### 🔒 Remote access

The container speaks plain **HTTP** and is meant to live on a trusted network. Pick what fits:

- **LAN only** — reach it at `http://<host>:8091` from inside your network.
- **VPN (recommended for personal use)** — expose nothing publicly; reach the LAN address through WireGuard / Tailscale. The tunnel already encrypts everything end-to-end, so plain HTTP is fine and the **native app works as-is**.
- **HTTPS reverse proxy** — for public exposure without a VPN; see the **[HTTPS guide](docs/HTTPS.md)**. Also required if you want the **web** camera/clipboard (browser secure-context); the native app never needs it.

### 🚀 Quick start (Docker)

```bash
cp .env.example .env
# generate a secret and put it in .env:
python -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d
```

Open `http://<host>:8091` → create the first account → then set `SELFAUTH_ALLOW_REGISTRATION=false` and restart to close the server.

### 📦 Unraid

Add the template from
`https://raw.githubusercontent.com/s3lfcod3r/selfauthenticator/main/unraid/selfauthenticator.xml`
or import it in *Docker → Add Container → Template*. Set the **Master Secret**, leave the rest on defaults.

### ⚙️ Configuration (ENV, prefix `SELFAUTH_`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SELFAUTH_SECRET` | ✅ | – | Signs JWTs + anti-enumeration salt (≥ 32 chars) |
| `SELFAUTH_ALLOW_REGISTRATION` | – | `true` | Allow self-registration |
| `SELFAUTH_DB_PATH` | – | `/data/selfauthenticator.db` | SQLite path |
| `PORT` | – | `8091` | Host port |

### 📱 Android app

A real native authenticator (`android/SelfAuthenticator.apk`):

- Talks **directly** to the API — no embedded web view, no caching headaches
- **Same libsodium crypto** as the web → the same account/vault works everywhere
- **Fingerprint unlock**, **native CameraX + ML Kit QR scanner**, native clipboard
- Server URL entered on first launch

Install the APK, open it, enter `http://<host>:8091`, log in once with your master password — after that, fingerprint unlocks the vault directly.

### 🔌 API contract

All crypto happens client-side; the API only exchanges blobs.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/state` | `{has_users, allow_registration}` |
| `POST` | `/api/auth/prelogin` | `{email}` → KDF salt + parameters |
| `POST` | `/api/auth/register` | create account → JWT + protected_vault_key |
| `POST` | `/api/auth/login` | verify AuthHash → JWT + protected_vault_key |
| `POST` | `/api/auth/logout` | revoke the current JWT (server-side blocklist) |
| `GET` | `/api/auth/me` | current user |
| `GET` | `/api/vault` | all (encrypted) entries incl. tombstones |
| `POST` | `/api/vault` | create/update entry (optimistic concurrency) |
| `DELETE` | `/api/vault/{id}` | delete (tombstone) |

Entry plaintext (client only): `{issuer, label, secret, algorithm, digits, period}`.

### 🧱 Tech stack

| Part | Tech |
|---|---|
| Backend | FastAPI · SQLModel · SQLite · slowapi |
| Crypto | Argon2id · XChaCha20-Poly1305 (libsodium) |
| Web | React · Vite · PWA · libsodium-wrappers |
| App | Kotlin · Jetpack Compose · lazysodium · CameraX · ML Kit |
| Deploy | Docker (multi-stage) · GHCR · Unraid |

### 🛠️ Development

```bash
# Backend
cd backend && pip install -r requirements.txt
export SELFAUTH_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload --port 8091

# Web (second terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api → :8091
```

### 🗺️ Roadmap

- [x] **[HTTPS guide](docs/HTTPS.md)** (reverse proxy) → unlocks web camera + TWA
- [x] **Encrypted export / backup** (password-protected, web ↔ app)
- [ ] Bulk import (Google Authenticator `otpauth-migration://`)
- [ ] Optional passwords (vault schema is already generic)
- [ ] Tests toward 80 % coverage

---

<a id="deutsch"></a>

## 🇩🇪 Deutsch

Ein einzelner Docker-Container betreibt einen **2FA-/TOTP-Tresor** — die Web-Oberfläche **und** die API, mit der die native Android-App spricht. Deine TOTP-Geheimnisse liegen **Ende-zu-Ende verschlüsselt**; der Server sieht ausschließlich Ciphertext.

Teil der **Self**-Reihe (SelfMailer, SelfArchiver, SelfDashboard …) — gleiches Design-System, gleicher Deploy-Stil (GHCR → Unraid).

### ✨ Funktionen

- 🔐 **Zero-Knowledge** — Geheimnisse werden auf deinem Gerät verschlüsselt; der Server kann sie nie lesen
- 🌐 **Web-Oberfläche (PWA)** — installierbar, läuft in jedem Browser
- 📱 **Native Android-App** — Kotlin + Jetpack Compose, redet direkt mit der API
- 👆 **Biometrie-Entsperrung** — Fingerabdruck ersetzt das Master-Passwort in der App
- 📷 **Nativer QR-Scanner** — Konten per Scan hinzufügen (auch über HTTP)
- 🔄 **Mehrgeräte-Sync** — verschlüsselt, mit Revision pro Eintrag
- 💾 **Verschlüsseltes Backup / Wiederherstellen** — passwortgeschützte Datei, zwischen Web & App austauschbar
- 🐳 **Ein Container** — FastAPI + SQLite, keine externe Datenbank
- 🎨 **Markentreu** — Self-Design-System, dunkel als Standard

### 🛡️ Sicherheitsmodell (Zero-Knowledge)

Der Server speichert **niemals** Klartext. Alle TOTP-Seeds werden **ausschließlich** im Client (Browser/App) ver- und entschlüsselt.

```
Master-Passwort ──Argon2id──► MasterKey   (verlässt das Gerät nie)
                                  │
                                  ├─ AuthHash = BLAKE2b(MasterKey‖pw) ──► Server (nur Login-Beweis)
                                  │
                                  └─ entschlüsselt ProtectedVaultKey ──► VaultKey
                                                                           │
                     TOTP-Seeds ──XChaCha20-Poly1305(VaultKey)──► Server (nur Ciphertext)
```

- **Argon2id** (64 MiB / 3 Iterationen) leitet den MasterKey ab
- **XChaCha20-Poly1305** verschlüsselt VaultKey und jeden Eintrag (192-bit-Nonce)
- Der Server kennt nur: E-Mail, öffentlichen KDF-Salt, einen Argon2-Hash des AuthHash und undurchsichtige Ciphertext-Blobs → **DB-Diebstahl ergibt Datenmüll**
- ⚠️ Das Master-Passwort lässt sich **nicht** zurücksetzen. Vergessen = die Codes sind unwiederbringlich verschlüsselt.

**Härtung (v2.0.9):** Rate-Limiting auf Login/Registrierung, hart verdrahtete JWT-Algorithmen, serverseitige KDF-Mindestwerte, Security-Header + CSP, Längen-/ID-Limits. Android: `allowBackup=false`, JWT-Token im Android-Keystore. Geprüft mit dem ECC-Security-Reviewer.

**Härtung (v2.2.0):** kompletter Zeile-für-Zeile-Review von Container + App. Neu: Logout mit **serverseitiger JWT-Sperre** (Blocklist), **konstante Login-Zeit** (keine Account-Enumeration über Timing), rate-limitierte Vault-Endpunkte + Eintragslimit pro Nutzer, **Biometrie-Entsperrung an einen Android-Keystore-Schlüssel via `BiometricPrompt.CryptoObject` gebunden** (der Tresor-Schlüssel wird erst nach vom OS bestätigter Biometrie freigegeben, keine reine UI-Sperre), Key-Separation, **non-root-Container**, `Permissions-Policy`, Schlüssel-Nullen im Speicher.

### 🔒 Fernzugriff

Der Container spricht reines **HTTP** und gehört in ein vertrauenswürdiges Netz. Wähle, was passt:

- **Nur LAN** — im Heimnetz unter `http://<host>:8091` erreichbar.
- **VPN (empfohlen für den privaten Einsatz)** — nichts öffentlich exponieren; die LAN-Adresse über WireGuard / Tailscale erreichen. Der Tunnel verschlüsselt bereits Ende-zu-Ende, reines HTTP ist also okay und die **native App läuft unverändert**.
- **HTTPS-Reverse-Proxy** — für öffentliche Erreichbarkeit ohne VPN; siehe **[HTTPS-Anleitung](docs/HTTPS.md)**. Außerdem nötig, wenn du die **Web**-Kamera/Zwischenablage willst (Browser-Secure-Context); die native App braucht das nie.

### 🚀 Schnellstart (Docker)

```bash
cp .env.example .env
# Secret erzeugen und in .env eintragen:
python -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d
```

`http://<host>:8091` öffnen → ersten Account anlegen → danach `SELFAUTH_ALLOW_REGISTRATION=false` setzen und neu starten, um den Server zu schließen.

### 📦 Unraid

Template hinzufügen über
`https://raw.githubusercontent.com/s3lfcod3r/selfauthenticator/main/unraid/selfauthenticator.xml`
oder unter *Docker → Add Container → Template* importieren. **Master Secret** eintragen, Rest auf Standard lassen.

### ⚙️ Konfiguration (ENV, Prefix `SELFAUTH_`)

| Variable | Pflicht | Default | Zweck |
|---|---|---|---|
| `SELFAUTH_SECRET` | ✅ | – | Signiert JWTs + Anti-Enumeration-Salt (≥ 32 Zeichen) |
| `SELFAUTH_ALLOW_REGISTRATION` | – | `true` | Selbst-Registrierung erlauben |
| `SELFAUTH_DB_PATH` | – | `/data/selfauthenticator.db` | SQLite-Pfad |
| `PORT` | – | `8091` | Host-Port |

### 📱 Android-App

Ein echter nativer Authenticator (`android/SelfAuthenticator.apk`):

- Redet **direkt** mit der API — keine eingebettete WebView, keine Cache-Probleme
- **Gleiche libsodium-Krypto** wie das Web → derselbe Account/Tresor funktioniert überall
- **Fingerabdruck-Entsperrung**, **nativer CameraX + ML-Kit QR-Scanner**, native Zwischenablage
- Server-URL beim ersten Start eingeben

APK installieren, öffnen, `http://<host>:8091` eingeben, einmal mit Master-Passwort einloggen — danach entsperrt der Fingerabdruck den Tresor direkt.

### 🔌 API-Contract

Die Krypto passiert clientseitig; die API tauscht nur Blobs.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/auth/state` | `{has_users, allow_registration}` |
| `POST` | `/api/auth/prelogin` | `{email}` → KDF-Salt + Parameter |
| `POST` | `/api/auth/register` | Account anlegen → JWT + protected_vault_key |
| `POST` | `/api/auth/login` | AuthHash prüfen → JWT + protected_vault_key |
| `POST` | `/api/auth/logout` | aktuelles JWT widerrufen (serverseitige Blocklist) |
| `GET` | `/api/auth/me` | aktueller Nutzer |
| `GET` | `/api/vault` | alle (verschlüsselten) Einträge inkl. Tombstones |
| `POST` | `/api/vault` | Eintrag anlegen/aktualisieren (Optimistic Concurrency) |
| `DELETE` | `/api/vault/{id}` | Eintrag löschen (Tombstone) |

Eintrag-Klartext (nur im Client): `{issuer, label, secret, algorithm, digits, period}`.

### 🧱 Technik-Stack

| Teil | Technik |
|---|---|
| Backend | FastAPI · SQLModel · SQLite · slowapi |
| Krypto | Argon2id · XChaCha20-Poly1305 (libsodium) |
| Web | React · Vite · PWA · libsodium-wrappers |
| App | Kotlin · Jetpack Compose · lazysodium · CameraX · ML Kit |
| Deploy | Docker (Multi-Stage) · GHCR · Unraid |

### 🛠️ Entwicklung

```bash
# Backend
cd backend && pip install -r requirements.txt
export SELFAUTH_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload --port 8091

# Web (zweites Terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173, proxyt /api → :8091
```

### 🗺️ Roadmap

- [x] **[HTTPS-Anleitung](docs/HTTPS.md)** (Reverse-Proxy) → schaltet Web-Kamera + TWA frei
- [x] **Verschlüsselter Export / Backup** (passwortgeschützt, Web ↔ App)
- [ ] Massen-Import (Google-Authenticator `otpauth-migration://`)
- [ ] Optionale Passwörter (Vault-Schema ist bereits generisch)
- [ ] Tests Richtung 80 % Coverage

---

<div align="center">

**SelfAuthenticator** · Teil der Self-Reihe · made with 🛡️ for self-hosting

</div>
