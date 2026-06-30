import { useRef, useState } from "react";
import { buildBackup, parseBackup } from "../lib/backup";
import type { DecryptedEntry } from "../lib/vault";
import type { TotpData } from "../lib/totp";
import { useLang } from "../lib/i18n";

interface Props {
  entries: DecryptedEntry[];
  onImport: (list: TotpData[]) => void;
  onClose: () => void;
}

export function BackupModal({ entries, onImport, onClose }: Props) {
  const { t } = useLang();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function switchTab(t: "export" | "import") {
    setTab(t);
    setError(null);
    setInfo(null);
  }

  async function doExport() {
    setError(null);
    setInfo(null);
    if (pw.length < 8) return setError(t("Backup-Passwort: mindestens 8 Zeichen."));
    if (entries.length === 0) return setError(t("Keine Konten zum Sichern."));
    setBusy(true);
    try {
      const json = await buildBackup(entries, pw);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `selfauth-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setInfo(t("Backup heruntergeladen. Datei UND Passwort sicher aufbewahren."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Export fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setFileText(String(reader.result));
    reader.readAsText(f);
  }

  async function doImport() {
    setError(null);
    if (!fileText) return setError(t("Bitte zuerst eine Backup-Datei wählen."));
    if (!pw) return setError(t("Backup-Passwort eingeben."));
    setBusy(true);
    try {
      const list = await parseBackup(fileText, pw);
      onImport(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Import fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <h2>{t("Backup")}</h2>
        <div className="tabs">
          <button className={tab === "export" ? "active" : ""} onClick={() => switchTab("export")}>{t("Exportieren")}</button>
          <button className={tab === "import" ? "active" : ""} onClick={() => switchTab("import")}>{t("Importieren")}</button>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {info && <p className="hint">{info}</p>}

        {tab === "export" ? (
          <>
            <p className="hint">
              Verschlüsselt alle {entries.length} Konten in eine Datei. Mit dem Passwort
              kannst du sie jederzeit (auch in der App) wiederherstellen.
            </p>
            <div className="field">
              <label>{t("Backup-Passwort")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={t("mind. 8 Zeichen")}
              />
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={onClose}>{t("Schließen")}</button>
              <button className="primary" onClick={doExport} disabled={busy}>
                {busy ? "…" : t("Herunterladen")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">{t("Backup-Datei wählen und Backup-Passwort eingeben — Konten werden hinzugefügt.")}</p>
            <div className="field">
              <button className="ghost" onClick={() => fileRef.current?.click()}>
                {fileName || t("Datei wählen…")}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={pickFile}
              />
            </div>
            <div className="field">
              <label>{t("Backup-Passwort")}</label>
              <input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={onClose}>{t("Schließen")}</button>
              <button className="primary" onClick={doImport} disabled={busy}>
                {busy ? "…" : "Importieren"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
