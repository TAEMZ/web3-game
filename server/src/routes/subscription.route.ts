import { Router } from "express";

import {
    getStatus,
    requestSubscription,
    listRequests,
    approveRequest,
    rejectRequest
} from "../controllers/subscription.controller.js";
import { requireAdmin } from "../util/admin.js";

const router = Router();

router.get("/", getStatus);
router.post("/", requestSubscription);
router.get("/admin", requireAdmin, listRequests);
router.post("/:id/approve", requireAdmin, approveRequest);
router.post("/:id/reject", requireAdmin, rejectRequest);

export default router;
