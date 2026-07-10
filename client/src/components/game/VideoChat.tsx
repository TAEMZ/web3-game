"use client";

import {
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoneOff,
  IconVideo,
  IconVideoOff
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

// Free public STUN servers. A TURN server would be needed for peers behind
// strict/symmetric NATs — add one here later if calls fail to connect.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }]
};

type Role = "w" | "b" | "s";
type Remote = { id: string; role: Role; stream: MediaStream };
type PeerEntry = { pc: RTCPeerConnection; role: Role; remoteSet: boolean; pending: RTCIceCandidateInit[] };

// Multi-party in-game video: the two players publish their camera; everyone
// (opponent + spectators) subscribes. Spectators are receive-only. Each pair
// of participants gets its own peer connection (a small mesh), signaled over
// the game socket. White is the initiator between players; a player always
// initiates toward a spectator.
export default function VideoChat({ socket, side }: { socket: Socket; side: Role }) {
  const isPlayer = side === "w" || side === "b";
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("");
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [remotes, setRemotes] = useState<Remote[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const ackedRef = useRef<Set<string>>(new Set());
  const joinedRef = useRef(false);

  function send(sig: Record<string, unknown>) {
    socket.emit("rtcSignal", sig);
  }

  // Should a connection exist between me and a peer of this role?
  function shouldConnect(peerRole: Role): boolean {
    if (isPlayer) return true; // players connect to everyone
    return peerRole !== "s"; // spectators connect only to the two players
  }

  // Do I create the offer for this pair? (avoids glare — exactly one side does)
  function iInitiate(peerRole: Role): boolean {
    if (!isPlayer) return false; // spectators never initiate
    if (peerRole === "s") return true; // player publishes to spectator
    return side === "w"; // white initiates between the two players
  }

  function createPeer(peerId: string, peerRole: Role): PeerEntry {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ kind: "candidate", candidate: candidate.toJSON(), to: peerId });
    };
    pc.ontrack = ({ streams }) => {
      setRemotes((prev) => [
        ...prev.filter((r) => r.id !== peerId),
        { id: peerId, role: peerRole, stream: streams[0] }
      ]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") removePeer(peerId);
    };

    const entry: PeerEntry = { pc, role: peerRole, remoteSet: false, pending: [] };
    peersRef.current.set(peerId, entry);
    return entry;
  }

  function removePeer(peerId: string) {
    const entry = peersRef.current.get(peerId);
    if (entry) {
      entry.pc.close();
      peersRef.current.delete(peerId);
    }
    ackedRef.current.delete(peerId);
    setRemotes((prev) => prev.filter((r) => r.id !== peerId));
  }

  async function offerTo(peerId: string) {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    const offer = await entry.pc.createOffer();
    await entry.pc.setLocalDescription(offer);
    send({ kind: "description", description: { type: offer.type, sdp: offer.sdp }, to: peerId });
  }

  useEffect(() => {
    async function onSignal(sig: any) {
      const from: string | undefined = sig.from;
      if (!from || from === socket.id || !joinedRef.current) return;

      if (sig.kind === "hello") {
        const peerRole: Role = sig.role;
        if (!shouldConnect(peerRole) || ackedRef.current.has(from)) return;
        ackedRef.current.add(from);
        if (!peersRef.current.has(from)) createPeer(from, peerRole);
        send({ kind: "hello", role: side, to: from }); // let them learn me too
        if (iInitiate(peerRole)) await offerTo(from);
        return;
      }

      if (sig.kind === "bye") {
        removePeer(from);
        return;
      }

      const entry = peersRef.current.get(from);
      if (!entry) return;
      const pc = entry.pc;

      if (sig.kind === "description") {
        const desc = sig.description as RTCSessionDescriptionInit;
        await pc.setRemoteDescription(desc);
        entry.remoteSet = true;
        for (const c of entry.pending) {
          try {
            await pc.addIceCandidate(c);
          } catch {
            /* ignore */
          }
        }
        entry.pending = [];
        if (desc.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ kind: "description", description: { type: answer.type, sdp: answer.sdp }, to: from });
        }
      } else if (sig.kind === "candidate") {
        const cand = sig.candidate as RTCIceCandidateInit;
        if (entry.remoteSet) {
          try {
            await pc.addIceCandidate(cand);
          } catch {
            /* ignore */
          }
        } else {
          entry.pending.push(cand);
        }
      }
    }

    socket.on("rtcSignal", onSignal);
    return () => {
      socket.off("rtcSignal", onSignal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(() => {
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    if (isPlayer) {
      setStatus("Requesting camera…");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        setStatus(
          window.isSecureContext
            ? "Camera/mic blocked — allow access in your browser."
            : "Camera needs HTTPS (or localhost)."
        );
        return;
      }
    }
    joinedRef.current = true;
    setJoined(true);
    setStatus("");
    send({ kind: "hello", role: side }); // broadcast to the room for discovery
  }

  function leave() {
    if (joinedRef.current) send({ kind: "bye" });
    joinedRef.current = false;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((e) => e.pc.close());
    peersRef.current.clear();
    ackedRef.current.clear();
    setRemotes([]);
    setJoined(false);
    setStatus("");
  }

  function toggleCam() {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setCamOn(t.enabled);
    }
  }
  function toggleMic() {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setMicOn(t.enabled);
    }
  }

  // Only the two players ever have cameras, so we render player streams only.
  const playerRemotes = remotes.filter((r) => r.role === "w" || r.role === "b");
  const roleLabel = (r: Role) => (r === "w" ? "White" : r === "b" ? "Black" : "Spectator");

  return (
    <div
      className="glass-dark flex flex-col gap-2 rounded-xl p-3"
      style={{ border: "1px solid rgba(201,162,39,0.18)" }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold text-[#E8C040]">Video call</span>
        {joined && (
          <span className="text-[11px] text-[rgba(216,204,176,0.5)]">
            {isPlayer ? "Live" : "Watching"}
          </span>
        )}
      </div>

      {!joined ? (
        <>
          <button
            className="btn-dark w-full"
            style={{ padding: "10px", fontSize: "0.85rem" }}
            onClick={join}
          >
            <IconVideo size={16} /> {isPlayer ? "Start video call" : "Watch players' cameras"}
          </button>
          {status && <p className="text-center text-[11px] text-[#e85050]">{status}</p>}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            {playerRemotes.length === 0 && (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-[rgba(9,21,16,0.7)] px-2 text-center text-xs leading-tight text-[rgba(216,204,176,0.5)]">
                Waiting for {isPlayer ? "your opponent" : "the players"} to turn on their camera…
              </div>
            )}
            {playerRemotes.map((r) => (
              <div key={r.id} className="relative">
                <RemoteVideo stream={r.stream} />
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 text-[10px] text-white">
                  {isPlayer ? "Opponent" : roleLabel(r.role)}
                </span>
              </div>
            ))}
            {isPlayer && (
              <div className="relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full rounded-lg bg-black object-cover"
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 text-[10px] text-white">
                  You
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            {isPlayer && (
              <>
                <button
                  onClick={toggleMic}
                  title="Toggle mic"
                  className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-[#d8ccb0] transition hover:bg-[rgba(255,255,255,0.16)]"
                >
                  {micOn ? <IconMicrophone size={16} /> : <IconMicrophoneOff size={16} />}
                </button>
                <button
                  onClick={toggleCam}
                  title="Toggle camera"
                  className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(255,255,255,0.08)] text-[#d8ccb0] transition hover:bg-[rgba(255,255,255,0.16)]"
                >
                  {camOn ? <IconVideo size={16} /> : <IconVideoOff size={16} />}
                </button>
              </>
            )}
            <button
              onClick={leave}
              title={isPlayer ? "End call" : "Stop watching"}
              className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(184,24,24,0.8)] text-white transition hover:bg-[rgba(184,24,24,1)]"
            >
              <IconPhoneOff size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Each remote tile needs its stream attached via ref (srcObject can't be set in JSX).
function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video ref={ref} autoPlay playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
  );
}
