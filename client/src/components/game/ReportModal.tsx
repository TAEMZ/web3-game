"use client";

import { useState } from "react";

import { API_URL } from "@/config";

const REASONS = [
  { value: "cheating", label: "Cheating / engine use" },
  { value: "abusive_chat", label: "Abusive chat / bad language" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export default function ReportModal({
  reportedName,
  gameCode,
  chatSnapshot,
  onClose,
}: {
  reportedName: string;
  gameCode?: string;
  chatSnapshot?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("cheating");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit() {
    setState("sending");
    try {
      const res = await fetch(`${API_URL}/v1/reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedName, reason, note, gameCode, chatSnapshot }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
      <div
        className="glass-dark w-full max-w-md overflow-hidden rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--rgb-gold) / 0.3)" }}
      >
        <div className="tricolor-bar mb-4" />
        <h2 className="font-display text-xl font-bold text-[var(--c-gold-strong)]">Report {reportedName}</h2>
        <p className="mb-4 text-xs text-[rgb(var(--rgb-text)_/_0.5)]">An admin will review this report.</p>

        {state === "done" ? (
          <div className="py-4 text-center">
            <p className="mb-4 text-[var(--c-green-text)]">✓ Report submitted — thanks. An admin will review it.</p>
            <button onClick={onClose} className="btn-gold">
              Close
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="field-label">Reason</label>
              <select
                className="input-field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Details (optional)</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="What happened? Paste the offending message if any."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {chatSnapshot && (
              <p className="text-xs text-[rgb(var(--rgb-text)_/_0.4)]">
                The recent chat from this game will be attached for the admin.
              </p>
            )}
            {state === "error" && (
              <p className="text-sm text-[var(--c-red-text)]">Could not submit — please try again.</p>
            )}
            <div className="flex gap-2">
              <button onClick={submit} disabled={state === "sending"} className="btn-gold flex-1">
                {state === "sending" ? "Sending…" : "Submit report"}
              </button>
              <button onClick={onClose} className="btn-dark">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
