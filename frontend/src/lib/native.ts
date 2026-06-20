// Brücke zur nativen Android-App (WebView-JavascriptInterface "SelfAuthNative").
// Im Browser ist nichts davon vorhanden -> alle Helfer degradieren sauber.
interface SelfAuthNative {
  hasScanner?: () => boolean;
  scan?: () => void;
  copy?: (text: string) => void;
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
