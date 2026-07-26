export type Theme = "light" | "dark";

const STORAGE_KEY = "pg-page-viewer.theme";

export function readSystemTheme(): Theme {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** P1-4: remember manual theme across sessions (no credentials). */
export function loadStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore quota / private mode */
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function applyInitialTheme(): Theme {
  const stored = loadStoredTheme();
  const theme = stored ?? readSystemTheme();
  applyTheme(theme);
  return theme;
}

export { STORAGE_KEY };
