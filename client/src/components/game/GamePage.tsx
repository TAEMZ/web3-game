"use client";
// TODO: restructure, i could use some help with this :>

import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconPlayerSkipBack,
  IconPlayerSkipForward
} from "@tabler/icons-react";

import type { FormEvent, KeyboardEvent } from "react";

import { SessionContext } from "@/context/session";
import { useContext, useEffect, useReducer, useRef, useState } from "react";

import type { Message } from "@/types";
import type { Game } from "@arena/types";

import type { Move, Square } from "chess.js";
import { Chess } from "chess.js";
import type { ClearPremoves } from "react-chessboard";
import { Chessboard } from "react-chessboard";

import { API_URL } from "@/config";
import { io } from "socket.io-client";

import { lobbyReducer, squareReducer } from "./reducers";
import { initSocket } from "./socketEvents";
import { syncPgn, syncSide } from "./utils";
import JitsiVideo from "./JitsiVideo";
import GameOverModal from "./GameOverModal";
import ReportModal from "./ReportModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useNavGuard } from "@/context/navGuard";
import WagerPanel from "./WagerPanel";
import BoardThemePicker from "./BoardThemePicker";
import { ethiopianPieces } from "./pieces";
import { defaultBoardTheme, getBoardTheme, type BoardTheme } from "@/lib/boardThemes";

// ARENA docked for a loss (resignation included); mirrors LOSS_PENALTY in the server rewards controller.
const RESIGN_PENALTY = 3;

// Emote reactions — must match the server whitelist in game.socket.ts (EMOTES).
const EMOTES = ["👍", "😂", "😮", "😢", "😡", "🎉", "🔥", "👏", "🤝", "😎", "♟️", "💀"];

// Empty API_URL (relative mode) → connect the socket to the page's own origin.
const socket = io(API_URL || window.location.origin, { withCredentials: true, autoConnect: false });

