import type { Theme } from "./theme";

export function chromeToggleClass(on: boolean): string {
  return on ? "chrome-toggle chrome-toggle--on" : "chrome-toggle";
}

export function themeToggleLabel(theme: Theme): string {
  return theme === "light" ? "Switch to dark theme" : "Switch to light theme";
}
