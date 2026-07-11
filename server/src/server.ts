import cors from "cors";
import "dotenv/config";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";

import { INIT_TABLES, db } from "./db/index.js";
import session from "./middleware/session.js";
import routes from "./routes/index.js";
import { init as initSocket } from "./socket/index.js";

const corsConfig = {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
};

const app = express();
const server = createServer(app);

// database
await db.connect();
db.query(INIT_TABLES, (err) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Tables initialized");
    }
});

// --- abuse protection ---------------------------------------------------------
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200, // 200 requests/min/IP overall — stops trivial DoS
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests — slow down." }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40, // 40 auth attempts / 15 min / IP — blocks password brute-force, signup spam, faucet loop
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts — please try again in a bit." }
});

// CSRF: session cookies are sameSite=none (client on Vercel, API on Render), so a
// malicious site could ride a logged-in cookie to hit mutating endpoints. Require
// every state-changing request to come from an allowed origin — browsers set the
// Origin/Referer header on cross-site requests and page JS cannot forge it.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
function csrfGuard(req: Request, res: Response, next: NextFunction) {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
        next();
        return;
    }
    const origin = req.get("origin") || "";
    const referer = req.get("referer") || "";
    const ok = ALLOWED_ORIGINS.some((o) => origin === o || (!!referer && referer.startsWith(o)));
    if (!ok) {
        res.status(403).json({ error: "Cross-site request blocked." });
        return;
    }
    next();
}

// middleware
app.set("trust proxy", 1); // Render sits behind a proxy — real client IP for rate limits
app.use(cors(corsConfig));
app.use(globalLimiter);
app.use(csrfGuard);
app.use(express.json());
app.use(session);
app.use("/v1/auth", authLimiter); // tighter limit on auth routes
app.use("/v1", routes);

// socket.io
export const io = new Server(server, { cors: corsConfig, pingInterval: 30000, pingTimeout: 50000 });
io.use((socket, next) => {
    session(socket.request as Request, {} as Response, next as NextFunction);
});
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
        next();
    } else {
        console.log("io.use: no session");
        socket.disconnect();
    }
});
initSocket();

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`arena api server listening on :${port}`);
});
