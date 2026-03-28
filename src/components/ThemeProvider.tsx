"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Enables `class`-based dark mode on `<html>` for Tailwind `dark:` variants.
 * Persists choice in localStorage under `resume-matcher-theme`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="resume-matcher-theme"
      themes={["light", "dark"]}
    >
      {children}
    </NextThemesProvider>
  );
}
