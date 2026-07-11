import { Router } from "express";
import { getMyOrders, getMyOrderById } from "../controllers/orders.controller.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const ordersRouter = Router();

// Customer: own orders only
ordersRouter.get("/my", requireAuth, requireRole("customer"), getMyOrders);
ordersRouter.get("/my/:id", requireAuth, requireRole("customer"), getMyOrderById);

// Admin/store-manager routes will go here once built
