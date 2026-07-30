import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
type Resolved = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | undefined>(undefined);
const STORAGE_KEY = "qevrix-theme";

function systemPref(): Resolved {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: Resolved) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<Resolved>("light");

  useEffect(() => {
    const stored = (typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null) as Theme | null;
    const initial: Theme = stored ?? "system";
    setThemeState(initial);
    const r = initial === "system" ? systemPref() : initial;
    setResolved(r);
    apply(r);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: Resolved = mql.matches ? "dark" : "light";
      setResolved(r);
      apply(r);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    try { window.localStorage.setItem(STORAGE_KEY, t); } catch {}
    const r = t === "system" ? systemPref() : t;
    setResolved(r);
    apply(r);
  }

  function toggle() { setTheme(resolved === "dark" ? "light" : "dark"); }

  return <Ctx.Provider value={{ theme, resolved, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
