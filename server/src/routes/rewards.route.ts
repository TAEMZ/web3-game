import { Router } from "express";
import { getUserRewards } from "../controllers/rewards.controller.js";

const router = Router();

// Get user's reward history
router.get("/user", getUserRewards);

export default router;
