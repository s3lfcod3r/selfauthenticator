// Verschluesseltes Export/Backup der Konten. Format ist plattform-kompatibel
// zur nativen App: Argon2id(password, salt) -> Key, XChaCha20-Poly1305(JSON der
// TotpData-Liste). Datei = JSON mit salt + data (nonce||ciphertext, base64).
import { decryptJson, deriveMasterKey, encryptJson, generateSalt } from "./crypto";
import type { TotpData } from "./totp";
import type { DecryptedEntry } from "./vault";

const FORMAT = "selfauth-backup";
const MEM_KIB = 65536;
const OPS = 3;
// Grenzen fuer KDF-Parameter aus einer (nicht vertrauenswuerdigen) Backup-Datei,
// damit ein manipuliertes mem_kib nicht den Tab per OOM lahmlegt.
const MIN_MEM_KIB = 8192;
const MAX_MEM_KIB = 1048576; // 1 GiB
const MIN_OPS = 1;
const MAX_OPS = 10;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.max(Math.floor(value), min), max);
}

interface BackupFile {
  format: string;
  version: number;
  kdf: string;
  mem_kib: number;
  ops: number;
  salt: string;
  data: string;
}

export async function buildBackup(entries: DecryptedEntry[], password: string): Promise<string> {
  const salt = await generateSalt();
  const key = await deriveMasterKey(password, salt, MEM_KIB, OPS);
  const payload: TotpData[] = entries.map((e) => e.data);
  const data = await encryptJson(payload, key);
  const file: BackupFile = {
    format: FORMAT,
    version: 1,
    kdf: "argon2id",
    mem_kib: MEM_KIB,
    ops: OPS,
    salt,
    data,
  };
  return JSON.stringify(file, null, 2);
}

export async function parseBackup(text: string, password: string): Promise<TotpData[]> {
  let file: BackupFile;
  try {
    file = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error("Datei ist kein gueltiges JSON.");
  }
  if (file.format !== FORMAT || !file.salt || !file.data) {
    throw new Error("Keine SelfAuthenticator-Backup-Datei.");
  }
  const memKib = clamp(file.mem_kib, MIN_MEM_KIB, MAX_MEM_KIB, MEM_KIB);
  const ops = clamp(file.ops, MIN_OPS, MAX_OPS, OPS);
  const key = await deriveMasterKey(password, file.salt, memKib, ops);
  try {
    const list = await decryptJson<TotpData[]>(file.data, key);
    if (!Array.isArray(list)) throw new Error("bad");
    return list;
  } catch {
    throw new Error("Falsches Backup-Passwort oder beschaedigte Datei.");
  }
}
