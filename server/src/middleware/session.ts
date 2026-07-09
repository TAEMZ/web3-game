import type { User } from "@arena/types";
import PGSimple from "connect-pg-simple";
import type { Session } from "express-session";
import session from "express-session";
import { nanoid } from "nanoid";

import { db } from "../db/index.js";

const PGSession = PGSimple(session);

declare module "express-session" {
    // eslint-disable-next-line no-unused-vars
    interface SessionData {
        user: User;
        walletNonce?: string;
    }
}
declare module "http" {
    // eslint-disable-next-line no-unused-vars
    interface IncomingMessage {
        session: Session & {
            user: User;
            walletNonce?: string;
        };
    }
}
const pgStore = new PGSession({ pool: db, createTableIfMissing: true });
pgStore.on('error', function(err) {
    console.error('Session store error:', err.message);
});

const sessionMiddleware = session({
    store: pgStore,
    secret: process.env.SESSION_SECRET || "make sure to change this!",
    resave: false,
    saveUninitialized: false,
    name: "arena",
    proxy: true,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: process.env.NODE_ENV === "production" ? true : false,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    },
    genid: function () {
        return nanoid(21);
    }
});

export default sessionMiddleware;
