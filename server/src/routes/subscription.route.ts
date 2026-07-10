import { Router } from "express";

import {
    getStatus,
    requestSubscription,
    listRequests,
    approveRequest,
    rejectRequest
} from "../controllers/subscription.controller.js";

const router = Router();

router.get("/", getStatus);
router.post("/", requestSubscription);
router.get("/admin", listRequests);
router.post("/:id/approve", approveRequest);
router.post("/:id/reject", rejectRequest);

export default router;
