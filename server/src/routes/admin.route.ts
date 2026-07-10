import { Router } from "express";

import {
    banUser,
    distribute,
    listPlayers,
    listReports,
    listWagers,
    overview,
    requireAdmin,
    resolveReport,
    unbanUser
} from "../controllers/admin.controller.js";

const router = Router();

// Everything under /admin requires an admin session.
router.use(requireAdmin);

router.get("/players", listPlayers);
router.get("/overview", overview);
router.post("/distribute", distribute);
router.get("/reports", listReports);
router.get("/wagers", listWagers);
router.post("/ban", banUser);
router.post("/unban", unbanUser);
router.post("/resolve", resolveReport);

export default router;
