import { useEffect, useMemo, useState } from "react";
import { currentCode, formatCode, type TotpData } from "../lib/totp";
import { nativeCopy } from "../lib/native";
import type { DecryptedEntry } from "../lib/vault";

interface Props {
  entry: DecryptedEntry;
  tick: number;
  onDelete: () => void;
}

const RADIUS = 14;
const CIRC = 2 * Math.PI * RADIUS;

export function TokenCard({ entry, tick, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const data: TotpData = entry.data;

  // tick erzwingt Neuberechnung jede Sekunde.
  const { code, remaining, period } = useMemo(() => currentCode(data), [data, tick]);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Über HTTP kein Web-Clipboard -> native Brücke der Android-App nutzen.
      if (nativeCopy(code)) setCopied(true);
    }
  }

  const offset = CIRC * (1 - remaining / period);
  const low = remaining <= 5;

  return (
    <div className="token-card" onClick={copy} title="Antippen zum Kopieren">
      <div className="token-avatar">{(data.issuer || data.label || "K").charAt(0).toUpperCase()}</div>
      <div className="token-meta">
        <div className="token-issuer">{data.issuer || data.label || "Konto"}</div>
        {data.label && data.issuer && <div className="token-label">{data.label}</div>}
      </div>
      <div className="token-right">
        <span className={`token-code${copied ? " copied" : ""}`}>
          {copied ? "kopiert" : formatCode(code)}
        </span>
        <svg className={`ring${low ? " low" : ""}`} viewBox="0 0 34 34">
          <circle className="bg" cx="17" cy="17" r={RADIUS} />
          <circle
            className="fg"
            cx="17"
            cy="17"
            r={RADIUS}
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <button
          className="token-del"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Entfernen"
          aria-label="Entfernen"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
