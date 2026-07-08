import { Router } from "express";

import admin from "./admin.route.js";
import auth from "./auth.route.js";
import games from "./games.route.js";
import reports from "./reports.route.js";
import users from "./users.route.js";
import rewards from "./rewards.route.js";

const router = Router();

router.use("/games", games);
router.use("/auth", auth);
router.use("/users", users);
router.use("/rewards", rewards);
router.use("/admin", admin);
router.use("/reports", reports);

export default router;
