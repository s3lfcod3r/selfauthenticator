import { useEffect, useMemo, useRef, useState } from "react";
import { TokenCard } from "../components/TokenCard";
import { AddAccount } from "../components/AddAccount";
import { EditAccount } from "../components/EditAccount";
import { BackupModal } from "../components/BackupModal";
import { addEntry, deleteEntry, updateEntry, type DecryptedEntry, type Session } from "../lib/vault";
import { parseOtpauthUri, type TotpData } from "../lib/totp";

interface Props {
  session: Session;
  entries: DecryptedEntry[];
  setEntries: React.Dispatch<React.SetStateAction<DecryptedEntry[]>>;
  onLock: () => void;
}

type SortMode = "manual" | "az" | "za";
const SORT_KEY = "selfauth_sort";

function loadSortMode(): SortMode {
  const v = localStorage.getItem(SORT_KEY);
  return v === "az" || v === "za" || v === "manual" ? v : "manual";
}

function alphaKey(e: DecryptedEntry): string {
  return (e.data.issuer || e.data.label || "").toString();
}

// Sortierung: "manual" nutzt das order-Feld (Drag), "az"/"za" sortieren
// alphabetisch und heften Favoriten oben an.
function sortEntries(list: DecryptedEntry[], mode: SortMode): DecryptedEntry[] {
  const alpha = (a: DecryptedEntry, b: DecryptedEntry) =>
    alphaKey(a).localeCompare(alphaKey(b), "de", { sensitivity: "base" });
  if (mode === "manual") {
    return [...list].sort(
      (a, b) =>
        (a.data.order ?? Number.MAX_SAFE_INTEGER) - (b.data.order ?? Number.MAX_SAFE_INTEGER) ||
        alpha(a, b),
    );
  }
  const dir = mode === "za" ? -1 : 1;
  return [...list].sort((a, b) => {
    const fav = (b.data.favorite ? 1 : 0) - (a.data.favorite ? 1 : 0);
    if (fav) return fav;
    return dir * alpha(a, b);
  });
}

