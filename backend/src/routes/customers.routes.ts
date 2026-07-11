import { Router } from "express";
import {
  getMe,
  updateMe,
  changePassword,
  getAddresses,
  updateAddresses,
} from "../controllers/customers.controller.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const customersRouter = Router();

// All routes require a logged-in customer
customersRouter.get("/me", requireAuth, requireRole("customer"), getMe);
customersRouter.patch("/me", requireAuth, requireRole("customer"), updateMe);
customersRouter.post("/me/change-password", requireAuth, requireRole("customer"), changePassword);
customersRouter.get("/me/addresses", requireAuth, requireRole("customer"), getAddresses);
customersRouter.put("/me/addresses", requireAuth, requireRole("customer"), updateAddresses);
