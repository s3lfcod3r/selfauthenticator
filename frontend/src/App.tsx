import { useCallback, useEffect, useState } from "react";
import { Unlock } from "./pages/Unlock";
import { VaultView } from "./pages/Vault";
import { loadEntries, type DecryptedEntry, type Session } from "./lib/vault";
import { setToken } from "./lib/api";

type Phase = "locked" | "unlocking" | "unlocked";

export function App() {
  const [phase, setPhase] = useState<Phase>("locked");
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onUnlocked = useCallback(async (s: Session) => {
    setPhase("unlocking");
    setError(null);
    try {
      const loaded = await loadEntries(s.vaultKey);
      setSession(s);
      setEntries(loaded);
      setPhase("unlocked");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte Tresor nicht laden");
      setPhase("locked");
    }
  }, []);

  const lock = useCallback(() => {
    setToken(null);
    setSession(null);
    setEntries([]);
    setPhase("locked");
  }, []);

  // Sicherheit: bei Tab-Schliessen den VaultKey aus dem Speicher nehmen.
  useEffect(() => {
    const onHide = () => {
      /* VaultKey bleibt im RAM waehrend der Sitzung; hier kein Persist noetig */
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  if (phase === "unlocked" && session) {
    return <VaultView session={session} entries={entries} setEntries={setEntries} onLock={lock} />;
  }

  return <Unlock onUnlocked={onUnlocked} busy={phase === "unlocking"} externalError={error} />;
}
