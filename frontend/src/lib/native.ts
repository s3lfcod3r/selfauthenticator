// Brücke zur nativen Android-App (WebView-JavascriptInterface "SelfAuthNative").
// Im Browser ist nichts davon vorhanden -> alle Helfer degradieren sauber.
interface SelfAuthNative {
  hasScanner?: () => boolean;
  scan?: () => void;
  copy?: (text: string) => void;
  hasBiometric?: () => boolean;
  getVaultKey?: () => string;
  saveVaultKey?: (b64: string) => void;
  clearVaultKey?: () => void;
}

function bridge(): SelfAuthNative | null {
  const w = window as unknown as { SelfAuthNative?: SelfAuthNative };
  return w.SelfAuthNative ?? null;
}

export function hasNativeScanner(): boolean {
  const b = bridge();
  try {
    return !!b && typeof b.scan === "function" && (!b.hasScanner || b.hasScanner());
  } catch {
    return false;
  }
}

export function nativeScan(): void {
  bridge()?.scan?.();
}

// Liefert true, wenn der native Clipboard-Weg genutzt wurde.
export function nativeCopy(text: string): boolean {
  const b = bridge();
  if (b && typeof b.copy === "function") {
    try {
      b.copy(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Biometrie-Unlock: Vault-Key wird in der nativen App biometrie-gated im
// Android-Keystore gehalten. getVaultKey liefert ihn nur nach Fingerabdruck.
export function nativeGetVaultKey(): string | null {
  const b = bridge();
  try {
    const k = b?.getVaultKey?.();
    return k && k.length > 0 ? k : null;
  } catch {
    return null;
  }
}

export function nativeSaveVaultKey(b64: string): void {
  try {
    bridge()?.saveVaultKey?.(b64);
  } catch {
    /* kein nativer Host */
  }
}

export function nativeClearVaultKey(): void {
  try {
    bridge()?.clearVaultKey?.();
  } catch {
    /* kein nativer Host */
  }
}
