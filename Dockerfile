# Stage 1: Frontend (PWA) bauen
FROM node:22-bookworm-slim AS frontend
WORKDIR /fe
COPY frontend/package*.json ./
# npm ci -> exakt nach package-lock.json (reproduzierbar), schlaegt bei Drift fehl.
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: FastAPI-Runtime + gebautes Frontend
FROM python:3.13-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    SELFAUTH_DB_PATH=/data/selfauthenticator.db \
    SELFAUTH_WEB_DIR=/app/frontend/dist
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /fe/dist ./frontend/dist
# Als non-root laufen. UID/GID 99:100 = Unraid 'nobody:users', damit der
# gebindmountete /data-Ordner (typischerweise 99:100) beschreibbar bleibt.
# WICHTIG bei bestehender Installation: einmalig auf dem Host `chown -R 99:100`
# fuer den Data-Ordner ausfuehren, sonst kann die DB nicht geschrieben werden.
RUN useradd --uid 99 --gid 100 --no-create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /data && chown -R 99:100 /app /data
USER 99:100
VOLUME ["/data"]
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8091/api/health').status==200 else 1)"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
