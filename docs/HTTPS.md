# HTTPS für SelfAuthenticator (Reverse-Proxy)

> **Warum HTTPS?** Über reines `http://` sperren Browser aus Sicherheitsgründen
> einige Funktionen (sie brauchen einen „secure context"):
> - **Kamera/QR-Scan** in der Web-Oberfläche (`getUserMedia`)
> - **Tap-to-Copy** (Clipboard-API)
> - **PWA-Offline** (Service-Worker)
>
> Außerdem wird der Verkehr verschlüsselt (kein Mitlesen im Netz). Mit HTTPS wäre
> später auch ein **TWA-APK** (statt der nativen App) möglich.
>
> Die **native Android-App braucht kein HTTPS** — sie funktioniert über LAN-HTTP.
> Diese Anleitung lohnt sich vor allem, wenn du die **Web-Oberfläche** komfortabel
> nutzen oder den Dienst von außen erreichbar machen willst.

SelfAuthenticator selbst macht **kein** TLS — das übernimmt ein **Reverse-Proxy**
davor. Drei gängige Wege:

---

## Option A — Nginx Proxy Manager (am einfachsten, GUI)

1. In Unraid die App **„Nginx-Proxy-Manager"** (NPM) aus den Apps installieren.
2. NPM öffnen (`http://<unraid-ip>:81`, Standard-Login `admin@example.com` / `changeme`).
3. **Proxy Hosts → Add Proxy Host:**
   - **Domain Names:** `auth.deinedomain.de` (eine Subdomain, die auf deine IP zeigt)
   - **Scheme:** `http`
   - **Forward Hostname/IP:** `<unraid-ip>`
   - **Forward Port:** `8091`
   - **Websockets Support:** an
4. Tab **SSL → Request a new SSL Certificate** (Let's Encrypt), **Force SSL** + **HTTP/2** anhaken, E-Mail eintragen, speichern.
5. Fertig: `https://auth.deinedomain.de` zeigt verschlüsselt auf SelfAuthenticator.

> Voraussetzung: eine Domain, deren DNS auf deine (öffentliche oder interne) IP zeigt.
> Für reines LAN siehe Option C.

---

## Option B — SWAG (Let's Encrypt, Konfig-Datei)

1. **SWAG** aus den Unraid-Apps installieren, Domain + DNS-Validierung (z. B. Cloudflare) konfigurieren.
2. Eine Proxy-Conf anlegen, z. B. `proxy-confs/selfauth.subdomain.conf`:

```nginx
server {
    listen 443 ssl;
    server_name auth.*;
    include /config/nginx/ssl.conf;

    location / {
        include /config/nginx/proxy.conf;
        set $upstream_app <unraid-ip>;
        set $upstream_port 8091;
        set $upstream_proto http;
        proxy_pass $upstream_proto://$upstream_app:$upstream_port;
    }
}
```

3. SWAG neu starten. Aufruf: `https://auth.deinedomain.de`.

---

## Option C — Nur LAN, ohne öffentliche Domain (selbstsigniert)

Wenn der Dienst **nur im Heimnetz** läuft und du keine Domain willst, kannst du in
NPM/SWAG ein **selbstsigniertes Zertifikat** nutzen oder ein lokales CA-Zertifikat
(z. B. via `mkcert`) erstellen. Der Browser zeigt dann einmalig eine Warnung
(„nicht vertrauenswürdig"), die du akzeptierst bzw. das CA-Zertifikat installierst.
Die secure-context-Funktionen (Kamera/Copy) sind danach trotzdem freigeschaltet.

**Cloudflare Tunnel** ist eine weitere Variante: kostenloses HTTPS ohne offene Ports,
DNS bei Cloudflare. Tunnel auf `http://<unraid-ip>:8091` zeigen lassen.

---

## Nach dem Umstieg auf HTTPS

- **Web:** einfach `https://auth.deinedomain.de` aufrufen — Kamera, Copy und Offline funktionieren jetzt.
- **Native App:** in der App unter **⋮ → Server ändern** die URL auf `https://auth.deinedomain.de` setzen (funktioniert weiterhin, ist nur sicherer).
- **CORS:** Falls du die WebUI von einer anderen Origin lädst, `SELFAUTH_CORS_ORIGINS` entsprechend setzen. Bei „alles aus einem Container" (Standard) ist nichts zu tun.

> Tipp: Lass den Container weiterhin nur intern auf `8091` lauschen und exponiere
> nach außen **ausschließlich** den Reverse-Proxy (443).
