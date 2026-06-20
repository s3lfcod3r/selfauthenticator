// Zentrale libsodium-Initialisierung. Alle Krypto-Funktionen warten auf ready().
import _sodium from "libsodium-wrappers-sumo";

let ready: Promise<typeof _sodium> | null = null;

export async function getSodium(): Promise<typeof _sodium> {
  if (!ready) {
    ready = _sodium.ready.then(() => _sodium);
  }
  return ready;
}
