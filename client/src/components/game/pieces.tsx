import type { ReactNode } from "react";

// Custom two-tone piece set for the Chess Arena: carved-ivory "white" pieces and
// ebony-with-gold-trim "black" pieces, giving the board a warmer, gilded look
// than the default flat set. Rendered from the filled Unicode chess glyphs so we
// control the fill + outline colour per side.
const GLYPHS: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };

function Piece({ type, white, squareWidth }: { type: string; white: boolean; squareWidth: number }) {
  const stroke = Math.max(1, squareWidth * 0.03);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          fontSize: squareWidth * 0.82,
          lineHeight: 1,
          // Piece colours are board furniture, not page chrome — they must not
          // follow the theme, or the white pieces go black on the light board.
          color: white ? "#e8dcc0" : "#1c130b",
          WebkitTextStroke: `${stroke}px ${white ? "#7a5c12" : "#c9a227"}`,
          textShadow: "0 2px 3px rgba(0,0,0,0.45)",
        }}
      >
        {GLYPHS[type]}
      </span>
    </div>
  );
}

// react-chessboard `customPieces` map: { wK, wQ, …, bP }.
export const ethiopianPieces: Record<string, (p: { squareWidth: number }) => ReactNode> = (() => {
  const obj: Record<string, (p: { squareWidth: number }) => ReactNode> = {};
  (["w", "b"] as const).forEach((c) => {
    (["K", "Q", "R", "B", "N", "P"] as const).forEach((t) => {
      obj[c + t] = ({ squareWidth }) => <Piece type={t} white={c === "w"} squareWidth={squareWidth} />;
    });
  });
  return obj;
})();
