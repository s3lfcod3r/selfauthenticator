import { useEffect, useMemo, useState } from "react";
import { currentCode, formatCode, type TotpData } from "../lib/totp";
import { nativeCopy } from "../lib/native";
import type { DecryptedEntry } from "../lib/vault";

interface Props {
  entry: DecryptedEntry;
  tick: number;
  onDelete: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  dragEnabled: boolean;
  dragging: boolean;
  onDragStart: (e: React.PointerEvent) => void;
}

const RADIUS = 14;
const CIRC = 2 * Math.PI * RADIUS;

export function TokenCard({
  entry,
  tick,
  onDelete,
  onEdit,
  onToggleFavorite,
  dragEnabled,
  dragging,
  onDragStart,
}: Props) {
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

  // Eigene Farbe faerbt Avatar-Hintergrund (transparent) + Text.
  const avatarStyle = data.color
    ? { background: `${data.color}2e`, color: data.color }
    : undefined;

  return (
    <div className={`token-card${dragging ? " dragging" : ""}`} onClick={copy} title="Antippen zum Kopieren">
      {dragEnabled && (
        <button
          className="token-drag"
          onPointerDown={onDragStart}
          onClick={(e) => e.stopPropagation()}
          title="Zum Sortieren ziehen"
          aria-label="Zum Sortieren ziehen"
        >
          ⠿
        </button>
      )}
      <div className="token-avatar" style={avatarStyle}>
        {data.icon || (data.issuer || data.label || "K").charAt(0).toUpperCase()}
      </div>
      <div className="token-meta">
        <div className="token-issuer">
          {data.favorite && <span className="token-star-tag" aria-hidden>★</span>}
          {data.issuer || data.label || "Konto"}
        </div>
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
        <div className="token-tools">
          <button
            className={`token-fav${data.favorite ? " on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={data.favorite ? "Nicht mehr anheften" : "Anheften"}
            aria-label="Anheften"
          >
            {data.favorite ? "★" : "☆"}
          </button>
          <button
            className="token-edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Bearbeiten"
            aria-label="Bearbeiten"
          >
            ✎
          </button>
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
    </div>
  );
}
