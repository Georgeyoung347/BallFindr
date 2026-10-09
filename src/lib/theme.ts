/**
 * Light/dark theme hook persisted in localStorage ('ballfindr-theme'); the initial theme is applied by a script in __root.
 */
import { useEffect, useState } from "react";

export type BallFindrTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "ballfindr-theme";
export const THEME_CHANGE_EVENT = "ballfindr-theme-change";

function isTheme(value: string | null): value is BallFindrTheme {
  return value === "dark" || value === "light";
}

export function readTheme(): BallFindrTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(theme: BallFindrTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<BallFindrTheme>("dark");

  useEffect(() => {
    setThemeState(readTheme());

    const syncTheme = () => setThemeState(readTheme());
    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  function setTheme(nextTheme: BallFindrTheme) {
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return { theme, setTheme };
}