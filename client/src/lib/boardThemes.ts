// Board colour themes the player can pick. Client-only preference (localStorage);
// no backend involvement — it only sets the light/dark square colours.
export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: "gold", name: "Ethiopian Gold", light: "#efe0b8", dark: "#8a6d25" },
  { id: "emerald", name: "Emerald", light: "#e9f2e4", dark: "#1a6b3f" },
  { id: "walnut", name: "Walnut", light: "#f0d9b5", dark: "#8a5a3c" },
  { id: "arena", name: "Arena Blue", light: "#eae9d2", dark: "#4b7399" },
  { id: "slate", name: "Slate", light: "#dfe3e8", dark: "#546072" },
  { id: "obsidian", name: "Obsidian", light: "#b7bcc4", dark: "#2b3138" },
];

export const DEFAULT_BOARD_ID = "gold";
const STORAGE_KEY = "arena.boardTheme";

export function defaultBoardTheme(): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === DEFAULT_BOARD_ID) ?? BOARD_THEMES[0];
}

// Read the saved theme. Safe to call on the client only (guards `window`).
export function getBoardTheme(): BoardTheme {
  if (typeof window !== "undefined") {
    const id = window.localStorage.getItem(STORAGE_KEY);
    const match = BOARD_THEMES.find((t) => t.id === id);
    if (match) return match;
  }
  return defaultBoardTheme();
}

export function setStoredBoardTheme(id: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
}
