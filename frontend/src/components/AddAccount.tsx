import { useEffect, useRef, useState } from "react";
import { normalizeSecret, parseOtpauthUri, validSecret, type TotpData } from "../lib/totp";
import { hasNativeScanner, nativeScan } from "../lib/native";

type Tab = "scan" | "uri" | "manual";

interface Props {
  onAdd: (data: TotpData) => void;
  onClose: () => void;
}

export function AddAccount({ onAdd, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("manual");
  const [error, setError] = useState<string | null>(null);

  // URI-Tab
  const [uri, setUri] = useState("");
  // Manual-Tab
  const [issuer, setIssuer] = useState("");
  const [label, setLabel] = useState("");
  const [secret, setSecret] = useState("");

  function submitUri() {
    setError(null);
    try {
      onAdd(parseOtpauthUri(uri));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ungültige otpauth-URI");
    }
  }

  function submitManual() {
    setError(null);
    if (!issuer.trim()) return setError("Anbieter/Name ist erforderlich.");
    if (!validSecret(secret)) return setError("Secret ist kein gültiger Base32-Schlüssel.");
    onAdd({
      issuer: issuer.trim(),
      label: label.trim(),
      secret: normalizeSecret(secret),
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Konto hinzufügen</h2>
        <div className="tabs">
          <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>
            Manuell
          </button>
          <button className={tab === "uri" ? "active" : ""} onClick={() => setTab("uri")}>
            otpauth-URI
          </button>
          <button className={tab === "scan" ? "active" : ""} onClick={() => setTab("scan")}>
            QR scannen
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {tab === "manual" && (
          <>
            <div className="field">
              <label>Anbieter (Issuer)</label>
              <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="z. B. GitHub" />
            </div>
            <div className="field">
              <label>Konto / Label (optional)</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. sven@…" />
            </div>
            <div className="field">
              <label>Secret (Base32)</label>
              <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="JBSWY3DPEHPK3PXP" autoCapitalize="characters" />
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={onClose}>Abbrechen</button>
              <button className="primary" onClick={submitManual}>Hinzufügen</button>
            </div>
          </>
        )}

        {tab === "uri" && (
          <>
            <div className="field">
              <label>otpauth:// URI</label>
              <input value={uri} onChange={(e) => setUri(e.target.value)} placeholder="otpauth://totp/…" />
            </div>
            <p className="hint">Aus „Schlüssel manuell exportieren" der jeweiligen App, oder QR-Inhalt einfügen.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={onClose}>Abbrechen</button>
              <button className="primary" onClick={submitUri}>Hinzufügen</button>
            </div>
          </>
        )}

        {tab === "scan" &&
          (hasNativeScanner() ? (
            <>
              <p className="hint">Tippe auf „Kamera öffnen" und halte den QR-Code des Kontos in den Rahmen.</p>
              <div className="modal-actions">
                <button className="ghost" onClick={onClose}>Abbrechen</button>
                <button className="primary" onClick={() => nativeScan()}>Kamera öffnen</button>
              </div>
            </>
          ) : (
            <QrScan onText={(t) => { setUri(t); try { onAdd(parseOtpauthUri(t)); } catch (e) { setError(e instanceof Error ? e.message : "QR ungültig"); setTab("uri"); } }} onError={(m) => { setError(m); setTab("uri"); }} onClose={onClose} />
          ))}
      </div>
    </div>
  );
}

function QrScan({ onText, onError, onClose }: { onText: (t: string) => void; onError: (m: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, ctrl) => {
          if (result && !cancelled) {
            ctrl.stop();
            onText(result.getText());
          }
        });
        stop = () => controls.stop();
      } catch {
        onError("Kamera nicht verfügbar — bitte URI manuell einfügen.");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onText, onError]);

  return (
    <>
      <video ref={videoRef} className="scan-video" muted playsInline />
      <p className="hint">QR-Code der Authenticator-Einrichtung vor die Kamera halten.</p>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>Abbrechen</button>
      </div>
    </>
  );
}
