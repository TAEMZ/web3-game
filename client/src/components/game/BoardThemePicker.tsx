"use client";

import { BOARD_THEMES, type BoardTheme, setStoredBoardTheme } from "@/lib/boardThemes";

// Compact swatch picker — players choose the board they play on. Persists to
// localStorage; purely a visual preference.
export default function BoardThemePicker({
  theme,
  onChange,
}: {
  theme: BoardTheme;
  onChange: (t: BoardTheme) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.4)]">
        Board
      </span>
      {BOARD_THEMES.map((t) => {
        const active = t.id === theme.id;
        return (
          <button
            key={t.id}
            title={t.name}
            aria-label={`Board: ${t.name}`}
            onClick={() => {
              setStoredBoardTheme(t.id);
              onChange(t);
            }}
            className="h-6 w-6 overflow-hidden rounded-md transition hover:scale-110"
            style={{
              boxShadow: active ? "0 0 0 2px var(--c-gold-strong)" : "0 0 0 1px rgb(var(--rgb-gold) / 0.25)",
            }}
          >
            <span className="grid h-full w-full grid-cols-2 grid-rows-2">
              <span style={{ background: t.light }} />
              <span style={{ background: t.dark }} />
              <span style={{ background: t.dark }} />
              <span style={{ background: t.light }} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
