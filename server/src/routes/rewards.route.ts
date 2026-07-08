import { Router } from "express";
import { getUserRewards, processGameRewards } from "../controllers/rewards.controller.js";

const router = Router();

// Process rewards after game ends
router.post("/process", processGameRewards);

// Get user's reward history
router.get("/user", getUserRewards);

export default router;
