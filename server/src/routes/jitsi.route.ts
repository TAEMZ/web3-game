import { Router } from "express";

import { jitsiToken } from "../controllers/jitsi.controller.js";

const router = Router();

// Signs a short-lived JaaS token for the logged-in user to join the game's video room.
router.get("/token", jitsiToken);

export default router;
