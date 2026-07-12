import { Router } from "express";

import { ensureGasForMe } from "../controllers/wallet.controller.js";

const router = Router();

router.route("/ensure-gas").post(ensureGasForMe);

export default router;
