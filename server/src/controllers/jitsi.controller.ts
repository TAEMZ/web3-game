import type { Request, Response } from "express";
import { createSign } from "node:crypto";

// JaaS (Jitsi as a Service) token minting for the in-game video call. The private
// key lives ONLY in the server env (never in the repo or the browser). We sign a
// short-lived JWT that vouches for the already-logged-in chess user, so they join
// the Jitsi room as their chess username with NO Jitsi/Google login of their own.
const APP_ID = process.env.JAAS_APP_ID || "vpaas-magic-cookie-9cea7e6134b846cd9883d0ff27cb4dfe";
// Non-secret key identifier (it rides in every token header). Override via env if
// you rotate the key. Only the PRIVATE KEY below is a secret and must come from env.
const KID = process.env.JAAS_KID || "vpaas-magic-cookie-9cea7e6134b846cd9883d0ff27cb4dfe/20c892";
// Accept either a real multi-line PEM or a "\n"-escaped single-line env value.
const PRIVATE_KEY = (process.env.JAAS_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const b64url = (input: string) => Buffer.from(input).toString("base64url");

export const jitsiToken = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id) return res.status(401).end();
    // Not configured yet (no key/kid in env) — tell the client so it can show a
    // friendly "video isn't set up" instead of erroring.
    if (!KID || !PRIVATE_KEY) {
        return res.status(503).json({ error: "Video calling isn't set up yet." });
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT", kid: KID };
    const payload = {
        aud: "jitsi",
        iss: "chat",
        sub: APP_ID,
        room: "*",
        iat: now,
        nbf: now - 10,
        exp: now + 3 * 60 * 60, // 3 hours
        context: {
            features: {
                livestreaming: false,
                "file-upload": false,
                "outbound-call": false,
                "sip-outbound-call": false,
                transcription: false,
                "list-visitors": false,
                recording: false,
                flip: false
            },
            user: {
                "hidden-from-recorder": false,
                moderator: true,
                name: user.name || "Player",
                id: String(user.id),
                avatar: "",
                email: ""
            }
        }
    };

    try {
        const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
        const signature = createSign("RSA-SHA256").update(signingInput).sign(PRIVATE_KEY, "base64url");
        return res.json({ token: `${signingInput}.${signature}`, appId: APP_ID });
    } catch (err) {
        console.error("jitsi token sign failed", err);
        return res.status(500).json({ error: "Could not create a video token." });
    }
};
