"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = (document.body.dataset.theme as Theme) || "dark";
    setTheme(t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") document.body.dataset.theme = "light";
    else delete document.body.dataset.theme;
    try { localStorage.setItem("rs-theme", next); } catch {}
  };

  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="chip"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      style={{ padding: "9px 11px", fontSize: 13, lineHeight: 1, flexShrink: 0, cursor: "pointer" }}
    >
      {isDark ? "☀" : "☾"}
    </button>
  );
}
