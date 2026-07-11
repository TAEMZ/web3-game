import type { User } from "@arena/types";
import { hash, verify } from "argon2";
import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { recoverMessageAddress } from "viem";
import xss from "xss";

import { activeGames } from "../db/models/game.model.js";
import UserModel from "../db/models/user.model.js";
import { isAdminUser } from "../util/admin.js";
import { clientIp, isIpBanned, recordUserIp } from "../util/moderation.js";
import { fundGasIfLow } from "../web3/gas.js";
import { dripUsdIfLow } from "../web3/usd.js";
import { io } from "../server.js";

export const getCurrentSession = async (req: Request, res: Response) => {
    try {
        if (req.session.user) {
            res.status(200).json(req.session.user);
        } else {
            res.status(204).end();
        }
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const guestSession = async (req: Request, res: Response) => {
    try {
        if (req.session.user?.id && typeof req.session.user.id === "number") {
            res.status(403).end();
            return;
        }
        const name = xss(req.body.name);

        const pattern = /^[A-Za-z0-9]+$/;

        if (!pattern.test(name)) {
            res.status(400).end();
            return;
        }

        if (!req.session.user || !req.session.user?.id) {
            // create guest session. The guest's user id must NOT be the session id
            // (that would broadcast the auth credential to the room) — use a random id.
            const user: User = {
                id: `g-${nanoid(16)}`,
                name
            };
            req.session.user = user;
        } else if (typeof req.session.user.id === "string" && req.session.user.name !== name) {
            // update guest name
            req.session.user.name = name;

            const game = activeGames.find(
                (g) =>
                    g.white?.id === req.session.user.id ||
                    g.black?.id === req.session.user.id ||
                    g.observers?.find((o) => o.id === req.session.user.id)
            );
            if (game) {
                if (game.host?.id === req.session.user.id) {
                    game.host.name = name;
                }
                if (game.white?.id === req.session.user.id) {
                    game.white.name = name;
                } else if (game.black?.id === req.session.user.id) {
                    game.black.name = name;
                } else {
                    const observer = game.observers?.find((o) => o.id === req.session.user.id);
                    if (observer) {
                        observer.name = name;
                    }
                }
                io.to(game.code as string).emit("receivedLatestGame", game);
            }
        }
        req.session.save(() => {
            res.status(201).json(req.session.user);
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const logoutSession = async (req: Request, res: Response) => {
    try {
        req.session.destroy(() => {
            res.status(204).end();
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const registerUser = async (req: Request, res: Response) => {
    try {
        if (req.session.user?.id && typeof req.session.user.id === "number") {
            res.status(403).end();
            return;
        }

        const ip = clientIp(req);
        if (await isIpBanned(ip)) {
            res.status(403).json({ message: "Access from your network is blocked." });
            return;
        }

        const name = xss(req.body.name);
        const email = xss(req.body.email);
        const rawPassword = String(req.body.password || "");

        const pattern = /^[A-Za-z0-9]+$/;
        if (!pattern.test(name)) {
            res.status(400).json({ message: "Username must be letters and numbers only." });
            return;
        }
        // Enforce a reasonably strong password server-side (never trust the client):
        // at least 8 characters, with at least one letter and one number.
        if (rawPassword.length < 8 || !/[A-Za-z]/.test(rawPassword) || !/[0-9]/.test(rawPassword)) {
            res.status(400).json({
                message: "Password must be at least 8 characters and include a letter and a number."
            });
            return;
        }
        const password = await hash(rawPassword);

        const compareEmail = email || name;
        const duplicateUsers = await UserModel.findByNameEmail({ name, email: compareEmail });
        if (duplicateUsers && duplicateUsers.length) {
            const dupl = duplicateUsers[0].name === name ? "Username" : "Email";
            res.status(409).json({ message: `${dupl} is already in use.` });
            return;
        }

        const newUser = await UserModel.create({ name, email }, password);
        if (!newUser) {
            throw new Error("Failed to create user");
        }

        const publicUser = {
            id: newUser.id,
            name: newUser.name
        };
        if (req.session.user?.id && typeof req.session.user.id === "string") {
            const game = activeGames.find(
                (g) =>
                    g.white?.id === req.session.user.id ||
                    g.black?.id === req.session.user.id ||
                    g.observers?.find((o) => o.id === req.session.user.id)
            );
            if (game) {
                if (game.host?.id === req.session.user.id) {
                    game.host = publicUser;
                }
                if (game.white && game.white?.id === req.session.user.id) {
                    game.white = publicUser;
                } else if (game.black && game.black?.id === req.session.user.id) {
                    game.black = publicUser;
                } else {
                    const observer = game.observers?.find((o) => o.id === req.session.user.id);
                    if (observer) {
                        observer.id = publicUser.id;
                        observer.name = publicUser.name;
                    }
                }
                io.to(game.code as string).emit("receivedLatestGame", game);
            }
        }

        req.session.user = { ...newUser, is_admin: isAdminUser(newUser) };
        if (req.session.user.is_admin && typeof newUser.id === "number") {
            await UserModel.promoteAdmin(newUser.id);
        }
        if (typeof newUser.id === "number") await recordUserIp(newUser.id, ip);
        req.session.save(() => {
            res.status(201).json(req.session.user);
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const loginUser = async (req: Request, res: Response) => {
    try {
        if (req.session.user?.id && typeof req.session.user.id === "number") {
            res.status(403).end();
            return;
        }

        const nameOrEmail = xss(req.body.name);
        const password = req.body.password;

        const ip = clientIp(req);
        if (await isIpBanned(ip)) {
            res.status(403).json({ message: "Access from your network is blocked." });
            return;
        }

        const users = await UserModel.findByNameEmail(
            { name: nameOrEmail, email: nameOrEmail },
            true
        );
        if (!users || !users.length) {
            res.status(404).json({ message: "Invalid username/email." });
            return;
        }

        const validPassword = await verify(users[0].password as string, password);
        if (!validPassword) {
            res.status(401).json({ message: "Invalid password." });
            return;
        }

        if (users[0].banned) {
            res.status(403).json({ message: "This account has been banned." });
            return;
        }
        if (typeof users[0].id === "number") await recordUserIp(users[0].id, ip);

        const publicUser = {
            id: users[0].id,
            name: users[0].name
        };

        if (req.session.user?.id && typeof req.session.user.id === "string") {
            const game = activeGames.find(
                (g) =>
                    g.white?.id === req.session.user.id ||
                    g.black?.id === req.session.user.id ||
                    g.observers?.find((o) => o.id === req.session.user.id)
            );
            if (game) {
                if (game.host?.id === req.session.user.id) {
                    game.host = publicUser;
                }
                if (game.white && game.white?.id === req.session.user.id) {
                    game.white = publicUser;
                } else if (game.black && game.black?.id === req.session.user.id) {
                    game.black = publicUser;
                } else {
                    const observer = game.observers?.find((o) => o.id === req.session.user.id);
                    if (observer) {
                        observer.id = publicUser.id;
                        observer.name = publicUser.name;
                    }
                }
                io.to(game.code as string).emit("receivedLatestGame", game);
            }
        }

        req.session.user = {
            id: users[0].id,
            name: users[0].name,
            email: users[0].email,
            wins: users[0].wins,
            losses: users[0].losses,
            draws: users[0].draws,
            // Carry the linked wallet so the client can tell YOUR wallet from a
            // stranger's left connected — and keep yours without a reconnect.
            walletAddress: users[0].wallet_address || undefined,
            subscribed: users[0].subscribed,
            is_admin: isAdminUser(users[0])
        };
        if (req.session.user.is_admin && typeof users[0].id === "number") {
            await UserModel.promoteAdmin(users[0].id);
        }
        req.session.save(() => {
            res.status(200).json(req.session.user);
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        if (!req.session.user?.id || typeof req.session.user.id === "string") {
            res.status(403).end();
            return;
        }

        if (!req.body.name && !req.body.email && !req.body.password) {
            res.status(400).end();
            return;
        }

        const name = xss(req.body.name || req.session.user.name);
        const pattern = /^[A-Za-z0-9]+$/;
        if (!pattern.test(name)) {
            res.status(400).end();
            return;
        }

        const email = xss(req.body.email || req.session.user.email);
        const compareEmail = email || name;

        const duplicateUsers = await UserModel.findByNameEmail({ name, email: compareEmail });
        if (
            duplicateUsers &&
            duplicateUsers.length &&
            duplicateUsers[0].id !== req.session.user.id
        ) {
            const dupl = duplicateUsers[0].name === name ? "Username" : "Email";
            res.status(409).json({ message: `${dupl} is already in use.` });
            return;
        }

        let password: string | undefined = undefined;
        if (req.body.password) {
            password = await hash(req.body.password);
        }

        const updatedUser = await UserModel.update(req.session.user.id, { name, email, password });

        if (!updatedUser) {
            throw new Error("Failed to update user");
        }

        const publicUser = {
            id: updatedUser.id,
            name: updatedUser.name
        };

        const game = activeGames.find(
            (g) =>
                g.white?.id === req.session.user.id ||
                g.black?.id === req.session.user.id ||
                g.observers?.find((o) => o.id === req.session.user.id)
        );
        if (game) {
            if (game.host?.id === req.session.user.id) {
                game.host = publicUser;
            }
            if (game.white && game.white?.id === req.session.user.id) {
                game.white = publicUser;
            } else if (game.black && game.black?.id === req.session.user.id) {
                game.black = publicUser;
            } else {
                const observer = game.observers?.find((o) => o.id === req.session.user.id);
                if (observer) {
                    observer.id = publicUser.id;
                    observer.name = publicUser.name;
                }
            }
            io.to(game.code as string).emit("receivedLatestGame", game);
        }

        req.session.user = { ...updatedUser, is_admin: req.session.user.is_admin };
        req.session.save(() => {
            res.status(200).json(req.session.user);
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

const WALLET_MESSAGE = (nonce: string) => `Sign in to Chess Arena.\n\nNonce: ${nonce}`;

// Friendly default handle for wallet accounts so players see a readable name in
// games instead of a 0x… address. They can rename it later in Settings.
const HANDLE_ADJ = [
    "Swift", "Bold", "Silent", "Golden", "Iron", "Royal", "Shadow", "Clever",
    "Rapid", "Mighty", "Noble", "Fierce", "Cosmic", "Vivid", "Lucky", "Grand"
];
const HANDLE_NOUN = [
    "Knight", "Rook", "Bishop", "Pawn", "Queen", "King", "Gambit", "Castle",
    "Falcon", "Tiger", "Comet", "Sage", "Raven", "Vortex", "Blade", "Phoenix"
];
function randomHandle(): string {
    const a = HANDLE_ADJ[Math.floor(Math.random() * HANDLE_ADJ.length)];
    const n = HANDLE_NOUN[Math.floor(Math.random() * HANDLE_NOUN.length)];
    return `${a}${n}${Math.floor(1000 + Math.random() * 9000)}`;
}

// Step 1: hand the client a one-time nonce to sign, stored in their session.
export const walletNonce = async (req: Request, res: Response) => {
    try {
        const nonce = nanoid(24);
        req.session.walletNonce = nonce;
        req.session.save(() => {
            res.status(200).json({ nonce });
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};

// Step 2: verify the signature proves ownership of the wallet, then log in
// (creating the account on first sight).
export const walletLogin = async (req: Request, res: Response) => {
    try {
        const address = String(req.body.address || "").toLowerCase();
        const signature = String(req.body.signature || "");
        const nonce = req.session.walletNonce;

        if (!nonce || !address || !signature) {
            res.status(400).end();
            return;
        }

        const ip = clientIp(req);
        if (await isIpBanned(ip)) {
            res.status(403).json({ message: "Access from your network is blocked." });
            return;
        }

        let recovered = "";
        try {
            recovered = (
                await recoverMessageAddress({
                    message: WALLET_MESSAGE(nonce),
                    signature: signature as `0x${string}`
                })
            ).toLowerCase();
        } catch {
            res.status(401).json({ message: "Invalid signature." });
            return;
        }

        if (recovered !== address) {
            res.status(401).json({ message: "Signature does not match wallet." });
            return;
        }

        req.session.walletNonce = undefined;

        // Auto-fund the player's gas so they can sign bets without buying test-ETH,
        // and drip a little demo-USD so "dollars" are a real coin in their wallet.
        void fundGasIfLow(address);
        void dripUsdIfLow(address);

        // Already signed in as a REGISTERED account? A wallet connection must NEVER
        // switch you to (or merge in) a different account — a stale wallet left
        // connected in the browser would otherwise hand you someone else's account.
        // Only link it to your account if it's unclaimed and you have none yet;
        // otherwise reject and leave your session exactly as it is.
        const su = req.session.user;
        if (su && typeof su.id === "number") {
            const suWallet = su.walletAddress?.toLowerCase();
            if (suWallet === address) {
                // already your linked wallet — nothing to change
                req.session.save(() => res.status(200).json(su));
                return;
            }
            const existing = await UserModel.findByWallet(address);
            if (existing && existing.id !== su.id) {
                res.status(409).json({ message: "That wallet is already linked to another account." });
                return;
            }
            if (suWallet && suWallet !== address) {
                res.status(409).json({ message: "Your account already has a different wallet linked." });
                return;
            }
            await UserModel.linkWallet(su.id, address);
            const fresh = await UserModel.findById(su.id);
            req.session.user = {
                ...su,
                walletAddress: address,
                wins: fresh?.wins,
                losses: fresh?.losses,
                draws: fresh?.draws,
                subscribed: fresh?.subscribed
            };
            await recordUserIp(su.id, ip);
            req.session.save(() => {
                res.status(200).json(req.session.user);
            });
            return;
        }

        let user = await UserModel.findByWallet(address);
        if (!user) {
            // Retry a few times in case the random handle collides with the UNIQUE name.
            let created: (User & { wallet_address: string }) | null = null;
            for (let i = 0; i < 6 && !created; i++) {
                created = await UserModel.createWithWallet(address, randomHandle());
            }
            if (!created) {
                throw new Error("Failed to create wallet user");
            }
            user = created;
        }

        if (user.banned) {
            res.status(403).json({ message: "This account has been banned." });
            return;
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
            walletAddress: address,
            subscribed: user.subscribed,
            is_admin: isAdminUser(user)
        };
        if (req.session.user.is_admin && typeof user.id === "number") {
            await UserModel.promoteAdmin(user.id);
        }
        if (typeof user.id === "number") await recordUserIp(user.id, ip);
        req.session.save(() => {
            res.status(200).json(req.session.user);
        });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).end();
    }
};
