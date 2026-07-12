"use client";

import Link from "next/link";

import { useNavLinks } from "./navLinks";

// Desktop nav. The phone equivalent is <MobileNav>; both render the same list
// from useNavLinks() so they can't drift apart.
export default function HeaderNav() {
  const links = useNavLinks();

  return (
    <>
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-1.5 text-sm font-semibold text-[rgb(var(--rgb-text)_/_0.7)] transition-colors hover:text-[var(--c-gold-strong)]"
        >
          <Icon size={16} />
          <span>{label}</span>
        </Link>
      ))}
    </>
  );
}
