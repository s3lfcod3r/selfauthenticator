import { useCallback, useEffect, useState } from "react";
import { Unlock } from "./pages/Unlock";
import { VaultView } from "./pages/Vault";
import { loadEntries, type DecryptedEntry, type Session } from "./lib/vault";
import { getToken, setToken } from "./lib/api";
import { keyFromB64, keyToB64 } from "./lib/crypto";
import { nativeClearVaultKey, nativeGetVaultKey, nativeSaveVaultKey } from "./lib/native";

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
      // Vault-Key für künftigen Biometrie-Unlock in der nativen App sichern.
      try {
        nativeSaveVaultKey(await keyToB64(s.vaultKey));
      } catch {
        /* kein nativer Host */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Konnte Tresor nicht laden");
      setPhase("locked");
    }
  }, []);

  const lock = useCallback(() => {
    setToken(null);
    nativeClearVaultKey();
    setSession(null);
    setEntries([]);
    setPhase("locked");
  }, []);

  // Biometrie-Unlock (native App): Fingerabdruck gibt den gespeicherten Vault-Key
  // frei -> direkter Einstieg ohne Master-Passwort, sofern das Token noch gilt.
  useEffect(() => {
    const token = getToken();
    const keyB64 = nativeGetVaultKey();
    if (!token || !keyB64) return;
    let cancelled = false;
    setPhase("unlocking");
    (async () => {
      try {
        const vaultKey = await keyFromB64(keyB64);
        const loaded = await loadEntries(vaultKey);
        if (cancelled) return;
        setSession({ email: "", vaultKey });
        setEntries(loaded);
        setPhase("unlocked");
      } catch {
        if (cancelled) return;
        nativeClearVaultKey();
        setPhase("locked");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === "unlocked" && session) {
    return <VaultView session={session} entries={entries} setEntries={setEntries} onLock={lock} />;
  }

  return <Unlock onUnlocked={onUnlocked} busy={phase === "unlocking"} externalError={error} />;
}
