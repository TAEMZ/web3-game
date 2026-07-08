"use client";

import { IconShield, IconTrophy } from "@tabler/icons-react";
import Link from "next/link";
import { useContext } from "react";

import { SessionContext } from "@/context/session";

// Admins get an admin-only nav; players get the Rewards link. Keeps the two
// roles' navigation separate.
export default function HeaderNav() {
  const session = useContext(SessionContext);
  const linkClass =
    "flex items-center gap-1.5 text-sm font-semibold text-[rgba(216,204,176,0.7)] transition-colors hover:text-[#E8C040]";

  if (session?.user?.is_admin) {
    return (
      <Link href="/admin" className={linkClass}>
        <IconShield size={16} />
        <span>Admin</span>
      </Link>
    );
  }

  return (
    <Link href="/rewards" className={linkClass}>
      <IconTrophy size={16} />
      <span>Rewards</span>
    </Link>
  );
}
