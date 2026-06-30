// Vault-Service: verbindet Auth + Krypto + Sync. Hält KEINEN globalen State —
// der VaultKey lebt nur im React-State (Speicher), nie in localStorage.
import { api, setToken } from "./api";
import { decryptJson, deriveAuthHash, deriveMasterKey, encryptJson, generateSalt, generateVaultKey, unwrapKey, wrapKey } from "./crypto";
import type { TotpData } from "./totp";

const DEFAULT_MEM_KIB = 65536;
const DEFAULT_OPS = 3;

export interface DecryptedEntry {
  id: string;
  revision: number;
  data: TotpData;
}

export interface Session {
  email: string;
  vaultKey: Uint8Array;
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function unlock(email: string, password: string): Promise<Session> {
  const pre = await api.prelogin(email);
  const masterKey = await deriveMasterKey(password, pre.kdf_salt, pre.kdf_mem_kib, pre.kdf_ops);
  try {
    const authHash = await deriveAuthHash(masterKey, password);
    const res = await api.login(email, authHash);
    setToken(res.token);
    const vaultKey = await unwrapKey(res.protected_vault_key, masterKey);
    return { email, vaultKey };
  } finally {
    // MasterKey aus dem Speicher räumen, sobald VaultKey ausgepackt ist.
    masterKey.fill(0);
  }
}

export async function register(email: string, password: string): Promise<Session> {
  const salt = await generateSalt();
  const masterKey = await deriveMasterKey(password, salt, DEFAULT_MEM_KIB, DEFAULT_OPS);
  try {
    const authHash = await deriveAuthHash(masterKey, password);
    const vaultKey = await generateVaultKey();
    const protectedVaultKey = await wrapKey(vaultKey, masterKey);
    const res = await api.register({
      email,
      kdf_salt: salt,
      kdf_mem_kib: DEFAULT_MEM_KIB,
      kdf_ops: DEFAULT_OPS,
      auth_hash: authHash,
      protected_vault_key: protectedVaultKey,
    });
    setToken(res.token);
    return { email, vaultKey };
  } finally {
    masterKey.fill(0);
  }
}

export async function loadEntries(vaultKey: Uint8Array): Promise<DecryptedEntry[]> {
  const { entries } = await api.listVault();
  const out: DecryptedEntry[] = [];
  let failed = 0;
  for (const e of entries) {
    if (e.deleted) continue;
    try {
      const data = await decryptJson<TotpData>(e.ciphertext, vaultKey);
      out.push({ id: e.id, revision: e.revision, data });
    } catch {
      // Eintrag mit falschem/anderem Key -> überspringen statt App zu crashen.
      failed += 1;
    }
  }
  if (failed > 0) {
    console.warn(`[SelfAuth] ${failed} Eintrag/Einträge konnten nicht entschlüsselt werden.`);
  }
  out.sort((a, b) =>
    (a.data.issuer || a.data.label).localeCompare(b.data.issuer || b.data.label, "de"),
  );
  return out;
}

export async function addEntry(vaultKey: Uint8Array, data: TotpData): Promise<DecryptedEntry> {
  const id = randomId();
  const ciphertext = await encryptJson(data, vaultKey);
  const res = await api.upsert({ id, ciphertext });
  return { id: res.id, revision: res.revision, data };
}

export async function updateEntry(
  vaultKey: Uint8Array,
  entry: DecryptedEntry,
  patch: Partial<TotpData>,
): Promise<DecryptedEntry> {
  const data = { ...entry.data, ...patch };
  const ciphertext = await encryptJson(data, vaultKey);
  const res = await api.upsert({ id: entry.id, ciphertext, base_revision: entry.revision });
  return { id: res.id, revision: res.revision, data };
}

export async function deleteEntry(id: string): Promise<void> {
  await api.remove(id);
}
