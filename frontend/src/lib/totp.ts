// TOTP-Berechnung im Client (RFC 6238) via otpauth. Codes brauchen nur Zeit+Seed
// -> funktionieren vollstaendig offline.
import { Secret, TOTP, URI } from "otpauth";

export interface TotpData {
  issuer: string;
  label: string;
  secret: string; // Base32
  algorithm: string; // SHA1 | SHA256 | SHA512
  digits: number;
  period: number;
  // --- Optionale Darstellungs-/Sortier-Metadaten ---
  // Werden im verschluesselten Eintrag mitgespeichert (Zero-Knowledge bleibt
  // erhalten) und von der Code-Berechnung ignoriert.
  color?: string; // Akzentfarbe als 6-stelliger Hex (#33a78c)
  icon?: string; // Emoji als Symbol
  favorite?: boolean; // oben angeheftet
  order?: number; // manuelle Reihenfolge (kleiner = weiter oben)
}

export function normalizeSecret(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

export function parseOtpauthUri(uri: string): TotpData {
  const o = URI.parse(uri.trim());
  if (!(o instanceof TOTP)) throw new Error("Nur TOTP wird unterstuetzt (kein HOTP).");
  return {
    issuer: o.issuer ?? "",
    label: o.label ?? "",
    secret: o.secret.base32,
    algorithm: o.algorithm,
    digits: o.digits,
    period: o.period,
  };
}

function makeTotp(d: TotpData): TOTP {
  return new TOTP({
    issuer: d.issuer,
    label: d.label || d.issuer || "Konto",
    algorithm: d.algorithm || "SHA1",
    digits: d.digits || 6,
    period: d.period || 30,
    secret: Secret.fromBase32(normalizeSecret(d.secret)),
  });
}

export interface CodeState {
  code: string;
  remaining: number; // Sekunden bis Rotation
  period: number;
}

export function currentCode(d: TotpData): CodeState {
  const period = d.period || 30;
  const code = makeTotp(d).generate();
  const remaining = period - (Math.floor(Date.now() / 1000) % period);
  return { code, remaining, period };
}

export function formatCode(code: string): string {
  // 6 Ziffern -> "123 456", 8 -> "1234 5678"
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}

export function validSecret(secret: string): boolean {
  try {
    Secret.fromBase32(normalizeSecret(secret));
    return normalizeSecret(secret).length >= 16;
  } catch {
    return false;
  }
}
