"use client";

import { IconShield, IconTrophy, IconChartBar } from "@tabler/icons-react";
import Link from "next/link";
import { useContext } from "react";

import { SessionContext } from "@/context/session";

const linkClass =
    "flex items-center gap-1.5 text-sm font-semibold text-[rgba(216,204,176,0.7)] transition-colors hover:text-[#E8C040]";

export default function HeaderNav() {
    const session = useContext(SessionContext);

    if (session?.user?.is_admin) {
        return (
            <Link href="/admin" className={linkClass}>
                <IconShield size={16} />
                <span>Admin</span>
            </Link>
        );
    }

    return (
        <>
            <Link href="/rewards" className={linkClass}>
                <IconTrophy size={16} />
                <span>Rewards</span>
            </Link>
            <Link href="/leaderboard" className={linkClass}>
                <IconChartBar size={16} />
                <span>Leaderboard</span>
            </Link>
        </>
    );
}
