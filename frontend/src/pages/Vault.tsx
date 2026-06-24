import { useEffect, useMemo, useState } from "react";
import { TokenCard } from "../components/TokenCard";
import { AddAccount } from "../components/AddAccount";
import { BackupModal } from "../components/BackupModal";
import { addEntry, deleteEntry, type DecryptedEntry, type Session } from "../lib/vault";
import { parseOtpauthUri, type TotpData } from "../lib/totp";

interface Props {
  session: Session;
  entries: DecryptedEntry[];
  setEntries: React.Dispatch<React.SetStateAction<DecryptedEntry[]>>;
  onLock: () => void;
}

export function VaultView({ session, entries, setEntries, onLock }: Props) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ein zentraler 1s-Tick fuer alle Karten (statt Timer pro Karte).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Native Android-App ruft nach einem QR-Scan window.__selfauthOnScan(uri).
  // Nur registrieren, wenn wirklich ein nativer Host (SelfAuthNative) vorhanden
  // ist — im reinen Browser bleibt der globale Callback sonst eine Injection-
  // Flaeche, ueber die fremdes Script ungefragt Konten anlegen koennte.
  useEffect(() => {
    const w = window as unknown as {
      __selfauthOnScan?: (uri: string) => void;
      SelfAuthNative?: unknown;
    };
    if (!w.SelfAuthNative) return;
    w.__selfauthOnScan = (uri: string) => {
      let data: TotpData;
      try {
        data = parseOtpauthUri(uri);
      } catch (e) {
        setError(e instanceof Error ? e.message : "QR ungueltig");
        return;
      }
      handleAdd(data).catch((e) =>
        setError(e instanceof Error ? e.message : "Hinzufuegen fehlgeschlagen"),
      );
    };
    return () => {
      delete w.__selfauthOnScan;
    };
  }, [session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      `${e.data.issuer} ${e.data.label}`.toLowerCase().includes(q),
    );
  }, [entries, query]);

  async function handleAdd(data: TotpData) {
    setError(null);
    try {
      const entry = await addEntry(session.vaultKey, data);
      setEntries((prev) =>
        [...prev, entry].sort((a, b) =>
          (a.data.issuer || a.data.label).localeCompare(b.data.issuer || b.data.label, "de"),
        ),
      );
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hinzufuegen fehlgeschlagen");
    }
  }

  async function handleDelete(id: string) {
    const target = entries.find((e) => e.id === id);
    const name = target ? target.data.issuer || target.data.label : "diesen Eintrag";
    if (!confirm(`"${name}" wirklich entfernen?`)) return;
    setError(null);
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loeschen fehlgeschlagen");
    }
  }

  async function handleImport(list: TotpData[]) {
    setError(null);
    try {
      const added: DecryptedEntry[] = [];
      for (const data of list) {
        added.push(await addEntry(session.vaultKey, data));
      }
      setEntries((prev) =>
        [...prev, ...added].sort((a, b) =>
          (a.data.issuer || a.data.label).localeCompare(b.data.issuer || b.data.label, "de"),
        ),
      );
      setBackup(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          <img className="brand-logo" src="/shield.png" alt="" />
          <span className="wordmark">
            <span className="ice">Self</span><span className="accent">Auth</span>
          </span>
        </span>
        <div className="actions">
          <button className="ghost" onClick={() => setBackup(true)} title="Backup / Wiederherstellen">
            Backup
          </button>
          <button className="ghost" onClick={onLock} title="Tresor sperren">
            Sperren
          </button>
        </div>
      </header>

      {entries.length > 3 && (
        <div className="search">
          <input
            placeholder="Suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}

      {filtered.length === 0 ? (
        <div className="empty">
          {entries.length === 0
            ? "Noch keine Konten. Tippe auf +, um dein erstes 2FA-Konto hinzuzufuegen."
            : "Keine Treffer."}
        </div>
      ) : (
        filtered.map((e) => (
          <TokenCard key={e.id} entry={e} tick={tick} onDelete={() => handleDelete(e.id)} />
        ))
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Konto hinzufuegen">
        +
      </button>

      {adding && <AddAccount onAdd={handleAdd} onClose={() => setAdding(false)} />}
      {backup && <BackupModal entries={entries} onImport={handleImport} onClose={() => setBackup(false)} />}
    </div>
  );
}
