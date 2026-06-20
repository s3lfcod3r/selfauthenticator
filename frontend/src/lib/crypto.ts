// Zero-Knowledge-Krypto im Client. Der Server sieht nur die base64-Blobs hier.
//   MasterKey  = Argon2id(master_pw, kdf_salt)
//   AuthHash   = BLAKE2b(MasterKey || master_pw)   -> nur dieser geht zum Server
//   VaultKey   = 32 zufaellige Bytes, mit MasterKey gewrappt (protected_vault_key)
//   Eintraege  = XChaCha20-Poly1305(JSON, key=VaultKey), nonce vorangestellt
import { getSodium } from "./sodium";

const B64 = 1; // sodium.base64_variants.ORIGINAL (Standard-Base64 mit Padding)

export async function generateSalt(): Promise<string> {
  const s = await getSodium();
  return s.to_base64(s.randombytes_buf(s.crypto_pwhash_SALTBYTES), B64);
}

export async function generateVaultKey(): Promise<Uint8Array> {
  const s = await getSodium();
  return s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

export async function deriveMasterKey(
  password: string,
  saltB64: string,
  memKib: number,
  ops: number,
): Promise<Uint8Array> {
  const s = await getSodium();
  const salt = s.from_base64(saltB64, B64).slice(0, s.crypto_pwhash_SALTBYTES);
  return s.crypto_pwhash(
    s.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
    password,
    salt,
    ops,
    memKib * 1024,
    s.crypto_pwhash_ALG_ARGON2ID13,
  );
}

export async function deriveAuthHash(masterKey: Uint8Array, password: string): Promise<string> {
  const s = await getSodium();
  const pw = s.from_string(password);
  const msg = new Uint8Array(masterKey.length + pw.length);
  msg.set(masterKey, 0);
  msg.set(pw, masterKey.length);
  return s.to_base64(s.crypto_generichash(32, msg), B64);
}

async function encryptBytes(plain: Uint8Array, key: Uint8Array): Promise<string> {
  const s = await getSodium();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ct = s.crypto_aead_xchacha20poly1305_ietf_encrypt(plain, null, null, nonce, key);
  const combined = new Uint8Array(nonce.length + ct.length);
  combined.set(nonce, 0);
  combined.set(ct, nonce.length);
  return s.to_base64(combined, B64);
}

async function decryptBytes(blobB64: string, key: Uint8Array): Promise<Uint8Array> {
  const s = await getSodium();
  const raw = s.from_base64(blobB64, B64);
  const n = s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  const nonce = raw.slice(0, n);
  const ct = raw.slice(n);
  return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, null, nonce, key);
}

export async function wrapKey(raw: Uint8Array, masterKey: Uint8Array): Promise<string> {
  return encryptBytes(raw, masterKey);
}

export async function unwrapKey(blobB64: string, masterKey: Uint8Array): Promise<Uint8Array> {
  return decryptBytes(blobB64, masterKey);
}

export async function encryptJson(obj: unknown, key: Uint8Array): Promise<string> {
  const s = await getSodium();
  return encryptBytes(s.from_string(JSON.stringify(obj)), key);
}

export async function decryptJson<T>(blobB64: string, key: Uint8Array): Promise<T> {
  const s = await getSodium();
  return JSON.parse(s.to_string(await decryptBytes(blobB64, key))) as T;
}

// --- Schlüssel <-> Base64 (für nativen Biometrie-Unlock der Android-App) ---
export async function keyToB64(key: Uint8Array): Promise<string> {
  const s = await getSodium();
  return s.to_base64(key, B64);
}

export async function keyFromB64(b64: string): Promise<Uint8Array> {
  const s = await getSodium();
  return s.from_base64(b64, B64);
}
