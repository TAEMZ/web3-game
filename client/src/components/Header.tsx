import Link from "next/link";

import HeaderAuth from "./auth/HeaderAuth";
import HeaderNav from "./HeaderNav";
import MobileNav from "./MobileNav";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-2 border-b border-[rgb(var(--rgb-gold)_/_0.15)] px-4 py-3 backdrop-blur">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-[rgb(var(--rgb-gold)_/_0.5)] bg-gradient-to-br from-[#1a3a28] to-[#0d1612] text-lg text-[var(--c-gold-strong)]"
          style={{ boxShadow: "0 0 16px rgb(var(--rgb-gold) / 0.2)" }}
        >
          ♔
        </span>
        {/* No room for the wordmark next to the auth cluster on a phone, and
            letting it truncate reads as "CHESS …". The crest carries the brand. */}
        <span className="font-display gold-text-shimmer hidden text-xl font-black tracking-wider sm:inline">
          CHESS ARENA
        </span>
      </Link>

      <nav className="hidden items-center gap-6 md:flex">
        <HeaderNav />
      </nav>

      <div className="flex flex-none items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <HeaderAuth />
        <MobileNav />
      </div>
    </header>
  );
}
