"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { startThemeTransition } from "@/lib/themeTransition";

/**
 * Toggles between light and dark theme (persists via ThemeProvider).
 * Uses the View Transitions API when available for a smooth cross-fade.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-10 w-[7.5rem] shrink-0 rounded-lg border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-zinc-800"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const handleToggle = () => {
    const next = isDark ? "light" : "dark";
    startThemeTransition(() => {
      setTheme(next);
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:bg-slate-50 hover:shadow active:scale-[0.98] dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="text-base leading-none" aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
