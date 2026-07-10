import { Router } from "express";

import { getStatus, subscribe } from "../controllers/subscription.controller.js";

const router = Router();

router.get("/", getStatus);
router.post("/", subscribe);

export default router;
