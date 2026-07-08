"use client";

import { useEffect, useState } from "react";

interface RewardToastProps {
  message: string;
  icon: string;
  show: boolean;
  onClose: () => void;
}

export default function RewardToast({ message, icon, show, onClose }: RewardToastProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-20 right-4 z-50 animate-fade-in-up">
      <div
        className="glass-dark flex items-center gap-3 px-5 py-3 shadow-2xl"
        style={{
          border: "1px solid rgba(201,162,39,0.4)",
          borderRadius: 16,
          minWidth: "250px",
        }}
      >
        <span className="text-3xl">{icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#E8C040]">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-[rgba(216,204,176,0.5)] hover:text-[#E8C040] transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
