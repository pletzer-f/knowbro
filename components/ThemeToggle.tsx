"use client";

// Light (warm paper, default reading surface) ↔ dark (deep ink, focused
// analysis). Persists to localStorage; the no-flash script in layout.tsx
// applies the saved theme before paint.

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("kb-theme", next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button type="button" className="kb-mini" onClick={toggle} title="Toggle light / dark" aria-label="Toggle theme">
      {theme === "light" ? "◐ dark" : "◑ light"}
    </button>
  );
}
