"use client";

import { IconLogout, IconSettings2, IconUserCircle } from "@tabler/icons-react";
import Link from "next/link";
import { useContext } from "react";

import { SessionContext } from "@/context/session";
import { logout } from "@/lib/auth";
import WalletButton from "../wallet/WalletButton";

export default function HeaderAuth() {
  const session = useContext(SessionContext);
  const user = session?.user;

  async function clickLogout() {
    await logout();
    session?.setUser(null);
  }

  // session still loading (initial empty object) — render nothing to avoid flicker
  if (user && Object.keys(user).length === 0) return null;

  if (!user?.id) {
    return (
      <Link href="/login" className="btn-gold" style={{ padding: "9px 22px", fontSize: "0.9rem" }}>
        Sign In
      </Link>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <label
        tabIndex={0}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-[rgba(201,162,39,0.3)] bg-[rgba(13,22,18,0.6)] px-3 py-1.5 transition hover:border-[rgba(201,162,39,0.6)]"
      >
        <IconUserCircle size={20} className="text-[#E8C040]" />
        <span className="max-w-[8rem] truncate text-sm text-[#d8ccb0]">{user.name}</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content glass-dark z-50 mt-2 flex w-60 flex-col gap-1 rounded-xl p-2"
        style={{ border: "1px solid rgba(201,162,39,0.25)" }}
      >
        {/* Wallet = token storage tied to this account. Connect/manage it here. */}
        <li className="px-1 pb-1">
          <p className="mb-1 px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-[rgba(216,204,176,0.4)]">
            Wallet
          </p>
          <WalletButton />
        </li>
        <div className="mx-1 my-1 h-px bg-[rgba(201,162,39,0.12)]" />

        {typeof user.id === "number" && (
          <>
            <li>
              <Link
                href={`/user/${user.name}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#d8ccb0] hover:bg-[rgba(201,162,39,0.12)]"
              >
                <IconUserCircle size={16} /> Profile
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#d8ccb0] hover:bg-[rgba(201,162,39,0.12)]"
              >
                <IconSettings2 size={16} /> Settings
              </Link>
            </li>
          </>
        )}
        <li>
          <button
            onClick={clickLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#e85050] hover:bg-[rgba(184,24,24,0.12)]"
          >
            <IconLogout size={16} /> Logout
          </button>
        </li>
      </ul>
    </div>
  );
}
