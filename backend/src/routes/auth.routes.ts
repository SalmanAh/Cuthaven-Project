import { Router } from "express";
import {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  refreshToken,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const authRouter = Router();

// Public routes — no token required
authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", resetPassword);
authRouter.post("/refresh", refreshToken);

// Protected routes — valid JWT required
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
