// ═══════════════════════════════════════════════════════════════════════════
// Payment Gateways Routes
// ═══════════════════════════════════════════════════════════════════════════

import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import {
  listPaymentGateways,
  getPaymentGateway,
  createPaymentGateway,
  updatePaymentGateway,
  activatePaymentGateway,
  deletePaymentGateway,
} from "../controllers/payment-gateways.controller.js";

const router = Router();

// ─── Admin-only routes ─────────────────────────────────────────────────────

// List all payment gateways
router.get("/", requireAuth, requireRole("admin"), listPaymentGateways);

// Get single gateway (with full unmasked keys for edit form)
router.get("/:id", requireAuth, requireRole("admin"), getPaymentGateway);

// Create new gateway
router.post("/", requireAuth, requireRole("admin"), createPaymentGateway);

// Update gateway
router.put("/:id", requireAuth, requireRole("admin"), updatePaymentGateway);

// Activate gateway (deactivates others of same type)
router.patch("/:id/activate", requireAuth, requireRole("admin"), activatePaymentGateway);

// Delete gateway
router.delete("/:id", requireAuth, requireRole("admin"), deletePaymentGateway);

export default router;
