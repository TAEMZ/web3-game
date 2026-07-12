"use client";

import { IconEye, IconSwords } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useContext, useTransition } from "react";

import { SessionContext } from "@/context/session";

// One live/open game in the lobby. Click to watch (both seats filled) or join
// (an open seat). Navigating to the game auto-joins you as a spectator if it's
// already full.
export default function GameRow({
  code,
  white,
  black,
  whiteId,
  blackId,
  mode,
  stake,
}: {
  code: string;
  white?: string;
  black?: string;
  whiteId?: string | number;
  blackId?: string | number;
  mode?: "casual" | "wager";
  stake?: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const session = useContext(SessionContext);

  // Don't list the viewer's own in-progress game — you shouldn't "spectate" yourself.
  const uid = session?.user?.id;
  if (uid != null && (uid === whiteId || uid === blackId)) return null;

  const live = !!white && !!black;

  return (
    <li>
      <button
        onClick={() => start(() => router.push(`/${code}`))}
        disabled={pending}
        className="group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-[rgb(var(--rgb-gold)_/_0.06)]"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-2 w-2 shrink-0 rounded-full"
            style={{ background: live ? "var(--c-green-text)" : "rgb(var(--rgb-gold) / 0.5)" }}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--c-text)]">
              {white || "?"} <span className="text-[rgb(var(--rgb-text)_/_0.4)]">vs</span>{" "}
              {black || <span className="text-[rgb(var(--rgb-text)_/_0.4)]">waiting…</span>}
            </div>
            <span className="flex items-center gap-2">
              <span
                className="text-[0.68rem] font-semibold uppercase tracking-wider"
                style={{ color: live ? "var(--c-green-text)" : "rgb(var(--rgb-text) / 0.4)" }}
              >
                {live ? "Live now" : "Open seat"}
              </span>
              {mode === "wager" && !!stake && (
                <span className="rounded bg-[rgb(var(--rgb-gold)_/_0.16)] px-1.5 py-0.5 text-[0.6rem] font-bold tabular-nums text-[var(--c-gold-strong)]">
                  💰 {stake} ARENA pool
                </span>
              )}
            </span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[rgb(var(--rgb-gold)_/_0.12)] px-2.5 py-1 text-xs font-semibold text-[var(--c-gold-strong)] transition group-hover:bg-[rgb(var(--rgb-gold)_/_0.22)]">
          {live ? (
            <>
              <IconEye size={13} /> Watch
            </>
          ) : (
            <>
              <IconSwords size={13} /> Join
            </>
          )}
        </span>
      </button>
    </li>
  );
}
