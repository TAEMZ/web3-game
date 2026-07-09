import { Router } from "express";

import {
    requestWithdrawal,
    myWithdrawals,
    listWithdrawals,
    payWithdrawal,
    rejectWithdrawal
} from "../controllers/withdrawal.controller.js";

const router = Router();

// Player
router.route("/").post(requestWithdrawal);
router.route("/mine").get(myWithdrawals);

// Admin (guarded in controller)
router.route("/admin").get(listWithdrawals);
router.route("/:id/pay").post(payWithdrawal);
router.route("/:id/reject").post(rejectWithdrawal);

export default router;
