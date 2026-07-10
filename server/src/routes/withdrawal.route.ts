import { Router } from "express";

import {
    requestWithdrawal,
    myWithdrawals,
    listWithdrawals,
    payWithdrawal,
    rejectWithdrawal
} from "../controllers/withdrawal.controller.js";
import { requireAdmin } from "../util/admin.js";

const router = Router();

// Player
router.route("/").post(requestWithdrawal);
router.route("/mine").get(myWithdrawals);

// Admin
router.route("/admin").get(requireAdmin, listWithdrawals);
router.route("/:id/pay").post(requireAdmin, payWithdrawal);
router.route("/:id/reject").post(requireAdmin, rejectWithdrawal);

export default router;
