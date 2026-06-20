import { useEffect, useMemo, useState } from "react";
import { TokenCard } from "../components/TokenCard";
import { AddAccount } from "../components/AddAccount";
import { addEntry, deleteEntry, type DecryptedEntry, type Session } from "../lib/vault";
import type { TotpData } from "../lib/totp";

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
  const [error, setError] = useState<string | null>(null);

  // Ein zentraler 1s-Tick fuer alle Karten (statt Timer pro Karte).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand wordmark">
          Self<span className="accent">Auth</span>
        </span>
        <div className="actions">
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
    </div>
  );
}
