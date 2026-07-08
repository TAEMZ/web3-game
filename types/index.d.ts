export interface Game {
    id?: number;
    pgn?: string;
    white?: User;
    black?: User;
    winner?: "white" | "black" | "draw";
    endReason?: "draw" | "checkmate" | "stalemate" | "repetition" | "insufficient" | "abandoned" | "resignation";
    host?: User;
    code?: string;
    unlisted?: boolean;
    timeout?: number;
    observers?: User[];
    startedAt?: number;
    endedAt?: number;
    vsBot?: boolean;
    botDifficulty?: "easy" | "medium" | "hard";
}

export interface User {
    id?: number | string; // string for guest IDs
    name?: string | null;
    email?: string;
    wins?: number;
    losses?: number;
    draws?: number;
    resignations?: number; // games quit via resign; incurs a token penalty

    // mainly for players, not spectators
    connected?: boolean;
    disconnectedOn?: number;

    walletAddress?: string;

    isBot?: boolean; // computer opponent occupying a player seat
    is_admin?: boolean; // elevated dashboard access
    banned?: boolean; // blocked from logging in / playing
}
