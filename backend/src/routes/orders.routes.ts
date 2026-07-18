import { Router } from "express";
import { getMyOrders, getMyOrderById } from "../controllers/orders.controller.js";
import { trackOrder } from "../controllers/tracking.controller.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const ordersRouter = Router();

// Public — guest order tracking by order number + email
ordersRouter.get("/track", trackOrder);

// Customer: own orders only
ordersRouter.get("/my", requireAuth, requireRole("customer"), getMyOrders);
ordersRouter.get("/my/:id", requireAuth, requireRole("customer"), getMyOrderById);
