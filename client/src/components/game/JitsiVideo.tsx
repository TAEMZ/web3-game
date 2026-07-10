"use client";

import { IconVideo } from "@tabler/icons-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { API_URL } from "@/config";

// In-game video via JaaS (8x8-hosted Jitsi). The App ID is public; the real auth is
// the signed token the server hands us, so the player joins as their chess username
// with no Jitsi/Google login. It renders as a small draggable + resizable floating
// window so the board and chat stay usable underneath.
const JAAS_DOMAIN = "8x8.vc";
const APP_ID =
  process.env.NEXT_PUBLIC_JAAS_APP_ID || "vpaas-magic-cookie-9cea7e6134b846cd9883d0ff27cb4dfe";
const DEFAULT_SIZE = { w: 360, h: 300 };
const MIN_W = 280;
const MIN_H = 220;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const RESIZE_HANDLES: { dir: ResizeDir; cls: string }[] = [
  { dir: "n", cls: "left-3 right-3 top-0 h-1.5 cursor-ns-resize" },
  { dir: "s", cls: "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize" },
  { dir: "e", cls: "bottom-3 right-0 top-3 w-1.5 cursor-ew-resize" },
  { dir: "w", cls: "bottom-3 left-0 top-3 w-1.5 cursor-ew-resize" },
  { dir: "ne", cls: "right-0 top-0 h-3 w-3 cursor-nesw-resize" },
  { dir: "nw", cls: "left-0 top-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "se", cls: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "sw", cls: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" }
];

declare global {
  interface Window {
    // Jitsi's external API is untyped upstream.
    JitsiMeetExternalAPI?: any;
  }
}

function loadJaasApi(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const src = `https://${JAAS_DOMAIN}/${APP_ID}/external_api.js`;
    const done = () =>
      window.JitsiMeetExternalAPI
        ? resolve(window.JitsiMeetExternalAPI)
        : reject(new Error("Jitsi API missing after load"));
    const existing = document.querySelector<HTMLScriptElement>(`script[data-jaas="1"]`);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => reject(new Error("load")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.jaas = "1";
    s.addEventListener("load", done);
    s.addEventListener("error", () => reject(new Error("load")));
    document.body.appendChild(s);
  });
}

