import type { Theme } from "./theme";

export function ThemeGlyph({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg
        className="chrome-theme__icon"
        viewBox="0 0 16 16"
        aria-hidden="true"
        data-theme-icon="moon"
      >
        <path
          fill="currentColor"
          d="M13.2 10.3A6.2 6.2 0 0 1 6.1 2.4a.4.4 0 0 0-.52-.5A7 7 0 1 0 14.1 11a.4.4 0 0 0-.5-.52 5 5 0 0 1-.4-.18z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="chrome-theme__icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      data-theme-icon="sun"
    >
      <circle cx="8" cy="8" r="2.6" fill="currentColor" />
      <path
        fill="currentColor"
        d="M7.5 1h1v2h-1zm0 12h1v2h-1zM1 7.5h2v1H1zm12 0h2v1h-2zM3.05 2.34l.7-.7 1.42 1.41-.7.71zm7.78 7.78.7-.7 1.42 1.41-.71.71zM2.34 12.95l.7.7 1.42-1.41-.71-.71zm7.78-7.78.71.7 1.41-1.41-.7-.71z"
      />
    </svg>
  );
}
