import { useState } from "react";
import type { DecryptedEntry } from "../lib/vault";
import type { TotpData } from "../lib/totp";

interface Props {
  entry: DecryptedEntry;
  onSave: (patch: Partial<TotpData>) => void;
  onClose: () => void;
}

// Marken-nahe Akzentfarben (aus tokens.css) + zwei neutrale Ergaenzungen.
const COLORS = [
  "#33a78c", // teal (Standard)
  "#9dbdd0", // ice
  "#1db8d4", // blue
  "#3fb950", // green
  "#d29922", // yellow
  "#f85149", // red
  "#a371f7", // purple
  "#8a9caa", // grau
];

// Kleine, praxisnahe Emoji-Auswahl fuer 2FA-Konten.
const EMOJIS = [
  "🔐", "🛡️", "🔑", "🌐", "📧", "🐙", "☁️", "💳",
  "🏦", "🎮", "💬", "📱", "🛒", "💼", "🎬", "⭐",
];

export function EditAccount({ entry, onSave, onClose }: Props) {
  const [issuer, setIssuer] = useState(entry.data.issuer);
  const [label, setLabel] = useState(entry.data.label);
  const [color, setColor] = useState<string | undefined>(entry.data.color);
  const [icon, setIcon] = useState<string | undefined>(entry.data.icon);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    if (!issuer.trim() && !label.trim()) {
      return setError("Bitte einen Anbieter oder ein Label angeben.");
    }
    onSave({
      issuer: issuer.trim(),
      label: label.trim(),
      color,
      icon,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Eintrag bearbeiten</h2>

        {error && <div className="auth-error">{error}</div>}

        <div className="field">
          <label>Anbieter (Issuer)</label>
          <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="z. B. GitHub" />
        </div>
        <div className="field">
          <label>Konto / Label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. sven@…" />
        </div>

        <div className="field">
          <label>Symbol</label>
          <div className="emoji-grid">
            <button
              type="button"
              className={`emoji-cell${!icon ? " active" : ""}`}
              onClick={() => setIcon(undefined)}
              title="Kein Symbol (Anfangsbuchstabe)"
            >
              Aa
            </button>
            {EMOJIS.map((e) => (
              <button
                type="button"
                key={e}
                className={`emoji-cell${icon === e ? " active" : ""}`}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Farbe</label>
          <div className="swatch-row">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch${color === c ? " active" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={save}>Speichern</button>
        </div>
      </div>
    </div>
  );
}
