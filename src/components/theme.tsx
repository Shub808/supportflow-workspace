"use client";

import { useEffect, useSyncExternalStore } from "react";

export const THEME_KEY = "supportflow.theme";
const CHANGE_EVENT = "supportflow:theme-change";

export type ThemeChoice = "light" | "dark" | "system";
type Resolved = "light" | "dark";

/** Applies the stored theme before first paint so there is no flash. */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle(
      "dark",
      stored === "dark" || ((!stored || stored === "system") && prefersDark)
    );
  } catch (e) {}
})();
`.trim();

function read(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

function resolve(): Resolved {
  const choice = read();
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const OPTIONS: { value: ThemeChoice; label: string; glyph: string }[] = [
  { value: "light", label: "Light", glyph: "☀" },
  { value: "dark", label: "Dark", glyph: "☾" },
  { value: "system", label: "System", glyph: "⌁" },
];

/**
 * The theme lives in `localStorage` and the OS media query — both external
 * stores — so it is read with `useSyncExternalStore` rather than mirrored into
 * React state inside an effect.
 */
export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as const);
  const resolved = useSyncExternalStore(
    subscribe,
    resolve,
    () => "light" as const,
  );

  useEffect(() => {
    // Re-read rather than trusting the hydration-pass value, which uses the
    // server snapshot and would briefly undo the pre-paint bootstrap.
    document.documentElement.classList.toggle("dark", resolve() === "dark");
  }, [resolved]);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.label}
            onClick={() => {
              try {
                localStorage.setItem(THEME_KEY, option.value);
              } catch {
                /* preference will not persist */
              }
              window.dispatchEvent(new Event(CHANGE_EVENT));
            }}
            className={
              selected
                ? "flex size-7 items-center justify-center rounded-full bg-accent-600 text-sm text-white"
                : "flex size-7 items-center justify-center rounded-full text-sm text-muted hover:bg-surface-muted hover:text-ink"
            }
          >
            <span aria-hidden="true">{option.glyph}</span>
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
