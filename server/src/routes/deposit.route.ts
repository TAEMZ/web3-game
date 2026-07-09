import { Router } from "express";

import {
    requestDeposit,
    myDeposits,
    listDeposits,
    approveDeposit,
    rejectDeposit
} from "../controllers/deposit.controller.js";

const router = Router();

// Player
router.route("/").post(requestDeposit);
router.route("/mine").get(myDeposits);

// Admin (guarded inside the controller via isAdminUser)
router.route("/admin").get(listDeposits);
router.route("/:id/approve").post(approveDeposit);
router.route("/:id/reject").post(rejectDeposit);

export default router;
