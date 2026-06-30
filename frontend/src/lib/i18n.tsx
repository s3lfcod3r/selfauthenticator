// Schlanke Mehrsprachigkeit (12 europäische Sprachen) ohne Abhängigkeit.
// Schlüssel = deutscher Originaltext (gettext-Stil): Deutsch braucht keine Tabelle
// (Fallback = Schlüssel), die übrigen Sprachen sind Wörterbücher.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { en } from "./i18n/en";
import { fr } from "./i18n/fr";
import { es } from "./i18n/es";
import { it } from "./i18n/it";
import { nl } from "./i18n/nl";
import { pl } from "./i18n/pl";
import { pt } from "./i18n/pt";
import { sv } from "./i18n/sv";
import { da } from "./i18n/da";
import { cs } from "./i18n/cs";
import { el } from "./i18n/el";
import { en2 } from "./i18n/en2";
import { fr2 } from "./i18n/fr2";
import { es2 } from "./i18n/es2";
import { it2 } from "./i18n/it2";
import { nl2 } from "./i18n/nl2";
import { pl2 } from "./i18n/pl2";
import { pt2 } from "./i18n/pt2";
import { sv2 } from "./i18n/sv2";
import { da2 } from "./i18n/da2";
import { cs2 } from "./i18n/cs2";
import { el2 } from "./i18n/el2";

export interface LangMeta {
  code: string;
  label: string;
}

export const LANGS: LangMeta[] = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "pt", label: "Português" },
  { code: "sv", label: "Svenska" },
  { code: "da", label: "Dansk" },
  { code: "cs", label: "Čeština" },
  { code: "el", label: "Ελληνικά" },
];

const LANG_CODES = LANGS.map((l) => l.code);
const DICTS: Record<string, Record<string, string>> = {
  en: { ...en, ...en2 },
  fr: { ...fr, ...fr2 },
  es: { ...es, ...es2 },
  it: { ...it, ...it2 },
  nl: { ...nl, ...nl2 },
  pl: { ...pl, ...pl2 },
  pt: { ...pt, ...pt2 },
  sv: { ...sv, ...sv2 },
  da: { ...da, ...da2 },
  cs: { ...cs, ...cs2 },
  el: { ...el, ...el2 },
};
const STORAGE_KEY = "selfauth.lang";

function initialLang(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LANG_CODES.includes(stored)) return stored;
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  if (nav && LANG_CODES.includes(nav)) return nav;
  return "de";
}

type LangCtx = { lang: string; setLang: (l: string) => void; t: (de: string) => string };

const LangContext = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<string>(initialLang);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = (de: string) => (lang === "de" ? de : DICTS[lang]?.[de] ?? de);
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

export function LangPicker({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <select
      className={className}
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      aria-label="Sprache"
      title="Sprache"
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
