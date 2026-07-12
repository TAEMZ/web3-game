"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Reusable confirmation modal — replaces window.confirm/alert for anything
// destructive (resign, quit, leaving a game, etc.). Rendered through a portal to
// <body> so a transformed/blurred ancestor can't offset the fixed overlay.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="glass-dark w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-6"
        style={{ border: "1px solid rgb(var(--rgb-gold) / 0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display mb-2 text-lg font-bold text-[var(--c-gold-strong)]">{title}</h3>
        <div className="mb-5 text-sm text-[rgb(var(--rgb-text)_/_0.75)]">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-[rgb(var(--rgb-gold)_/_0.3)] px-4 py-1.5 text-sm font-semibold text-[var(--c-text)] transition hover:bg-[rgb(var(--rgb-gold)_/_0.12)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={
              danger
                ? "rounded-full bg-[rgb(var(--rgb-red)_/_0.85)] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[rgb(var(--rgb-red)_/_1)]"
                : "btn-gold px-4 py-1.5 text-sm"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
