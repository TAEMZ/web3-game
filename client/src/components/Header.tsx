import Link from "next/link";

import HeaderAuth from "./auth/HeaderAuth";
import HeaderNav from "./HeaderNav";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 mx-auto flex w-full max-w-6xl items-center justify-between border-b border-[rgba(201,162,39,0.15)] px-4 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 place-items-center rounded-full border-2 border-[rgba(201,162,39,0.5)] bg-gradient-to-br from-[#1a3a28] to-[#0d1612] text-lg text-[#E8C040]"
          style={{ boxShadow: "0 0 16px rgba(201,162,39,0.2)" }}
        >
          ♔
        </span>
        <span className="font-display gold-text-shimmer text-xl font-black tracking-wider">
          CHESS ARENA
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-6">
        <HeaderNav />
      </nav>

      <div className="flex flex-none items-center gap-2">
        <ThemeToggle />
        <HeaderAuth />
      </div>
    </header>
  );
}