export default function GamePage({ initialLobby }: { initialLobby: Game }) {
  const session = useContext(SessionContext);
  const { setGuard } = useNavGuard();
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  const [lobby, updateLobby] = useReducer(lobbyReducer, {
    ...initialLobby,
    actualGame: new Chess(),
    side: "s"
  });

  const [customSquares, updateCustomSquares] = useReducer(squareReducer, {
    options: {},
    lastMove: {},
    rightClicked: {},
    check: {}
  });

  const [moveFrom, setMoveFrom] = useState<string | Square | null>(null);
  const [boardWidth, setBoardWidth] = useState(480);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(defaultBoardTheme());
  const chessboardRef = useRef<ClearPremoves>(null);

  const [navFen, setNavFen] = useState<string | null>(null);
  const [navIndex, setNavIndex] = useState<number | null>(null);

  const [playBtnLoading, setPlayBtnLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [gameOverData, setGameOverData] = useState<{
    reason: Game["endReason"];
    winnerName?: string;
    winnerSide?: "white" | "black" | "draw";
    gameId: number;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      author: {},
      message: `Welcome! You can invite friends to watch or play by sharing the link above. Have fun!`
    }
  ]);
  const chatListRef = useRef<HTMLUListElement>(null);
  const moveListRef = useRef<HTMLDivElement>(null);

  // Floating emote reactions (both players + spectators).
  const [emotes, setEmotes] = useState<{ id: number; key: string; from: string; mine?: boolean }[]>([]);
  const emoteId = useRef(0);
  function pushEmote(key: string, from: string, mine = false) {
    const id = emoteId.current++;
    setEmotes((prev) => [...prev, { id, key, from, mine }]);
    setTimeout(() => setEmotes((prev) => prev.filter((e) => e.id !== id)), 2600);
  }
  function sendEmote(key: string) {
    if (!session?.user) return;
    socket.emit("emote", key);
    pushEmote(key, session.user.name || "You", true);
  }

  const [abandonSeconds, setAbandonSeconds] = useState(60);
  useEffect(() => {
    if (
      lobby.side === "s" ||
      lobby.endReason ||
      lobby.winner ||
      !lobby.pgn ||
      !lobby.white ||
      !lobby.black ||
      (lobby.white.id !== session?.user?.id && lobby.black.id !== session?.user?.id)
    )
      return;

    let interval: number;
    if (!lobby.white?.connected || !lobby.black?.connected) {
      setAbandonSeconds(60);
      interval = Number(
        setInterval(() => {
          if (abandonSeconds === 0 || (lobby.white?.connected && lobby.black?.connected)) {
            clearInterval(interval);
            return;
          }
          setAbandonSeconds((s) => s - 1);
        }, 1000)
      );
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby.black, lobby.white, lobby.black?.disconnectedOn, lobby.white?.disconnectedOn]);

  useEffect(() => {
    if (!session?.user || !session.user?.id) return;
    socket.connect();

    window.addEventListener("resize", handleResize);
    handleResize();

    if (lobby.pgn && lobby.actualGame.pgn() !== lobby.pgn) {
      syncPgn(lobby.pgn, lobby, { updateCustomSquares, setNavFen, setNavIndex });
    }

    syncSide(session.user, undefined, lobby, { updateLobby });

    initSocket(session.user, socket, lobby, {
      updateLobby,
      addMessage,
      updateCustomSquares,
      makeMove,
      setNavFen,
      setNavIndex,
      onGameOver: (payload) => setGameOverData(payload),
      onEmote: ({ key, from }) => pushEmote(key, from, false)
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      socket.removeAllListeners();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Player-chosen board colours (client preference, no backend).
  useEffect(() => {
    setBoardTheme(getBoardTheme());
  }, []);

  // auto scroll down when new message is added
  useEffect(() => {
    const chatList = chatListRef.current;
    if (!chatList) return;
    chatList.scrollTop = chatList.scrollHeight;
  }, [chatMessages]);

  // auto scroll for moves
  useEffect(() => {
    const activeMoveEl = document.getElementById("activeNavMove");
    const moveList = moveListRef.current;
    if (!activeMoveEl || !moveList) return;
    moveList.scrollTop = activeMoveEl.offsetTop;
  });

  useEffect(() => {
    updateTurnTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby]);

  function updateTurnTitle() {
    if (lobby.side === "s" || !lobby.white?.id || !lobby.black?.id) return;

    if (!lobby.endReason && lobby.side === lobby.actualGame.turn()) {
      document.title = "(your turn) Chess Arena";
    } else {
      document.title = "Chess Arena";
    }
  }

  function handleResize() {
    if (window.innerWidth >= 1920) {
      setBoardWidth(580);
    } else if (window.innerWidth >= 1536) {
      setBoardWidth(540);
    } else if (window.innerWidth >= 768) {
      setBoardWidth(480);
    } else {
      setBoardWidth(350);
    }
  }

  function addMessage(message: Message) {
    setChatMessages((prev) => [...prev, message]);
  }

  function sendChat(message: string) {
    if (!session?.user) return;

    socket.emit("chat", message);
    addMessage({ author: session.user, message });
  }

  function chatKeyUp(e: KeyboardEvent<HTMLInputElement>) {
    e.preventDefault();
    if (e.key === "Enter") {
      const input = e.target as HTMLInputElement;
      if (!input.value || input.value.length == 0) return;
      sendChat(input.value);
      input.value = "";
    }
  }

  function chatClickSend(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const target = e.target as HTMLFormElement;
    const input = target.elements.namedItem("chatInput") as HTMLInputElement;
    if (!input.value || input.value.length == 0) return;
    sendChat(input.value);
    input.value = "";
  }

  function makeMove(m: { from: string; to: string; promotion?: string }) {
    try {
      const result = lobby.actualGame.move(m);

      if (result) {
        setNavFen(null);
        setNavIndex(null);
        updateLobby({
          type: "updateLobby",
          payload: { pgn: lobby.actualGame.pgn() }
        });
        updateTurnTitle();
        let kingSquare = undefined;
        if (lobby.actualGame.inCheck()) {
          const kingPos = lobby.actualGame.board().reduce((acc, row, index) => {
            const squareIndex = row.findIndex(
              (square) => square && square.type === "k" && square.color === lobby.actualGame.turn()
            );
            return squareIndex >= 0 ? `${String.fromCharCode(squareIndex + 97)}${8 - index}` : acc;
          }, "");
          kingSquare = {
            [kingPos]: {
              background: "radial-gradient(red, rgba(255,0,0,.4), transparent 70%)",
              borderRadius: "50%"
            }
          };
        }
        updateCustomSquares({
          lastMove: {
            [result.from]: { background: "rgba(255, 255, 0, 0.4)" },
            [result.to]: { background: "rgba(255, 255, 0, 0.4)" }
          },
          options: {},
          check: kingSquare
        });
        return true;
      } else {
        throw new Error("Invalid move");
      }
    } catch (err) {
      updateCustomSquares({
        options: {}
      });
      return false;
    }
  }

  function isDraggablePiece({ piece }: { piece: string }) {
    return piece.startsWith(lobby.side) && !lobby.endReason && !lobby.winner;
  }

  function onDrop(sourceSquare: Square, targetSquare: Square) {
    if (lobby.side === "s" || navFen || lobby.endReason || lobby.winner) return false;

    // premove
    if (lobby.side !== lobby.actualGame.turn()) return true;

    const moveDetails = {
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    };

    const move = makeMove(moveDetails);
    if (!move) return false; // illegal move
    socket.emit("sendMove", moveDetails);
    return true;
  }

  function getMoveOptions(square: Square) {
    const moves = lobby.actualGame.moves({
      square,
      verbose: true
    }) as Move[];
    if (moves.length === 0) {
      return;
    }

    const newSquares: {
      [square: string]: { background: string; borderRadius?: string };
    } = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          lobby.actualGame.get(move.to as Square) &&
          lobby.actualGame.get(move.to as Square)?.color !== lobby.actualGame.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)"
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        borderRadius: "50%"
      };
      return move;
    });
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)"
    };
    updateCustomSquares({ options: newSquares });
  }

  function onPieceDragBegin(_piece: string, sourceSquare: Square) {
    if (lobby.side !== lobby.actualGame.turn() || navFen || lobby.endReason || lobby.winner) return;

    getMoveOptions(sourceSquare);
  }

  function onPieceDragEnd() {
    updateCustomSquares({ options: {} });
  }

  function onSquareClick(square: Square) {
    updateCustomSquares({ rightClicked: {} });
    if (lobby.side !== lobby.actualGame.turn() || navFen || lobby.endReason || lobby.winner) return;

    function resetFirstMove(square: Square) {
      setMoveFrom(square);
      getMoveOptions(square);
    }

    // from square
    if (moveFrom === null) {
      resetFirstMove(square);
      return;
    }

    const moveDetails = {
      from: moveFrom,
      to: square,
      promotion: "q"
    };

    const move = makeMove(moveDetails);
    if (!move) {
      resetFirstMove(square);
    } else {
      setMoveFrom(null);
      socket.emit("sendMove", moveDetails);
    }
  }

  function onSquareRightClick(square: Square) {
    const colour = "rgba(0, 0, 255, 0.4)";
    updateCustomSquares({
      rightClicked: {
        ...customSquares.rightClicked,
        [square]:
          customSquares.rightClicked[square] &&
          customSquares.rightClicked[square]?.backgroundColor === colour
            ? undefined
            : { backgroundColor: colour }
      }
    });
  }

  function clickPlay(e: FormEvent<HTMLButtonElement>) {
    setPlayBtnLoading(true);
    e.preventDefault();
    socket.emit("joinAsPlayer");
  }

  function playerCard(color: "white" | "black") {
    const p = color === "white" ? lobby.white : lobby.black;
    const isYou = !!p && p.id === session?.user?.id;
    const isNumbered = typeof p?.id === "number";
    const yourTurn =
      !!lobby.pgn &&
      !lobby.endReason &&
      !!lobby.white?.id &&
      !!lobby.black?.id &&
      lobby.actualGame.turn() === (color === "white" ? "w" : "b");
    const initial = (p?.name || "?").replace(/^0x/, "").charAt(0).toUpperCase();

    return (
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
        style={{
          background: yourTurn ? "rgba(201,162,39,0.1)" : "rgba(13,22,18,0.5)",
          border: `1px solid ${yourTurn ? "rgba(201,162,39,0.4)" : "rgba(201,162,39,0.12)"}`,
        }}
      >
        <div
          className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold"
          style={{
            background: color === "white" ? "#eae9d2" : "#1b2620",
            color: color === "white" ? "#1b2620" : "#e8c040",
            border: "1px solid rgba(201,162,39,0.3)",
          }}
        >
          {p?.name ? initial : "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isNumbered ? (
              <a
                href={`/user/${p?.name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm font-semibold text-[#d8ccb0] hover:text-[#E8C040]"
              >
                {p?.name}
              </a>
            ) : (
              <span className="truncate text-sm font-semibold text-[#d8ccb0]">
                {p?.name || "Waiting…"}
              </span>
            )}
            {isYou && (
              <span className="rounded-full bg-[rgba(201,162,39,0.15)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[#E8C040]">
                you
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.45)]">
            {color}
            {p?.connected === false && (
              <span className="rounded bg-[rgba(184,24,24,0.2)] px-1 text-[#e06666]">offline</span>
            )}
          </div>
        </div>
        {yourTurn && (
          <span className="flex shrink-0 items-center gap-1.5 text-[0.7rem] font-semibold text-[#E8C040]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8C040] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8C040]" />
            </span>
            to move
          </span>
        )}
      </div>
    );
  }

  function copyInvite() {
    const text = `${window.location.origin}/${lobby.endReason ? `archive/${lobby.id}` : initialLobby.code}`;
    if ("clipboard" in navigator) {
      navigator.clipboard.writeText(text);
    } else {
      document.execCommand("copy", true, text);
    }
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
    }, 5000);
  }

  function getMoveListHtml() {
    const history = lobby.actualGame.history({ verbose: true });
    const movePairs = history
      .slice(history.length / 2)
      .map((_, i) => history.slice((i *= 2), i + 2));

    return movePairs.map((moves, i) => {
      return (
        <tr className="flex w-full items-center gap-1" key={i + 1}>
          <td className="">{i + 1}.</td>
          <td
            className={
              "btn btn-ghost btn-xs h-full w-2/5 font-normal normal-case" +
              ((history.indexOf(moves[0]) === history.length - 1 && navIndex === null) ||
              navIndex === history.indexOf(moves[0])
                ? " btn-active pointer-events-none rounded-none"
                : "")
            }
            id={
              (history.indexOf(moves[0]) === history.length - 1 && navIndex === null) ||
              navIndex === history.indexOf(moves[0])
                ? "activeNavMove"
                : ""
            }
            onClick={() => navigateMove(history.indexOf(moves[0]))}
          >
            {moves[0].san}
          </td>
          {moves[1] && (
            <td
              className={
                "btn btn-ghost btn-xs h-full w-2/5 font-normal normal-case" +
                ((history.indexOf(moves[1]) === history.length - 1 && navIndex === null) ||
                navIndex === history.indexOf(moves[1])
                  ? " btn-active pointer-events-none rounded-none"
                  : "")
              }
              id={
                (history.indexOf(moves[1]) === history.length - 1 && navIndex === null) ||
                navIndex === history.indexOf(moves[1])
                  ? "activeNavMove"
                  : ""
              }
              onClick={() => navigateMove(history.indexOf(moves[1]))}
            >
              {moves[1].san}
            </td>
          )}
        </tr>
      );
    });
  }

  function navigateMove(index: number | null | "prev") {
    const history = lobby.actualGame.history({ verbose: true });

    if (index === null || (index !== "prev" && index >= history.length - 1) || !history.length) {
      // last move
      setNavIndex(null);
      setNavFen(null);
      return;
    }

    if (index === "prev") {
      index = history.length - 2;
    } else if (index < 0) {
      index = 0;
    }

    chessboardRef.current?.clearPremoves(false);

    setNavIndex(index);
    setNavFen(history[index].after);
  }

  function getNavMoveSquares() {
    if (navIndex === null) return;
    const history = lobby.actualGame.history({ verbose: true });

    if (!history.length) return;

    return {
      [history[navIndex].from]: { background: "rgba(255, 255, 0, 0.4)" },
      [history[navIndex].to]: { background: "rgba(255, 255, 0, 0.4)" }
    };
  }

  function claimAbandoned(type: "win" | "draw") {
    if (
      lobby.side === "s" ||
      lobby.endReason ||
      lobby.winner ||
      !lobby.pgn ||
      abandonSeconds > 0 ||
      (lobby.black?.connected && lobby.white?.connected)
    ) {
      return;
    }
    socket.emit("claimAbandoned", type);
  }

  // Matches the server's resign rule (needs a started game with a move played) — so
  // the "leave & resign" guard only fires when a resign will actually be accepted.
  const gameActive =
    lobby.side !== "s" &&
    !lobby.endReason &&
    !lobby.winner &&
    !!lobby.pgn &&
    !!lobby.white?.id &&
    !!lobby.black?.id;

  // While a game is live, confirm — and resign — before the user navigates away, so an
  // abandoned game doesn't leave the opponent (or the board) stuck.
  useEffect(() => {
    if (gameActive) {
      setGuard({
        message: "Leaving now will resign the game and count as a loss. Leave anyway?",
        onConfirm: () => socket.emit("resign")
      });
    } else {
      setGuard(null);
    }
    return () => setGuard(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameActive]);

  function resignGame() {
    if (!gameActive) return;
    setShowResignConfirm(true);
  }

  // The human opponent (if any) — reportable when it's a registered player, not a bot.
  const opponent =
    lobby.side === "w" ? lobby.black : lobby.side === "b" ? lobby.white : undefined;
  const canReport = !!opponent && !opponent.isBot && typeof opponent.id === "number";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-6 lg:ml-0 lg:mr-auto lg:flex-row lg:items-start lg:justify-start">
      <ConfirmDialog
        open={showResignConfirm}
        title="Resign the game?"
        message="This counts as a loss and docks a small ARENA penalty. Are you sure?"
        confirmLabel="Resign"
        cancelLabel="Keep playing"
        danger
        onConfirm={() => {
          setShowResignConfirm(false);
          socket.emit("resign");
        }}
        onCancel={() => setShowResignConfirm(false)}
      />
      {showReport && opponent?.name && (
        <ReportModal
          reportedName={opponent.name}
          gameCode={initialLobby.code}
          chatSnapshot={chatMessages
            .filter((m) => m.author?.name !== "server")
            .map((m) => `${m.author?.name || "?"}: ${m.message}`)
            .join("\n")}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Game-over result — shown to both players and spectators */}
      {gameOverData &&
        (() => {
          const { reason, winnerName, winnerSide, gameId } = gameOverData;
          const isPlayer = lobby.side === "w" || lobby.side === "b";
          let outcome: "win" | "loss" | "draw" | "spectator";
          if (!isPlayer) {
            outcome = "spectator";
          } else if (!winnerSide || winnerSide === "draw") {
            outcome = "draw";
          } else if (
            (lobby.side === "w" && winnerSide === "white") ||
            (lobby.side === "b" && winnerSide === "black")
          ) {
            outcome = "win";
          } else {
            outcome = "loss";
          }
          return (
            <GameOverModal
              outcome={outcome}
              reason={reason}
              winnerName={winnerName}
              didResign={outcome === "loss" && reason === "resignation"}
              gameId={gameId}
              gameCode={lobby.code}
              resignPenalty={RESIGN_PENALTY}
            />
          );
        })()}

      <div className="w-full max-w-[560px]">
        <div
          className="glass-dark relative overflow-hidden rounded-2xl p-2.5 sm:p-3"
          style={{ border: "1px solid rgba(201,162,39,0.2)" }}
        >
          <div className="tricolor-bar absolute inset-x-0 top-0 z-20 rounded-none" />
          {/* waiting-for-opponent overlay */}
          {(!lobby.white?.id || !lobby.black?.id) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur-sm">
              <div className="glass-dark flex flex-col items-center gap-3 rounded-xl px-6 py-5 text-center">
                <span className="text-sm text-[#d8ccb0]">Waiting for opponent…</span>
                {session?.user?.id !== lobby.white?.id &&
                  session?.user?.id !== lobby.black?.id && (
                    <button className="btn-gold text-sm" onClick={clickPlay} disabled={playBtnLoading}>
                      Play as {lobby.white?.id ? "black" : "white"}
                    </button>
                  )}
              </div>
            </div>
          )}

          {/* floating emote reactions over the board */}
          {emotes.length > 0 && (
            <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
              {emotes.map((e, i) => (
                <div
                  key={e.id}
                  className="emote-float absolute flex flex-col items-center"
                  style={{
                    left: `${e.mine ? 22 : 62}%`,
                    bottom: "14%",
                    transform: `translateX(${(i % 3) * 14 - 14}px)`
                  }}
                >
                  <span className="text-4xl drop-shadow-lg sm:text-5xl">{e.key}</span>
                  <span className="mt-0.5 max-w-[8rem] truncate rounded-full bg-black/55 px-2 py-0.5 text-[0.6rem] font-medium text-[#e8dcc0]">
                    {e.from}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mx-auto w-fit overflow-hidden rounded-lg">
            <Chessboard
              boardWidth={boardWidth}
              customPieces={ethiopianPieces}
              customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
              customLightSquareStyle={{ backgroundColor: boardTheme.light }}
              position={navFen || lobby.actualGame.fen()}
              boardOrientation={lobby.side === "b" ? "black" : "white"}
              isDraggablePiece={isDraggablePiece}
              onPieceDragBegin={onPieceDragBegin}
              onPieceDragEnd={onPieceDragEnd}
              onPieceDrop={onDrop}
              onSquareClick={onSquareClick}
              onSquareRightClick={onSquareRightClick}
              arePremovesAllowed={!navFen}
              customSquareStyles={{
                ...(navIndex === null ? customSquares.lastMove : getNavMoveSquares()),
                ...(navIndex === null ? customSquares.check : {}),
                ...customSquares.rightClicked,
                ...(navIndex === null ? customSquares.options : {})
              }}
              ref={chessboardRef}
            />
          </div>
        </div>

        {/* emote reaction bar */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {EMOTES.map((em) => (
            <button
              key={em}
              onClick={() => sendEmote(em)}
              className="rounded-lg border border-[rgba(201,162,39,0.18)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-lg leading-none transition hover:scale-110 hover:border-[rgba(201,162,39,0.5)] hover:bg-[rgba(201,162,39,0.12)] active:scale-95"
              title="Send reaction"
            >
              {em}
            </button>
          ))}
        </div>

        <BoardThemePicker theme={boardTheme} onChange={setBoardTheme} />
      </div>

      <div className="flex w-full flex-col gap-4 lg:w-[344px]">
        {/* Wager panel — only for wager-mode games. Casual games never mount it. */}
        {lobby.mode === "wager" && lobby.code && (
          <WagerPanel
            gameCode={lobby.code}
            myUserId={session?.user?.id as number | undefined}
            amPlayer={lobby.side === "w" || lobby.side === "b"}
          />
        )}

        {/* Players + whose turn */}
        <div
          className="glass-dark rounded-2xl p-3"
          style={{ border: "1px solid rgba(201,162,39,0.15)" }}
        >
          {playerCard(lobby.side === "b" ? "white" : "black")}
          <div className="my-2 flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-[rgba(201,162,39,0.15)]" />
            {lobby.pgn &&
            lobby.white?.id &&
            lobby.black?.id &&
            !lobby.endReason &&
            lobby.side !== "s" ? (
              <button
                onClick={resignGame}
                className="rounded-full border border-[rgba(224,102,102,0.4)] px-3 py-1 text-xs font-semibold text-[#e06666] transition hover:bg-[rgba(184,24,24,0.15)]"
              >
                Resign
              </button>
            ) : (
              <span className="text-xs uppercase tracking-widest text-[rgba(216,204,176,0.35)]">
                vs
              </span>
            )}
            <span className="h-px flex-1 bg-[rgba(201,162,39,0.15)]" />
          </div>
          {playerCard(lobby.side === "b" ? "black" : "white")}
          {canReport && (
            <button
              onClick={() => setShowReport(true)}
              className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-[rgba(216,204,176,0.4)] transition hover:text-[#e06666]"
            >
              ⚑ Report {opponent?.name}
            </button>
          )}
        </div>

        {/* Opponent-disconnected / claim banner */}
        {!lobby.endReason &&
          lobby.pgn &&
          ((lobby.white && session?.user?.id === lobby.white?.id && lobby.black && !lobby.black?.connected) ||
            (lobby.black && session?.user?.id === lobby.black?.id && lobby.white && !lobby.white?.connected)) && (
            <div className="rounded-xl border border-[rgba(201,162,39,0.25)] bg-[rgba(13,22,18,0.75)] p-3 text-sm text-[#d8ccb0]">
              {abandonSeconds > 0 ? (
                <span>
                  Opponent disconnected — you can claim the result in{" "}
                  <span className="font-semibold text-[#E8C040]">{abandonSeconds}s</span>.
                </span>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>Opponent disconnected.</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => claimAbandoned("win")}
                      className="rounded-full bg-[#E8C040] px-3 py-1 text-xs font-semibold text-[#0d1612]"
                    >
                      Claim win
                    </button>
                    <button
                      onClick={() => claimAbandoned("draw")}
                      className="rounded-full border border-[rgba(201,162,39,0.3)] px-3 py-1 text-xs font-semibold text-[#d8ccb0]"
                    >
                      Draw
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Moves */}
        <div
          className="glass-dark rounded-2xl p-3"
          style={{ border: "1px solid rgba(201,162,39,0.15)" }}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-[#E8C040]">
              Moves
            </h3>
            <div className={"dropdown dropdown-end" + (copiedLink ? " dropdown-open" : "")}>
              <label
                tabIndex={0}
                onClick={copyInvite}
                className="flex cursor-pointer items-center gap-1 rounded-full bg-[rgba(201,162,39,0.12)] px-2.5 py-1 font-mono text-xs text-[#E8C040] transition hover:bg-[rgba(201,162,39,0.2)]"
              >
                <IconCopy size={13} />
                {lobby.endReason ? `archive/${lobby.id}` : initialLobby.code}
              </label>
              <div tabIndex={0} className="dropdown-content badge badge-neutral text-xs shadow">
                copied!
              </div>
            </div>
          </div>
          <div
            className="h-36 overflow-y-auto rounded-lg bg-[rgba(13,22,18,0.5)] p-1"
            ref={moveListRef}
          >
            {lobby.actualGame.history().length ? (
              <table className="w-full">
                <tbody>{getMoveListHtml()}</tbody>
              </table>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[rgba(216,204,176,0.35)]">
                No moves yet
              </div>
            )}
          </div>
          <div className="mt-2 flex gap-1">
            {[
              { icon: <IconPlayerSkipBack size={16} />, fn: () => navigateMove(0), off: navIndex === 0 || lobby.actualGame.history().length <= 1 },
              { icon: <IconChevronLeft size={16} />, fn: () => navigateMove(navIndex === null ? "prev" : navIndex - 1), off: navIndex === 0 || lobby.actualGame.history().length <= 1 },
              { icon: <IconChevronRight size={16} />, fn: () => navigateMove(navIndex === null ? null : navIndex + 1), off: navIndex === null },
              { icon: <IconPlayerSkipForward size={16} />, fn: () => navigateMove(null), off: navIndex === null },
            ].map((b, i) => (
              <button
                key={i}
                onClick={b.fn}
                disabled={b.off}
                className="flex flex-1 items-center justify-center rounded-lg bg-[rgba(201,162,39,0.1)] py-2 text-[#E8C040] transition hover:bg-[rgba(201,162,39,0.2)] disabled:opacity-30"
              >
                {b.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Video + chat — hidden for computer games (no human to talk to) */}
        {!lobby.vsBot && !lobby.white?.isBot && !lobby.black?.isBot && (
        <div
          className="glass-dark rounded-2xl p-3"
          style={{ border: "1px solid rgba(201,162,39,0.15)" }}
        >
          {lobby.white && lobby.black && lobby.code && (
            <JitsiVideo gameCode={lobby.code} isPlayer={lobby.side === "w" || lobby.side === "b"} />
          )}
          <div className="mt-2 flex h-56 flex-col rounded-lg bg-[rgba(13,22,18,0.5)] p-3">
            <ul
              className="mb-3 flex flex-1 flex-col gap-1.5 overflow-y-auto break-words text-sm"
              ref={chatListRef}
            >
              {chatMessages.map((m, i) => {
                const isServer = !m.author.id && m.author.name === "server";
                return (
                  <li
                    key={i}
                    className={
                      isServer
                        ? "rounded bg-[rgba(201,162,39,0.08)] px-2 py-1 text-xs text-[rgba(216,204,176,0.6)]"
                        : "text-[#d8ccb0]"
                    }
                  >
                    {m.author.id && (
                      <a
                        className={
                          "font-semibold " +
                          (typeof m.author.id === "number" ? "text-[#E8C040] hover:underline" : "")
                        }
                        href={typeof m.author.id === "number" ? `/user/${m.author.name}` : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {m.author.name}:{" "}
                      </a>
                    )}
                    <span>{m.message}</span>
                  </li>
                );
              })}
            </ul>
            <form className="flex gap-1.5" onSubmit={chatClickSend}>
              <input
                type="text"
                placeholder="Chat here…"
                className="input-field flex-grow !py-2 text-sm"
                name="chatInput"
                id="chatInput"
                onKeyUp={chatKeyUp}
                required
              />
              <button className="btn-dark !px-4 !py-2 text-sm" type="submit">
                Send
              </button>
            </form>
          </div>
        </div>
        )}

        {lobby.observers && lobby.observers.length > 0 && (
          <p className="px-1 text-xs text-[rgba(216,204,176,0.4)]">
            Spectators: {lobby.observers?.map((o) => o.name).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
