import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { register, unlock, type Session } from "../lib/vault";

interface Props {
  onUnlocked: (s: Session) => void;
  busy: boolean;
  externalError: string | null;
}

export function Unlock({ onUnlocked, busy, externalError }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [allowRegister, setAllowRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .state()
      .then((s) => {
        setAllowRegister(s.allow_registration);
        // Erstinbetriebnahme: noch kein Nutzer -> direkt Registrierung anbieten.
        if (!s.has_users && s.allow_registration) setMode("register");
      })
      .catch(() => undefined);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("E-Mail und Master-Passwort sind erforderlich.");
      return;
    }
    if (mode === "register") {
      if (password.length < 8) {
        setError("Master-Passwort muss mindestens 8 Zeichen haben.");
        return;
      }
      if (password !== confirm) {
        setError("Die Passwoerter stimmen nicht ueberein.");
        return;
      }
    }
    setWorking(true);
    try {
      const session = mode === "register" ? await register(email, password) : await unlock(email, password);
      onUnlocked(session);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setWorking(false);
    }
  }

  const isBusy = busy || working;

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="wordmark">
          Self<span className="accent">Authenticator</span>
        </h1>
        <p className="auth-sub">
          {mode === "register" ? "Neuen Tresor anlegen" : "Tresor entsperren"} · Zero-Knowledge 2FA
        </p>

        {(error || externalError) && <div className="auth-error">{error || externalError}</div>}

        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isBusy}
          />
        </div>
        <div className="field">
          <label htmlFor="pw">Master-Passwort</label>
          <input
            id="pw"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isBusy}
          />
        </div>
        {mode === "register" && (
          <div className="field">
            <label htmlFor="pw2">Master-Passwort wiederholen</label>
            <input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isBusy}
            />
          </div>
        )}

        <button className="primary" type="submit" disabled={isBusy} style={{ width: "100%", marginTop: "0.4rem" }}>
          {isBusy ? "Bitte warten…" : mode === "register" ? "Tresor erstellen" : "Entsperren"}
        </button>

        {mode === "register" && (
          <p className="hint">
            Das Master-Passwort verlaesst dein Geraet nie und kann nicht zurueckgesetzt werden.
            Vergisst du es, sind die Codes unwiederbringlich verschluesselt.
          </p>
        )}

        {allowRegister && (
          <div className="auth-toggle">
            {mode === "login" ? (
              <>
                Noch kein Tresor?
                <button type="button" onClick={() => setMode("register")}>
                  Registrieren
                </button>
              </>
            ) : (
              <>
                Schon registriert?
                <button type="button" onClick={() => setMode("login")}>
                  Anmelden
                </button>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
