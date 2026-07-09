import { Router } from "express";

import admin from "./admin.route.js";
import auth from "./auth.route.js";
import games from "./games.route.js";
import reports from "./reports.route.js";
import users from "./users.route.js";
import rewards from "./rewards.route.js";
import wager from "./wager.route.js";
import deposit from "./deposit.route.js";
import withdrawal from "./withdrawal.route.js";
import leaderboard from "./leaderboard.route.js";
import { getConfig } from "../controllers/config.controller.js";

const router = Router();

router.get("/config", getConfig);
router.use("/games", games);
router.use("/auth", auth);
router.use("/users", users);
router.use("/rewards", rewards);
router.use("/admin", admin);
router.use("/reports", reports);
router.use("/wager", wager);
router.use("/deposits", deposit);
router.use("/withdrawals", withdrawal);
router.use("/leaderboard", leaderboard);

export default router;
