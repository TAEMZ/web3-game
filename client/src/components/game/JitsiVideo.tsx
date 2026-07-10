"use client";

import { IconVideo } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

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

export default function JitsiVideo({ gameCode }: { gameCode: string | number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same room string on every participant's client → they all land together.
  const room = `chessarena-${String(gameCode)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

  function dispose() {
    try {
      apiRef.current?.dispose?.();
    } catch {
      /* ignore */
    }
    apiRef.current = null;
    setJoined(false);
  }

  useEffect(() => {
    return () => dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/jitsi/token?room=${encodeURIComponent(room)}`, {
        credentials: "include"
      });
      if (!res.ok) {
        setError(res.status === 503 ? "Video calling isn't set up yet." : "Couldn't start the video call.");
        return;
      }
      const { token } = await res.json();
      const JitsiMeetExternalAPI = await loadJaasApi();
      if (!containerRef.current) return;
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
          startWithVideoMuted: false
        },
        interfaceConfigOverwrite: {
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true
        }
      });
      apiRef.current.addEventListener("readyToClose", () => dispose());
      setJoined(true);
    } catch (e) {
      setError((e as Error)?.message === "load" ? "Couldn't reach the video server." : "Couldn't start the video call.");
      dispose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black">
        {/* Jitsi mounts its iframe here; the container is always in the DOM so the
            ref exists before we create the call. */}
        <div ref={containerRef} className="h-full w-full" />
        {!joined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[rgba(9,21,16,0.75)] px-3 text-center">
            <button
              className="btn-dark"
              style={{ padding: "10px 16px", fontSize: "0.85rem" }}
              onClick={start}
              disabled={busy}
            >
              <IconVideo size={16} /> {busy ? "Starting…" : "Start video call"}
            </button>
            {error && <p className="text-[11px] text-[#e85050]">{error}</p>}
          </div>
        )}
      </div>
      {joined && (
        <button
          onClick={dispose}
          className="self-center rounded-full bg-[rgba(184,24,24,0.85)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[rgba(184,24,24,1)]"
        >
          Leave call
        </button>
      )}
    </div>
  );
}
