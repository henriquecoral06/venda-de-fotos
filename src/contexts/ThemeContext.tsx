import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Tema claro/escuro/sistema e cor de destaque, com SSR (TanStack Start) e
// Tailwind v4 (tokens oklch em var(--x)). As chaves de localStorage casam com
// o script anti-FOUC no head do __root.tsx.

export type Theme = "light" | "dark" | "system";
export type AccentColor = "navy" | "green" | "blue" | "violet" | "orange" | "rose";

const THEME_KEY = "painel-tema";
const ACCENT_KEY = "painel-accent";

interface AccentPalette {
  /** --primary no tema claro */
  light: string;
  /** --primary no tema escuro */
  dark: string;
  /** gradiente da marca */
  from: string;
  to: string;
}

export const ACCENT_COLORS: Record<AccentColor, AccentPalette> = {
  green: {
    light: "oklch(0.596 0.127 163.23)",
    dark: "oklch(0.773 0.153 163.22)",
    from: "oklch(0.696 0.149 162.48)",
    to: "oklch(0.773 0.153 163.22)",
  },
  navy: {
    light: "oklch(0.208 0.042 265.755)",
    dark: "oklch(0.929 0.013 255.508)",
    from: "oklch(0.208 0.042 265.755)",
    to: "oklch(0.32 0.05 264)",
  },
  blue: {
    light: "oklch(0.488 0.217 264.38)",
    dark: "oklch(0.714 0.143 254.62)",
    from: "oklch(0.626 0.186 259.6)",
    to: "oklch(0.714 0.143 254.62)",
  },
  violet: {
    light: "oklch(0.542 0.245 293.02)",
    dark: "oklch(0.676 0.186 299.06)",
    from: "oklch(0.602 0.221 292.23)",
    to: "oklch(0.676 0.186 299.06)",
  },
  orange: {
    light: "oklch(0.555 0.146 49)",
    dark: "oklch(0.837 0.164 84.43)",
    from: "oklch(0.669 0.159 57.96)",
    to: "oklch(0.837 0.164 84.43)",
  },
  rose: {
    light: "oklch(0.587 0.222 17.72)",
    dark: "oklch(0.716 0.172 13.29)",
    from: "oklch(0.644 0.216 16.81)",
    to: "oklch(0.716 0.172 13.29)",
  },
};

/* Foregrounds sobre o accent: claro → branco; escuro → tinta escura
   (no dark o primary é claro). */
const FG_LIGHT = "oklch(1 0 0)";
const FG_DARK = "oklch(0.204 0 0)";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (c: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => {},
  accentColor: "green",
  setAccentColor: () => {},
});

function applyAccent(color: AccentColor) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const palette = ACCENT_COLORS[color] ?? ACCENT_COLORS.navy;
  const val = isDark ? palette.dark : palette.light;
  const fg = isDark ? FG_DARK : FG_LIGHT;
  root.style.setProperty("--primary", val);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--ring", val);
  root.style.setProperty("--sidebar-primary", val);
  root.style.setProperty("--sidebar-primary-foreground", fg);
  root.style.setProperty("--sidebar-ring", val);
  root.style.setProperty("--brand-from", palette.from);
  root.style.setProperty("--brand-to", palette.to);
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveClass(t: Theme): "light" | "dark" {
  return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
}

function applyTheme(t: Theme, after?: () => void, forcarClaro = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const target = forcarClaro ? "light" : resolveClass(t);
  const swap = () => {
    root.classList.remove("light", "dark");
    root.classList.add(target);
    after?.();
  };
  const startViewTransition = (
    document as Document & {
      startViewTransition?: (cb: () => void) => {
        ready?: Promise<void>;
        updateCallbackDone?: Promise<void>;
        finished?: Promise<void>;
      };
    }
  ).startViewTransition?.bind(document);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alreadyApplied = root.classList.contains(target);
  if (startViewTransition && !reduced && !alreadyApplied) {
    // Transições abortadas (navegação/toggle rápido, aba oculta) rejeitam as
    // três promises; sem o catch viram unhandled rejection no console.
    const transicao = startViewTransition(swap);
    transicao.ready?.catch(() => {});
    transicao.updateCallbackDone?.catch(() => {});
    transicao.finished?.catch(() => {});
  } else {
    swap();
  }
}

function readStored<T extends string>(key: string, valid: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * `forcarClaro`: a tela renderiza sempre clara (caso da entrada em `/`),
 * sem mexer na preferência salva — ela volta a valer na área logada.
 */
export function ThemeProvider({
  children,
  forcarClaro = false,
}: {
  children: ReactNode;
  forcarClaro?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStored(THEME_KEY, ["light", "dark", "system"] as const, "light"),
  );
  const [accentColor, setAccentState] = useState<AccentColor>(() =>
    readStored(ACCENT_KEY, ["navy", "green", "blue", "violet", "orange", "rose"] as const, "green"),
  );

  useEffect(() => {
    applyTheme(theme, () => applyAccent(accentColor), forcarClaro);
  }, [theme, accentColor, forcarClaro]);

  // Modo system acompanha o SO em tempo real
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system", () => applyAccent(accentColor), forcarClaro);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, accentColor, forcarClaro]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage indisponível (ex.: modo privado) — tema vale só pra sessão */
    }
  };
  const setAccentColor = (c: AccentColor) => {
    setAccentState(c);
    try {
      localStorage.setItem(ACCENT_KEY, c);
    } catch {
      /* idem */
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}

/** true quando o tema efetivo (resolvendo `system`) é escuro. */
export function isEffectiveDark(theme: Theme): boolean {
  return resolveClass(theme) === "dark";
}
