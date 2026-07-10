import { Router } from "express";

import {
    requestDeposit,
    myDeposits,
    listDeposits,
    approveDeposit,
    rejectDeposit
} from "../controllers/deposit.controller.js";
import { requireAdmin } from "../util/admin.js";

const router = Router();

// Player
router.route("/").post(requestDeposit);
router.route("/mine").get(myDeposits);

// Admin
router.route("/admin").get(requireAdmin, listDeposits);
router.route("/:id/approve").post(requireAdmin, approveDeposit);
router.route("/:id/reject").post(requireAdmin, rejectDeposit);

export default router;
