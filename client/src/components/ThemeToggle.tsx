"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [darkTheme, setDarkTheme] = useState(true);

  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "arenaDark") {
      setDarkTheme(true);
    } else {
      setDarkTheme(false);
    }
  }, []);

  function toggleTheme() {
    if (
      document.documentElement.getAttribute("data-theme") === "arenaDark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "arenaLight");
      localStorage.theme = "light";
      setDarkTheme(false);
    } else {
      document.documentElement.setAttribute("data-theme", "arenaDark");
      localStorage.theme = "dark";
      setDarkTheme(true);
    }
  }
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggleTheme}
      className={"btn btn-ghost btn-circle swap swap-rotate" + (darkTheme ? " swap-active" : "")}
    >
      <IconSun className="swap-on m-auto block h-full" />
      <IconMoon className="swap-off m-auto block h-full" />
    </button>
  );
}
