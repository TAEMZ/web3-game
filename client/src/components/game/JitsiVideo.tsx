"use client";

import { IconVideo } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { API_URL } from "@/config";

// In-game video via JaaS (8x8-hosted Jitsi). The App ID is public; the real auth is
// the signed token the server hands us, so the player joins as their chess username
// with no Jitsi/Google login. Relaying is handled by 8x8's infra, which works on
// restrictive networks (falls back to TCP/443) where raw peer-to-peer WebRTC didn't.
const JAAS_DOMAIN = "8x8.vc";
const APP_ID =
  process.env.NEXT_PUBLIC_JAAS_APP_ID || "vpaas-magic-cookie-9cea7e6134b846cd9883d0ff27cb4dfe";

declare global {
  interface Window {
    // Jitsi's external API is untyped upstream.
    JitsiMeetExternalAPI?: any;
  }
}

// Load 8x8's external_api.js once, and hand back the constructor.
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
  const apiRef = useRef<any>(null);
  const [active, setActive] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same room string on every participant's client → they all land together.
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

  // Clean up the call if the component unmounts (e.g. game left).
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the modal (and its container) is on screen and we have a token, mount the
  // Jitsi iframe into it. Doing this in an effect guarantees the container exists.
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
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true
          }
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
      // moderator=1 for the two players, 0 for spectators.
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

      {/* Active call: portaled to <body> (so no transformed/blurred ancestor offsets
          the fixed overlay) — full-screen on phones, a big landscape window on desktop. */}
      {active &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="relative h-full w-full overflow-hidden bg-black sm:h-[90vh] sm:w-[95vw] sm:max-w-[1400px] sm:rounded-2xl">
              <div ref={containerRef} className="h-full w-full" />
              <button
                onClick={stop}
                className="absolute right-3 top-3 z-10 rounded-full bg-[rgba(184,24,24,0.92)] px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition hover:bg-[rgba(184,24,24,1)]"
              >
                Leave call
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
