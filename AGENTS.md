# AGENTS.md — selfauthenticator

Kurze Orientierung fuer KI-Assistenten (Bonsai/Claude). **Diese Datei zuerst lesen, nicht die grosse README.**
Zum Finden: `rg -n "BEGRIFF"`. Fuer Symbole: Serena `get_symbols_overview`/`find_symbol`. Grosse Dateien nur zeilenweise (`sed -n`).

## Typ & Stack

- Node/JS-TS: `frontend/package.json` (react, vite)
- Python: `backend/requirements.txt`

## Bauen / Testen / Starten

```bash
cd frontend && npm run dev   # vite
cd frontend && npm run build   # tsc -b && vite build
uvicorn <modul>:app   # FastAPI-Server (Details: Dockerfile/README)
python -m pytest -q   # falls Tests vorhanden
```

## Struktur (oberste Ebenen)

- `.github/` — CI/Workflows
- `assets/`
- `backend/` — Server (API)
- `docs/` — Dokumentation
- `frontend/` — Web-Oberflaeche
- `unraid/`

## Einstiegspunkte

- `backend/app/main.py`
- `frontend/src/App.tsx`

---
*Automatisch erzeugt als Navigationshilfe. Bei Bedarf von Hand praeziser machen.*
