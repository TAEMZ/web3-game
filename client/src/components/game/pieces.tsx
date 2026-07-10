import type { ReactNode } from "react";

// Stylized Ethiopian-themed chess set (a coded interpretation of the sculptural
// reference): each piece is an Ethiopian emblem on a carved pedestal — Solomonic
// ivory-and-gold for white, Zagwe bronze-and-gold for black.
//   Pawn = round shield · Rook = Axum obelisk · Bishop = Ethiopian cross
//   Queen = crown · King = crown + cross · Knight = horse
type Tone = { fill: string; line: string; accent: string };
const WHITE: Tone = { fill: "#f2e6c4", line: "#8a6a1e", accent: "#c9a227" };
const BLACK: Tone = { fill: "#2c1f12", line: "#c9a227", accent: "#e8c040" };

function Base({ t }: { t: Tone }) {
  return (
    <>
      <ellipse cx="22.5" cy="39.4" rx="13" ry="2.4" fill={t.fill} stroke={t.line} strokeWidth="1" />
      <path d="M12 39 L14 34 H31 L33 39 Z" fill={t.fill} stroke={t.line} strokeWidth="1" strokeLinejoin="round" />
      <rect x="14.3" y="31.4" width="16.4" height="3" rx="1" fill={t.fill} stroke={t.line} strokeWidth="1" />
    </>
  );
}

const SHAPES: Record<string, (t: Tone) => ReactNode> = {
  // Pawn — round Ethiopian shield with a central boss.
  P: (t) => (
    <>
      <rect x="19.6" y="23" width="5.8" height="9" rx="1.2" fill={t.fill} stroke={t.line} strokeWidth="1.2" />
      <circle cx="22.5" cy="16.8" r="8" fill={t.fill} stroke={t.line} strokeWidth="1.4" />
      <circle cx="22.5" cy="16.8" r="5" fill="none" stroke={t.line} strokeWidth="0.6" opacity="0.6" />
      <circle cx="22.5" cy="16.8" r="2.5" fill={t.accent} stroke={t.line} strokeWidth="0.7" />
    </>
  ),
  // Rook — Axum obelisk (tapered stele + gold pyramidion).
  R: (t) => (
    <>
      <path d="M18.6 31 L19.9 10 H25.1 L26.4 31 Z" fill={t.fill} stroke={t.line} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M19.9 10 L22.5 4.8 L25.1 10 Z" fill={t.accent} stroke={t.line} strokeWidth="1" strokeLinejoin="round" />
      <line x1="19.6" y1="17" x2="25.4" y2="17" stroke={t.line} strokeWidth="0.9" />
      <line x1="19.2" y1="24" x2="25.8" y2="24" stroke={t.line} strokeWidth="0.9" />
    </>
  ),
  // Bishop — Ethiopian cross.
  B: (t) => (
    <>
      <rect x="20.4" y="6.5" width="4.2" height="21" rx="1.2" fill={t.fill} stroke={t.line} strokeWidth="1.1" />
      <rect x="13.8" y="12.6" width="17.4" height="4.2" rx="1.2" fill={t.fill} stroke={t.line} strokeWidth="1.1" />
      <circle cx="22.5" cy="14.7" r="2" fill={t.accent} stroke={t.line} strokeWidth="0.6" />
    </>
  ),
  // Queen — three-point crown with jewels.
  Q: (t) => (
    <>
      <path d="M15 26 L13.8 13.2 L18.6 18.8 L22.5 11 L26.4 18.8 L31.2 13.2 L30 26 Z" fill={t.fill} stroke={t.line} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="13.8" cy="13.2" r="1.7" fill={t.accent} />
      <circle cx="22.5" cy="11" r="1.9" fill={t.accent} />
      <circle cx="31.2" cy="13.2" r="1.7" fill={t.accent} />
      <rect x="14.6" y="24.8" width="15.8" height="3.2" rx="1" fill={t.accent} stroke={t.line} strokeWidth="0.7" />
    </>
  ),
  // King — crown topped by a cross finial.
  K: (t) => (
    <>
      <path d="M21.3 3 h2.4 v2.4 h2.4 v2.2 h-2.4 v3 h-2.4 v-3 h-2.4 v-2.2 h2.4 z" fill={t.accent} stroke={t.line} strokeWidth="0.6" strokeLinejoin="round" />
      <path d="M15 26 L14.4 14.8 L18.6 19.8 L22.5 13.2 L26.4 19.8 L30.6 14.8 L30 26 Z" fill={t.fill} stroke={t.line} strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="14.6" y="24.8" width="15.8" height="3.2" rx="1" fill={t.accent} stroke={t.line} strokeWidth="0.7" />
    </>
  ),
  // Knight — stylized horse head.
  N: (t) => (
    <>
      <path
        d="M18 32 C16.5 27 17 22.8 19.6 20.4 C17 21 14.4 20.6 13.4 18.7 C13.1 18.1 13.5 17.3 14.4 17.2 C17 16.9 19.6 15.4 21.1 12.8 C21.4 10.6 22.4 7.8 24.7 6.8 C26.1 6.2 26.7 5 26.6 3.7 C28.4 4.7 29.7 6.5 30.1 8.8 C30.8 13.3 30.1 19.1 28.7 24.1 C27.9 27 27.9 30 28.6 32 Z"
        fill={t.fill}
        stroke={t.line}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M27 6.5 C29 9 29.6 14 28.7 20" stroke={t.accent} strokeWidth="0.9" fill="none" opacity="0.6" />
      <circle cx="24.4" cy="11.6" r="1" fill={t.line} />
    </>
  ),
};

function PieceSvg({ type, white, squareWidth }: { type: string; white: boolean; squareWidth: number }) {
  const t = white ? WHITE : BLACK;
  return (
    <svg
      viewBox="0 0 45 45"
      width={squareWidth}
      height={squareWidth}
      style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.4))", pointerEvents: "none" }}
    >
      {SHAPES[type](t)}
      <Base t={t} />
    </svg>
  );
}

// react-chessboard `customPieces` map: { wK, wQ, …, bP }.
export const ethiopianPieces: Record<string, (p: { squareWidth: number }) => ReactNode> = (() => {
  const obj: Record<string, (p: { squareWidth: number }) => ReactNode> = {};
  (["w", "b"] as const).forEach((c) => {
    (["K", "Q", "R", "B", "N", "P"] as const).forEach((tp) => {
      obj[c + tp] = ({ squareWidth }) => <PieceSvg type={tp} white={c === "w"} squareWidth={squareWidth} />;
    });
  });
  return obj;
})();
