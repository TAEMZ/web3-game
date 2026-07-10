import { Router } from "express";

import {
    createWager,
    joinWager,
    getWager,
    reserveWager,
    cancelReserve,
    adminSettleWager,
    adminWagerFees
} from "../controllers/wager.controller.js";

const router = Router();

router.route("/").post(createWager);
router.route("/reserve").post(reserveWager);
router.route("/reserve/cancel").post(cancelReserve);
router.route("/join").post(joinWager);
router.route("/settle").post(adminSettleWager);
router.route("/admin/fees").get(adminWagerFees);
router.route("/:gameCode").get(getWager);

export default router;
