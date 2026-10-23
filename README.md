<div align="center">

<img src="assets/logo.png" width="240" alt="SelfAuthenticator logo" />

**Self-hosted, zero-knowledge 2FA / TOTP vault — your own alternative to Synology Secure SignIn, Authy & Co.**<br>
*Selbstgehosteter Zero-Knowledge-Tresor für 2FA / TOTP — deine eigene Alternative zu Synology Secure SignIn, Authy & Co.*

[![Build](https://github.com/s3lfcod3r/selfauthenticator/actions/workflows/docker.yml/badge.svg)](https://github.com/s3lfcod3r/selfauthenticator/actions/workflows/docker.yml)
![Version](https://img.shields.io/badge/version-2.6.1-33A78C)
![License](https://img.shields.io/badge/license-private-8A9CAA)
![Backend](https://img.shields.io/badge/backend-FastAPI-1F7763)
![Web](https://img.shields.io/badge/web-React%20PWA-43D3AD)
![App](https://img.shields.io/badge/android-planned-9DBDD0)

**[🇬🇧 English](#-english) · [🇩🇪 Deutsch](#-deutsch)**

📰 **What's new / Neuigkeiten** → [CHANGELOG.md](CHANGELOG.md)

</div>

---

<a id="-english"></a>

## 🇬🇧 English

A single Docker container that runs a **2FA / TOTP vault** — the web UI **and** the API behind it. Your TOTP secrets are stored **end-to-end encrypted**; the server only ever sees ciphertext. It is **not** a password manager and does **not** terminate TLS itself — put a VPN or reverse proxy in front for remote access.

Part of the **Self** family (SelfMailer, SelfArchiver, SelfDashboard …) — same design system, same deploy style (GHCR → Unraid).

> **TL;DR** — TOTP vault · zero-knowledge (Argon2id + XChaCha20-Poly1305) · installable web PWA · multi-device sync · encrypted backup · 12 languages · single container · no external DB.

### 📑 Table of contents

[Features](#en-features) · [Zero-knowledge model](#en-zero-knowledge) · [Remote access](#en-remote-access) · [Quick start](#en-quick-start) · [Unraid](#en-unraid) · [Configuration](#en-configuration) · [Android app](#en-android) · [API](#en-api) · [Security](#en-security) · [Tech stack](#en-tech-stack) · [Development](#en-development) · [Roadmap](#en-roadmap)

<a id="en-features"></a>

### ✨ Features

**🔑 Vault & codes**
- **Zero-knowledge** — secrets are encrypted on your device; the server can never read them
- Add entries **manually**, via **`otpauth://` URI** or by **scanning a QR code**
- **Edit** entries (name / icon / colour) and **sort** them (drag & drop, A–Z / Z–A, **favourites**)
- Countdown ring with a three-level **expiry traffic light** (teal / yellow / red + pulse), code digits in the same colour
- **Clock-drift compensation** via server time; tap a code to **copy** it

**🔄 Sync & backup**
- **Multi-device sync** — encrypted, with per-entry revisions; on a conflict the vault reloads
- **Encrypted backup / restore** — password-protected file, portable across devices; import keeps a partial success

**🔐 Security & platform**
- **Web UI (PWA)** — installable, works in any browser
- **12 European languages** with a language picker (browser language detected automatically)
- **Single container** — FastAPI + SQLite, no external database
- **On-brand** — Self design system, dark by default
- **Native Android app** — _planned_ (Kotlin + Compose, biometric unlock, native QR scanner)

<a id="en-zero-knowledge"></a>

### 🔐 Zero-knowledge model

The server **never** stores plaintext. All TOTP seeds are encrypted/decrypted **only** on the client (browser).

```text
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

> **⚠️ Master password:** it **cannot** be reset. Forget it = your codes are irreversibly encrypted.

<a id="en-remote-access"></a>

### 🌐 Remote access

The container speaks plain **HTTP** and is meant to live on a trusted network. Pick what fits:

- **LAN only** — reach it at `http://<host>:8091` from inside your network.
- **VPN (recommended for personal use)** — expose nothing publicly; reach the LAN address through WireGuard / Tailscale. The tunnel already encrypts everything end-to-end, so plain HTTP is fine.
- **HTTPS reverse proxy** — for public exposure without a VPN; see the **[HTTPS guide](docs/HTTPS.md)**. Also required if you want the **web** camera/clipboard (browser secure context).

<a id="en-quick-start"></a>

### 🚀 Quick start (Docker)

```bash
cp .env.example .env
# generate a secret and put it in .env (SELFAUTH_SECRET):
python -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d
```

Open `http://<host>:8091` → create the first account → then set `SELFAUTH_ALLOW_REGISTRATION=false` and restart to close the server.

> For access from outside your LAN, put a reverse proxy in front: [HTTPS guide](docs/HTTPS.md).

<a id="en-unraid"></a>

### 📦 Unraid

Add the template from
`https://raw.githubusercontent.com/s3lfcod3r/selfauthenticator/main/unraid/selfauthenticator.xml`
or import it under *Docker → Add Container → Template*. Set the **Master Secret**, leave the rest on defaults.

> **⚠️ Permissions:** the container runs **non-root** (uid `99` / gid `100` = `nobody:users`). For an existing installation, fix the data folder once:
> `chown -R 99:100 /mnt/user/appdata/selfauthenticator/data`

<a id="en-configuration"></a>

### ⚙️ Configuration

Environment variables, all with the prefix `SELFAUTH_` (plus `PORT` and `TZ` for Docker Compose).

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `SELFAUTH_SECRET` | ✅ | – | Signs JWTs + anti-enumeration salt (≥ 32 chars). Does **not** encrypt the vault — that happens client-side. |
| `SELFAUTH_ALLOW_REGISTRATION` | – | `true` | Allow self-registration; set to `false` after creating your account |
| `SELFAUTH_DB_PATH` | – | `/data/selfauthenticator.db` | SQLite path |
| `SELFAUTH_JWT_ALGORITHM` | – | `HS256` | `HS256` / `HS384` / `HS512` |
| `SELFAUTH_JWT_EXPIRE_MINUTES` | – | `10080` | Login lifetime in minutes (7 days) |
| `SELFAUTH_CORS_ORIGINS` | – | `http://localhost:5173,http://127.0.0.1:5173` | Allowed origins, comma-separated; `*` is rejected |
| `PORT` | – | `8091` | Host port (the container always listens on `8091`) |
| `TZ` | – | `Europe/Berlin` | Time zone |

<a id="en-android"></a>

### 📱 Android app

A native Android authenticator is on the roadmap — **not yet shipped** (no APK in this repo). The planned design:

- Talks **directly** to the same API — no embedded web view
- **Same libsodium crypto** as the web → the same account/vault works everywhere
- **Fingerprint unlock**, **native CameraX + ML Kit QR scanner**, native clipboard
- Server URL entered on first launch

For now, use the **Web UI (PWA)** — it is installable and works in any browser.

<a id="en-api"></a>

### 🔌 API overview

Base path `/api`, authentication via JWT Bearer. Interactive docs: `http://<host>:8091/docs`. All crypto happens client-side; the API only exchanges blobs.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | health check (used by the Docker `HEALTHCHECK`) |
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

<a id="en-security"></a>

### 🛡️ Security

- **Zero-knowledge** vault (see [Zero-knowledge model](#en-zero-knowledge)); `SELFAUTH_SECRET` only signs JWTs
- **Revocable sessions**: logout revokes the JWT server-side (blocklist); JWT algorithms hard-pinned to `HS256/384/512`
- **Constant-time login** — no account enumeration via timing
- **Rate limiting** on login/register and the vault endpoints; per-user entry cap (1000)
- Server-side **KDF minimums**, ciphertext/ID size limits, key separation, in-memory key zeroing
- Security headers + **CSP**, `Permissions-Policy`; a CORS wildcard is rejected at start-up
- **Non-root container** (uid `99` / gid `100`)
- **Deliberate trade-offs** (documented): plain HTTP (TLS via VPN or reverse proxy), the master password cannot be reset

Security update history → [CHANGELOG.md](CHANGELOG.md) (entries marked 🔒).

<a id="en-tech-stack"></a>

### 🧱 Tech stack

| Part | Tech |
|---|---|
| Backend | FastAPI · SQLModel · SQLite · slowapi |
| Crypto | Argon2id · XChaCha20-Poly1305 (libsodium) |
| Web | React · Vite · PWA · libsodium-wrappers |
| App _(planned)_ | Kotlin · Jetpack Compose · lazysodium · CameraX · ML Kit |
| Deploy | Docker (multi-stage, non-root) · GHCR · Unraid |

<a id="en-development"></a>

### 🛠️ Development

```bash
# Backend
cd backend && pip install -r requirements.txt
export SELFAUTH_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload --port 8091

# Web (second terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173, proxies /api → :8091
```

**Tests:** there are no automated tests yet; type check and build of the web UI:

```bash
cd frontend && npm run typecheck && npm run build
```

<a id="en-roadmap"></a>

### 🗺️ Roadmap

- [x] **[HTTPS guide](docs/HTTPS.md)** (reverse proxy) → unlocks web camera + TWA
- [x] **Encrypted export / backup** (password-protected, portable)
- [x] Edit & sort entries · favourites · expiry traffic light
- [x] 12 languages in the web PWA
- [ ] **Native Android app** (Kotlin + Compose, biometric unlock, native QR scanner)
- [ ] Bulk import (Google Authenticator `otpauth-migration://`)
- [ ] Optional passwords (vault schema is already generic)
- [ ] Tests toward 80 % coverage

<p align="right"><a href="#-english">⬆ back to top</a></p>

---

<a id="-deutsch"></a>

## 🇩🇪 Deutsch

Ein einzelner Docker-Container betreibt einen **2FA-/TOTP-Tresor** — die Web-Oberfläche **und** die API dahinter. Deine TOTP-Geheimnisse liegen **Ende-zu-Ende verschlüsselt**; der Server sieht ausschließlich verschlüsselte Daten. Er ist **kein** Passwortmanager und macht **kein** TLS selbst — für Zugriff von außen gehört ein VPN oder Reverse Proxy davor.

Teil der **Self**-Familie (SelfMailer, SelfArchiver, SelfDashboard …) — gleiches Design-System, gleicher Deploy-Stil (GHCR → Unraid).

> **Kurz** — TOTP-Tresor · Zero-Knowledge (Argon2id + XChaCha20-Poly1305) · installierbare Web-PWA · Sync über mehrere Geräte · verschlüsseltes Backup · 12 Sprachen · ein Container · keine externe DB.

### 📑 Inhaltsverzeichnis

[Funktionen](#de-funktionen) · [Zero-Knowledge-Modell](#de-zero-knowledge) · [Fernzugriff](#de-fernzugriff) · [Schnellstart](#de-schnellstart) · [Unraid](#de-unraid) · [Konfiguration](#de-konfiguration) · [Android-App](#de-android) · [API](#de-api) · [Sicherheit](#de-sicherheit) · [Tech-Stack](#de-tech-stack) · [Entwicklung](#de-entwicklung) · [Roadmap](#de-roadmap)

<a id="de-funktionen"></a>

### ✨ Funktionen

**🔑 Tresor & Codes**
- **Zero-Knowledge** — Geheimnisse werden auf deinem Gerät verschlüsselt; der Server kann sie nie lesen
- Einträge **manuell**, per **`otpauth://`-URI** oder per **QR-Scan** hinzufügen
- Einträge **bearbeiten** (Name / Symbol / Farbe) und **sortieren** (Ziehen, A–Z / Z–A, **Favoriten**)
- Countdown-Ring mit dreistufiger **Ablauf-Ampel** (Türkis / Gelb / Rot + Puls), Code-Ziffern in derselben Farbe
- **Ausgleich von Uhrabweichungen** über die Serverzeit; Code antippen zum **Kopieren**

**🔄 Sync & Backup**
- **Mehrgeräte-Sync** — verschlüsselt, mit Revision pro Eintrag; bei einem Konflikt lädt der Tresor neu
- **Verschlüsseltes Backup / Wiederherstellen** — passwortgeschützte Datei, geräteübergreifend austauschbar; der Import behält auch einen Teilerfolg

**🔐 Sicherheit & Plattform**
- **Web-Oberfläche (PWA)** — installierbar, läuft in jedem Browser
- **12 europäische Sprachen** mit Sprachwähler (Browsersprache wird automatisch erkannt)
- **Ein Container** — FastAPI + SQLite, keine externe Datenbank
- **Markentreu** — Self-Design-System, dunkel als Standard
- **Native Android-App** — _geplant_ (Kotlin + Compose, Entsperren per Biometrie, nativer QR-Scanner)

<a id="de-zero-knowledge"></a>

### 🔐 Zero-Knowledge-Modell

Der Server speichert **niemals** Klartext. Alle TOTP-Seeds werden **ausschließlich** im Client (Browser) ver- und entschlüsselt.

```text
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

> **⚠️ Master-Passwort:** lässt sich **nicht** zurücksetzen. Vergessen = die Codes sind unwiederbringlich verschlüsselt.

<a id="de-fernzugriff"></a>

### 🌐 Fernzugriff

Der Container spricht reines **HTTP** und gehört in ein vertrauenswürdiges Netz. Wähle, was passt:

- **Nur LAN** — im Heimnetz unter `http://<host>:8091` erreichbar.
- **VPN (empfohlen für den privaten Einsatz)** — nichts öffentlich freigeben; die LAN-Adresse über WireGuard / Tailscale erreichen. Der Tunnel verschlüsselt bereits Ende-zu-Ende, reines HTTP ist also okay.
- **HTTPS-Reverse-Proxy** — für öffentliche Erreichbarkeit ohne VPN; siehe **[HTTPS-Anleitung](docs/HTTPS.md)**. Außerdem nötig, wenn du die **Web**-Kamera/Zwischenablage willst (Browser-Secure-Context).

<a id="de-schnellstart"></a>

### 🚀 Schnellstart (Docker)

```bash
cp .env.example .env
# Secret erzeugen und in .env eintragen (SELFAUTH_SECRET):
python -c "import secrets; print(secrets.token_hex(32))"

docker compose up -d
```

`http://<host>:8091` öffnen → ersten Account anlegen → danach `SELFAUTH_ALLOW_REGISTRATION=false` setzen und neu starten, um den Server zu schließen.

> Für Zugriff von außerhalb des LANs einen Reverse Proxy davorschalten: [HTTPS-Anleitung](docs/HTTPS.md).

<a id="de-unraid"></a>

### 📦 Unraid

Vorlage von
`https://raw.githubusercontent.com/s3lfcod3r/selfauthenticator/main/unraid/selfauthenticator.xml`
hinzufügen oder unter *Docker → Add Container → Template* importieren. **Master Secret** eintragen, den Rest auf Standard lassen.

> **⚠️ Rechte:** der Container läuft **ohne Root** (uid `99` / gid `100` = `nobody:users`). Bei einer bestehenden Installation den Datenordner einmalig korrigieren:
> `chown -R 99:100 /mnt/user/appdata/selfauthenticator/data`

<a id="de-konfiguration"></a>

### ⚙️ Konfiguration

Umgebungsvariablen, alle mit dem Präfix `SELFAUTH_` (dazu `PORT` und `TZ` für Docker Compose).

| Variable | Pflicht | Standard | Zweck |
|---|---|---|---|
| `SELFAUTH_SECRET` | ✅ | – | Signiert JWTs + Anti-Enumeration-Salt (≥ 32 Zeichen). Verschlüsselt den Tresor **nicht** — das passiert im Client. |
| `SELFAUTH_ALLOW_REGISTRATION` | – | `true` | Selbst-Registrierung erlauben; nach dem Anlegen deines Accounts auf `false` setzen |
| `SELFAUTH_DB_PATH` | – | `/data/selfauthenticator.db` | SQLite-Pfad |
| `SELFAUTH_JWT_ALGORITHM` | – | `HS256` | `HS256` / `HS384` / `HS512` |
| `SELFAUTH_JWT_EXPIRE_MINUTES` | – | `10080` | Gültigkeit der Anmeldung in Minuten (7 Tage) |
| `SELFAUTH_CORS_ORIGINS` | – | `http://localhost:5173,http://127.0.0.1:5173` | Erlaubte Origins, kommagetrennt; `*` wird abgelehnt |
| `PORT` | – | `8091` | Host-Port (der Container lauscht immer auf `8091`) |
| `TZ` | – | `Europe/Berlin` | Zeitzone |

<a id="de-android"></a>

### 📱 Android-App

Ein nativer Android-Authenticator steht auf der Roadmap — **noch nicht veröffentlicht** (keine APK in diesem Repo). Geplantes Design:

- Redet **direkt** mit derselben API — keine eingebettete WebView
- **Gleiche libsodium-Krypto** wie das Web → derselbe Account/Tresor funktioniert überall
- **Entsperren per Fingerabdruck**, **nativer CameraX + ML-Kit QR-Scanner**, native Zwischenablage
- Server-URL beim ersten Start eingeben

Bis dahin die **Web-Oberfläche (PWA)** nutzen — installierbar und in jedem Browser lauffähig.

<a id="de-api"></a>

### 🔌 API-Übersicht

Basispfad `/api`, Anmeldung per JWT Bearer. Interaktive Doku: `http://<host>:8091/docs`. Die Krypto passiert im Client; die API tauscht nur verschlüsselte Blobs.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/health` | Statusprüfung (vom Docker-`HEALTHCHECK` genutzt) |
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

<a id="de-sicherheit"></a>

### 🛡️ Sicherheit

- **Zero-Knowledge**-Tresor (siehe [Zero-Knowledge-Modell](#de-zero-knowledge)); `SELFAUTH_SECRET` signiert nur JWTs
- **Widerrufbare Sitzungen**: Logout sperrt das JWT serverseitig (Blocklist); JWT-Algorithmen fest auf `HS256/384/512`
- **Konstante Login-Zeit** — keine Konto-Ausspähung über Timing
- **Rate-Limiting** bei Login/Registrierung und den Tresor-Endpunkten; Eintragslimit pro Nutzer (1000)
- Serverseitige **KDF-Mindestwerte**, Längen-/ID-Limits, Schlüsseltrennung, Schlüssel werden im Speicher genullt
- Security-Header + **CSP**, `Permissions-Policy`; eine CORS-Wildcard wird beim Start abgelehnt
- **Container ohne Root** (uid `99` / gid `100`)
- **Bewusste Kompromisse** (dokumentiert): reines HTTP (TLS per VPN oder Reverse Proxy), das Master-Passwort lässt sich nicht zurücksetzen

Verlauf der Sicherheitsupdates → [CHANGELOG.md](CHANGELOG.md) (Einträge mit 🔒).

<a id="de-tech-stack"></a>

### 🧱 Tech-Stack

| Teil | Technik |
|---|---|
| Backend | FastAPI · SQLModel · SQLite · slowapi |
| Krypto | Argon2id · XChaCha20-Poly1305 (libsodium) |
| Web | React · Vite · PWA · libsodium-wrappers |
| App _(geplant)_ | Kotlin · Jetpack Compose · lazysodium · CameraX · ML Kit |
| Deploy | Docker (Multi-Stage, ohne Root) · GHCR · Unraid |

<a id="de-entwicklung"></a>

### 🛠️ Entwicklung

```bash
# Backend
cd backend && pip install -r requirements.txt
export SELFAUTH_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")
uvicorn app.main:app --reload --port 8091

# Web (zweites Terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173, leitet /api → :8091 weiter
```

**Tests:** automatische Tests gibt es noch nicht; Typprüfung und Build der Web-Oberfläche:

```bash
cd frontend && npm run typecheck && npm run build
```

<a id="de-roadmap"></a>

### 🗺️ Roadmap

- [x] **[HTTPS-Anleitung](docs/HTTPS.md)** (Reverse Proxy) → schaltet Web-Kamera + TWA frei
- [x] **Verschlüsselter Export / Backup** (passwortgeschützt, portabel)
- [x] Einträge bearbeiten & sortieren · Favoriten · Ablauf-Ampel
- [x] 12 Sprachen in der Web-PWA
- [ ] **Native Android-App** (Kotlin + Compose, Entsperren per Biometrie, nativer QR-Scanner)
- [ ] Massen-Import (Google-Authenticator `otpauth-migration://`)
- [ ] Optionale Passwörter (Tresor-Schema ist bereits generisch)
- [ ] Tests Richtung 80 % Abdeckung

<p align="right"><a href="#-deutsch">⬆ nach oben</a></p>

---

<div align="center">

**SelfAuthenticator** · part of the Self family · Teil der Self-Familie<br>
made with 🛡️ for self-hosting

</div>
