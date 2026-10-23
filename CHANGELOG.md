# 📰 Changelog

Newest version first. Versions and dates come from the Git tags of this repo.
Neueste Version zuerst. Versionen und Daten stammen aus den Git-Tags dieses Repos.

---

## 2.6.1 · Jul 2026
- 🇬🇧 The **code digits** now take the colour of the expiry traffic light (teal / yellow / red).
- 🇩🇪 Die **Code-Ziffern** färben sich jetzt nach der Ablauf-Ampel (Türkis / Gelb / Rot).

## 2.6.0 · Jul 2026
- 🇬🇧 Three-level **expiry traffic light** for the TOTP countdown ring (teal / yellow / red + pulse).
- 🇩🇪 Dreistufige **Ablauf-Ampel** für den TOTP-Countdown-Ring (Türkis / Gelb / Rot + Puls).

## 2.5.4 · Jul 2026
- 🇬🇧 CI only (tags 2.5.1, 2.5.2 and 2.5.4 point to the same commit): a published release now triggers the **SelfStore catalogue sync**. No app changes.
- 🇩🇪 Nur CI (die Tags 2.5.1, 2.5.2 und 2.5.4 zeigen auf denselben Commit): ein veröffentlichtes Release stößt jetzt den **SelfStore-Katalog-Sync** an. Keine Änderungen an der App.

## 2.5.0 · Jul 2026 🔒
- 🇬🇧 **12 European languages** in the web PWA (language picker, browser-language detection); import keeps a **partial success** instead of discarding it; on a sync conflict (409) the vault reloads; hint for entries that cannot be decrypted; **clock-drift compensation** via server time. Security: a CORS wildcard is rejected at start-up, default JWT lifetime lowered from 30 to **7 days**.
- 🇩🇪 **12 europäische Sprachen** in der Web-PWA (Sprachwähler, Erkennung der Browsersprache); der Import behält einen **Teilerfolg**, statt ihn zu verwerfen; bei einem Sync-Konflikt (409) lädt der Tresor neu; Hinweis auf Einträge, die sich nicht entschlüsseln lassen; **Ausgleich von Uhrabweichungen** über die Serverzeit. Sicherheit: CORS-Wildcard wird beim Start abgelehnt, Standard-Gültigkeit der JWTs von 30 auf **7 Tage** gesenkt.

## 2.4.0 · Jun 2026
- 🇬🇧 Tag on the same commit as 2.3.1 — no changes of its own.
- 🇩🇪 Tag auf demselben Commit wie 2.3.1 — keine eigenen Änderungen.

## 2.3.1 · Jun 2026
- 🇬🇧 German umlauts fixed in texts and comments (ue/oe/ae/ss → ä/ö/ü/ß).
- 🇩🇪 Deutsche Umlaute in Texten und Kommentaren korrigiert (ue/oe/ae/ss → ä/ö/ü/ß).

## 2.3.0 · Jun 2026
- 🇬🇧 **Edit 2FA entries** (name / icon / colour) and **sort** them (drag & drop, A–Z / Z–A, favourites).
- 🇩🇪 **2FA-Einträge bearbeiten** (Name / Symbol / Farbe) und **sortieren** (Ziehen, A–Z / Z–A, Favoriten).

## 2.2.0 · Jun 2026 🔒
- 🇬🇧 Security hardening: full line-by-line review of the container. Added session logout with **server-side JWT revocation** (blocklist), **constant-time login** (no account enumeration via timing), rate-limited vault endpoints + per-user entry cap, key separation, **non-root container**, `Permissions-Policy`, in-memory key zeroing.
- 🇩🇪 Sicherheitshärtung: kompletter Zeile-für-Zeile-Review des Containers. Neu: Logout mit **serverseitiger JWT-Sperre** (Blocklist), **konstante Login-Zeit** (keine Konto-Ausspähung über Timing), rate-limitierte Tresor-Endpunkte + Eintragslimit pro Nutzer, Schlüsseltrennung, **Container ohne Root**, `Permissions-Policy`, Schlüssel werden im Speicher genullt.

## 2.1.0
- 🇬🇧 **Encrypted backup / export** (password-protected, portable, Argon2id + XChaCha20-Poly1305) and an **HTTPS reverse-proxy guide**.
- 🇩🇪 **Verschlüsseltes Backup / Export** (passwortgeschützt, portabel, Argon2id + XChaCha20-Poly1305) und eine **HTTPS-Reverse-Proxy-Anleitung**.
- 📄 [HTTPS.md](docs/HTTPS.md)

## 2.0.9 🔒
- 🇬🇧 Security hardening: rate limiting on login/register, hard-pinned JWT algorithms, server-side KDF minimums, security headers + CSP, ciphertext/ID size limits. Reviewed with the ECC security reviewer.
- 🇩🇪 Sicherheitshärtung: Rate-Limiting bei Login/Registrierung, fest verdrahtete JWT-Algorithmen, serverseitige KDF-Mindestwerte, Security-Header + CSP, Längen-/ID-Limits. Geprüft mit dem ECC-Security-Reviewer.
