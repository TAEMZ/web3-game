"use client";

import { IconMenu2, IconX } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useNavLinks } from "./navLinks";

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const links = useNavLinks();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: Event) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 place-items-center rounded-full text-[var(--c-text)] transition-colors hover:bg-[rgb(var(--rgb-gold)_/_0.12)]"
      >
        {open ? <IconX size={22} /> : <IconMenu2 size={22} />}
      </button>

      {/* Opaque, not .glass-dark — a menu floating over page copy has to be
          readable, and the frosted card lets the text underneath bleed through. */}
      {open && (
        <nav
          className="absolute right-0 z-50 mt-2 flex w-52 flex-col gap-1 rounded-xl bg-[rgb(var(--rgb-surface))] p-2 shadow-xl"
          style={{ border: "1px solid rgb(var(--rgb-gold) / 0.25)" }}
        >
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  "flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition-colors " +
                  (active
                    ? "bg-[rgb(var(--rgb-gold)_/_0.14)] text-[var(--c-gold-strong)]"
                    : "text-[rgb(var(--rgb-text)_/_0.8)] hover:bg-[rgb(var(--rgb-gold)_/_0.1)] hover:text-[var(--c-gold-strong)]")
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
