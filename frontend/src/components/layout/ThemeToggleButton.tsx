"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MonitorSmartphone, Moon, Sun } from "lucide-react";

type ThemeToggleButtonProps = {
  variant?: "compact" | "pill";
  behavior?: "binary" | "cycle";
  className?: string;
};

export function ThemeToggleButton({
  variant = "compact",
  behavior = "cycle",
  className = "",
}: ThemeToggleButtonProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const visibleTheme = theme === "system" ? (resolvedTheme ?? "light") : theme;
  const title = `Tema actual: ${theme === "system" ? "Sistema" : theme === "dark" ? "Oscuro" : "Claro"}`;

  function cycleTheme() {
    if (behavior === "binary") {
      setTheme(visibleTheme === "dark" ? "light" : "dark");
      return;
    }

    setTheme(theme === "system" ? "dark" : theme === "dark" ? "light" : "system");
  }

  const iconSize = variant === "pill" ? "h-3 w-3" : "h-4 w-4";
  const icon =
    behavior === "cycle" && theme === "system" ? (
      <MonitorSmartphone className={iconSize} />
    ) : visibleTheme === "dark" ? (
      <Moon className={iconSize} />
    ) : (
      <Sun className={iconSize} />
    );

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={cycleTheme}
        title={title}
        aria-label="Alternar tema"
        className={`relative flex h-8 w-16 items-center rounded-full border border-outline-variant bg-surface-container-high p-0.5 transition-colors hover:border-primary ${className}`}
      >
        <span
          className={`absolute flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-elevation-1 transition-transform duration-300 ${
            visibleTheme === "dark" ? "translate-x-8" : "translate-x-0"
          }`}
        >
          {icon}
        </span>
        <Sun className="ml-1 h-3 w-3 text-on-surface-variant opacity-60" />
        <Moon className="ml-auto mr-1 h-3 w-3 text-on-surface-variant opacity-60" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={title}
      aria-label="Alternar tema"
      className={`icon-button-surface h-10 w-10 rounded-full shadow-elevation-1 ${className}`}
    >
      {icon}
    </button>
  );
}