export function VaultView({ session, entries, setEntries, onLock }: Props) {
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DecryptedEntry | null>(null);
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Immer aktuelle Einträge für Pointer-Handler (laufen außerhalb des Renders).
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const startOrders = useRef<Map<string, number | undefined>>(new Map());

  // Ein zentraler 1s-Tick für alle Karten (statt Timer pro Karte).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function changeSort(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }

  // Native Android-App ruft nach einem QR-Scan window.__selfauthOnScan(uri).
  // Nur registrieren, wenn wirklich ein nativer Host (SelfAuthNative) vorhanden
  // ist — im reinen Browser bleibt der globale Callback sonst eine Injection-
  // Fläche, über die fremdes Script ungefragt Konten anlegen könnte.
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
        setError(e instanceof Error ? e.message : "QR ungültig");
        return;
      }
      handleAdd(data).catch((e) =>
        setError(e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen"),
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

  const visible = useMemo(() => sortEntries(filtered, sortMode), [filtered, sortMode]);

  const dragEnabled = sortMode === "manual" && !query.trim();

  function nextOrder(): number {
    return entries.reduce((m, e) => Math.max(m, e.data.order ?? -1), -1) + 1;
  }

  async function handleAdd(data: TotpData) {
    setError(null);
    try {
      const entry = await addEntry(session.vaultKey, { ...data, order: nextOrder() });
      setEntries((prev) => [...prev, entry]);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hinzufügen fehlgeschlagen");
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
      setError(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    }
  }

  async function handleImport(list: TotpData[]) {
    setError(null);
    try {
      let order = nextOrder();
      const added: DecryptedEntry[] = [];
      for (const data of list) {
        added.push(await addEntry(session.vaultKey, { ...data, order: order++ }));
      }
      setEntries((prev) => [...prev, ...added]);
      setBackup(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import fehlgeschlagen");
    }
  }

  async function handleSaveEdit(patch: Partial<TotpData>) {
    if (!editing) return;
    setError(null);
    try {
      const updated = await updateEntry(session.vaultKey, editing, patch);
      setEntries((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  async function handleToggleFavorite(entry: DecryptedEntry) {
    const fav = !entry.data.favorite;
    // Optimistisch umschalten, dann serverseitig bestätigen.
    setEntries((prev) =>
      prev.map((p) => (p.id === entry.id ? { ...p, data: { ...p.data, favorite: fav } } : p)),
    );
    try {
      const updated = await updateEntry(session.vaultKey, entry, { favorite: fav });
      setEntries((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      // Rollback bei Fehler.
      setEntries((prev) =>
        prev.map((p) => (p.id === entry.id ? { ...p, data: { ...p.data, favorite: !fav } } : p)),
      );
      setError(e instanceof Error ? e.message : "Anheften fehlgeschlagen");
    }
  }

  // ---- Drag-Reorder (Pointer, Touch-tauglich) ----
  function onDragStart(id: string, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    startOrders.current = new Map(entriesRef.current.map((en) => [en.id, en.data.order]));
    setDraggingId(id);
  }

  useEffect(() => {
    if (!draggingId) return;

    function move(ev: PointerEvent) {
      const list = entriesRef.current;
      const positioned = list
        .map((en) => {
          const el = cardRefs.current.get(en.id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { id: en.id, top: r.top, mid: r.top + r.height / 2 };
        })
        .filter((p): p is { id: string; top: number; mid: number } => p !== null)
        .sort((a, b) => a.top - b.top);

      const ids = positioned.map((p) => p.id);
      const fromIdx = ids.indexOf(draggingId!);
      if (fromIdx === -1) return;
      let toIdx = positioned.findIndex((p) => ev.clientY < p.mid);
      if (toIdx === -1) toIdx = positioned.length - 1;
      if (toIdx === fromIdx) return;

      const newIds = [...ids];
      newIds.splice(fromIdx, 1);
      newIds.splice(toIdx, 0, draggingId!);
      setEntries((prev) =>
        prev.map((en) => {
          const idx = newIds.indexOf(en.id);
          return idx === -1 ? en : { ...en, data: { ...en.data, order: idx } };
        }),
      );
      ev.preventDefault();
    }

    async function persist() {
      const start = startOrders.current;
      const changed = entriesRef.current.filter((e) => start.get(e.id) !== e.data.order);
      for (const e of changed) {
        try {
          const updated = await updateEntry(session.vaultKey, e, { order: e.data.order });
          setEntries((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Reihenfolge speichern fehlgeschlagen");
        }
      }
    }

    function up() {
      setDraggingId(null);
      void persist();
    }

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [draggingId, session]);

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

      {entries.length > 1 && (
        <div className="toolbar">
          {entries.length > 3 && (
            <input
              className="search-input"
              placeholder="Suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          <div className="sort-toggle" role="group" aria-label="Sortierung">
            <button className={sortMode === "manual" ? "active" : ""} onClick={() => changeSort("manual")} title="Eigene Reihenfolge (ziehen)">
              Eigene
            </button>
            <button className={sortMode === "az" ? "active" : ""} onClick={() => changeSort("az")}>
              A–Z
            </button>
            <button className={sortMode === "za" ? "active" : ""} onClick={() => changeSort("za")}>
              Z–A
            </button>
          </div>
        </div>
      )}

      {error && <div className="auth-error">{error}</div>}

      {visible.length === 0 ? (
        <div className="empty">
          {entries.length === 0
            ? "Noch keine Konten. Tippe auf +, um dein erstes 2FA-Konto hinzuzufügen."
            : "Keine Treffer."}
        </div>
      ) : (
        visible.map((e) => (
          <div
            key={e.id}
            ref={(el) => {
              if (el) cardRefs.current.set(e.id, el);
              else cardRefs.current.delete(e.id);
            }}
          >
            <TokenCard
              entry={e}
              tick={tick}
              dragEnabled={dragEnabled}
              dragging={draggingId === e.id}
              onDragStart={(ev) => onDragStart(e.id, ev)}
              onEdit={() => setEditing(e)}
              onToggleFavorite={() => handleToggleFavorite(e)}
              onDelete={() => handleDelete(e.id)}
            />
          </div>
        ))
      )}

      <button className="fab" onClick={() => setAdding(true)} aria-label="Konto hinzufügen">
        +
      </button>

      {adding && <AddAccount onAdd={handleAdd} onClose={() => setAdding(false)} />}
      {editing && (
        <EditAccount entry={editing} onSave={handleSaveEdit} onClose={() => setEditing(null)} />
      )}
      {backup && <BackupModal entries={entries} onImport={handleImport} onClose={() => setBackup(false)} />}
    </div>
  );
}