export default function JitsiVideo({
  gameCode,
  isPlayer = true
}: {
  gameCode: string | number;
  isPlayer?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const resizeRef = useRef<{
    dir: ResizeDir;
    x: number;
    y: number;
    left: number;
    top: number;
    w: number;
    h: number;
  } | null>(null);
  const [active, setActive] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // null → default bottom-right
  const [size, setSize] = useState(DEFAULT_SIZE);

  const room = `chessarena-${String(gameCode)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

  function stop() {
    try {
      apiRef.current?.dispose?.();
    } catch {
      /* ignore */
    }
    apiRef.current = null;
    setToken(null);
    setActive(false);
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mount the Jitsi iframe once the window (and its container) is on screen.
  useEffect(() => {
    if (!active || !token || apiRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const JitsiMeetExternalAPI = await loadJaasApi();
        if (cancelled || !containerRef.current || apiRef.current) return;
        apiRef.current = new JitsiMeetExternalAPI(JAAS_DOMAIN, {
          roomName: `${APP_ID}/${room}`,
          jwt: token,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true
          },
          interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, HIDE_INVITE_MORE_HEADER: true }
        });
        apiRef.current.addEventListener("readyToClose", () => stop());
      } catch {
        if (!cancelled) {
          setError("Couldn't reach the video server.");
          setActive(false);
          setToken(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, token]);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `${API_URL}/v1/jitsi/token?room=${encodeURIComponent(room)}&moderator=${isPlayer ? 1 : 0}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        setError(res.status === 503 ? "Video calling isn't set up yet." : "Couldn't start the video call.");
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setActive(true);
    } catch {
      setError("Couldn't start the video call.");
    } finally {
      setBusy(false);
    }
  }

  // --- drag (title bar) — pointer capture keeps events flowing over the iframe ---
  function onDragDown(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = winRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const x = Math.max(0, Math.min(e.clientX - dragRef.current.dx, window.innerWidth - size.w));
    const y = Math.max(0, Math.min(e.clientY - dragRef.current.dy, window.innerHeight - size.h));
    setPos({ x, y });
  }
  function onDragUp(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  // --- resize (any edge / corner) ---
  function startResize(dir: ResizeDir, e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const r = winRef.current?.getBoundingClientRect();
    if (!r) return;
    resizeRef.current = { dir, x: e.clientX, y: e.clientY, left: r.left, top: r.top, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: ReactPointerEvent<HTMLDivElement>) {
    const rz = resizeRef.current;
    if (!rz) return;
    const dx = e.clientX - rz.x;
    const dy = e.clientY - rz.y;
    let w = rz.dir.includes("e") ? rz.w + dx : rz.dir.includes("w") ? rz.w - dx : rz.w;
    let h = rz.dir.includes("s") ? rz.h + dy : rz.dir.includes("n") ? rz.h - dy : rz.h;
    w = Math.max(MIN_W, Math.min(w, window.innerWidth - 8));
    h = Math.max(MIN_H, Math.min(h, window.innerHeight - 8));
    // edges/corners that move the top-left keep the opposite side pinned
    let left = rz.dir.includes("w") ? rz.left + (rz.w - w) : rz.left;
    let top = rz.dir.includes("n") ? rz.top + (rz.h - h) : rz.top;
    left = Math.max(0, Math.min(left, window.innerWidth - w));
    top = Math.max(0, Math.min(top, window.innerHeight - h));
    setPos({ x: left, y: top });
    setSize({ w, h });
  }
  function onResizeUp(e: ReactPointerEvent<HTMLDivElement>) {
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  const winStyle: CSSProperties = pos
    ? { left: pos.x, top: pos.y, width: size.w, height: size.h }
    : { right: 12, bottom: 12, width: size.w, height: size.h };

  return (
    <>
      {!active && (
        <div className="flex flex-col gap-1">
          <button
            className="btn-dark w-full"
            style={{ padding: "10px", fontSize: "0.85rem" }}
            onClick={start}
            disabled={busy}
          >
            <IconVideo size={16} /> {busy ? "Starting…" : "Start video call"}
          </button>
          {error && <p className="text-center text-[11px] text-[#e85050]">{error}</p>}
        </div>
      )}

      {/* Draggable + resizable floating window (portaled to <body>) so the board and
          chat stay visible and usable underneath. */}
      {active &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={winRef}
            className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-[rgba(201,162,39,0.4)] bg-black shadow-2xl"
            style={winStyle}
          >
            <div
              className="flex h-8 shrink-0 cursor-move touch-none select-none items-center justify-between bg-[rgba(13,22,18,0.95)] px-2"
              onPointerDown={onDragDown}
              onPointerMove={onDragMove}
              onPointerUp={onDragUp}
            >
              <span className="text-[11px] font-semibold text-[rgba(216,204,176,0.6)]">⠿ Video — drag</span>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={stop}
                className="rounded-full bg-[rgba(184,24,24,0.9)] px-2.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-[rgba(184,24,24,1)]"
              >
                Leave
              </button>
            </div>
            <div ref={containerRef} className="min-h-0 w-full flex-1" />
            {/* resize from any edge or corner */}
            {RESIZE_HANDLES.map((hd) => (
              <div
                key={hd.dir}
                className={`absolute z-20 touch-none ${hd.cls}`}
                onPointerDown={(e) => startResize(hd.dir, e)}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
              />
            ))}
            <div
              className="pointer-events-none absolute bottom-0 right-0 h-4 w-4"
              style={{ background: "linear-gradient(135deg, transparent 45%, rgba(201,162,39,0.75) 45%)" }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
