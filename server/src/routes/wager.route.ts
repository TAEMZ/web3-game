import { Router } from "express";

import {
    createWager,
    joinWager,
    getWager,
    adminSettleWager
} from "../controllers/wager.controller.js";

const router = Router();

router.route("/").post(createWager);
router.route("/join").post(joinWager);
router.route("/settle").post(adminSettleWager);
router.route("/:gameCode").get(getWager);

export default router;
