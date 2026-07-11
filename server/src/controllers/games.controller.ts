import type { Game, User } from "@arena/types";
import type { Request, Response } from "express";
import { Chess } from "chess.js";
import { nanoid } from "nanoid";

import GameModel, { activeGames } from "../db/models/game.model.js";
import UserModel from "../db/models/user.model.js";
import { getBotMove } from "../bot/index.js";

const DIFFICULTY_LABEL: Record<string, string> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard"
};

export const getGames = async (req: Request, res: Response) => {
    try {
        if (!req.query.id && !req.query.userid) {
            // get all active games
            res.status(200).json(activeGames.filter((g) => !g.unlisted && !g.winner));
            return;
        }

        let id, userid;
        if (req.query.id) {
            id = parseInt(req.query.id as string);
        }
        if (req.query.userid) {
            userid = parseInt(req.query.userid as string);
        }

        if (id && !isNaN(id)) {
            // get finished game by id
            const game = await GameModel.findById(id);
            if (!game) {
                res.status(404).end();
            } else {
                res.status(200).json(game);
            }
        } else if (userid && !isNaN(userid)) {
            // get finished games by user id
            const games = await GameModel.findByUserId(userid);
            if (!games) {
                res.status(404).end();
            } else {
                res.status(200).json(games);
            }
        } else {
            res.status(400).end();
        }
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const getActiveGame = async (req: Request, res: Response) => {
    try {
        if (!req.params || !req.params.code) {
            res.status(400).end();
            return;
        }

        const game = activeGames.find((g) => g.code === req.params.code);

        if (!game) {
            res.status(404).end();
        } else {
            res.status(200).json(game);
        }
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const createGame = async (req: Request, res: Response) => {
    try {
        if (!req.session.user?.id) {
            console.log("unauthorized createGame");
            res.status(401).end();
            return;
        }
        const user: User = {
            id: req.session.user.id,
            name: req.session.user.name,
            connected: false
        };
        const unlisted: boolean = req.body.unlisted ?? false;
        const vsBot: boolean = req.body.vsBot === true;
        const difficulty: "easy" | "medium" | "hard" = ["easy", "medium", "hard"].includes(
            req.body.difficulty
        )
            ? req.body.difficulty
            : "medium";

        // Wager mode mounts the betting panel; casual never does. Bot games are
        // always casual — there's no one to bet against.
        const mode: "casual" | "wager" = req.body.mode === "wager" && !vsBot ? "wager" : "casual";

        // Wager games require the one-time Arena Pass (backstop — the UI also gates this).
        if (mode === "wager" && typeof user.id === "number") {
            const owner = await UserModel.findById(user.id);
            if (!owner?.subscribed) {
                res.status(403).json({ error: "Arena Pass required to create wager matches." });
                return;
            }
        }

        // Wager stake chosen up-front (0 = not set yet; the player can still set it
        // in-game). Stored on the game so the live list can show the pool before joining.
        const stakeAmt = mode === "wager" ? Math.max(0, Math.floor(Number(req.body.stake) || 0)) : 0;

        const game: Game = {
            code: nanoid(6),
            // Computer games are always private — no reason to list them publicly.
            unlisted: vsBot ? true : unlisted,
            host: user,
            mode,
            ...(stakeAmt > 0 ? { stake: stakeAmt } : {}),
            pgn: ""
        };

        // Decide which colour the human takes.
        let humanSide: "white" | "black";
        if (req.body.side === "white") {
            humanSide = "white";
        } else if (req.body.side === "black") {
            humanSide = "black";
        } else {
            humanSide = Math.floor(Math.random() * 2) === 0 ? "white" : "black";
        }

        if (vsBot) {
            const bot: User = {
                id: "bot",
                name: `Computer (${DIFFICULTY_LABEL[difficulty]})`,
                isBot: true,
                connected: true
            };
            game.vsBot = true;
            game.botDifficulty = difficulty;
            game.startedAt = Date.now();
            if (humanSide === "white") {
                game.white = user;
                game.black = bot;
            } else {
                game.black = user;
                game.white = bot;
                // Bot is white, so it opens the game before the human ever moves.
                const first = await getBotMove("", difficulty);
                if (first) {
                    const chess = new Chess();
                    chess.move({ from: first.from, to: first.to, promotion: first.promotion });
                    game.pgn = chess.pgn();
                }
            }
        } else if (humanSide === "white") {
            game.white = user;
        } else {
            game.black = user;
        }

        activeGames.push(game);

        res.status(201).json({ code: game.code });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};
