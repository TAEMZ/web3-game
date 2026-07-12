"use client";

import { IconChartBar, IconChess, IconShield, IconTrophy } from "@tabler/icons-react";
import type { ComponentType } from "react";
import { useContext } from "react";

import { SessionContext } from "@/context/session";

export type NavLink = {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number | string }>;
};

// Single source of truth for the primary nav, so the desktop bar and the phone
// menu can't drift apart. Admins get an admin-only nav; players get the rest.
export function useNavLinks(): NavLink[] {
  const session = useContext(SessionContext);

  if (session?.user?.is_admin) {
    return [{ href: "/admin", label: "Admin", Icon: IconShield }];
  }

  return [
    { href: "/play", label: "Play", Icon: IconChess },
    { href: "/rewards", label: "Rewards", Icon: IconTrophy },
    { href: "/leaderboard", label: "Leaderboard", Icon: IconChartBar }
  ];
}
