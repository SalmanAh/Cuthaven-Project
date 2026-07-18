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
import { authLimiter, strictAuthLimiter } from "../middleware/rateLimiter.js";

export const authRouter = Router();

// Strict rate limit on credential and password endpoints — 5 attempts per 15 min per IP
authRouter.post("/login", strictAuthLimiter, login);
authRouter.post("/forgot-password", strictAuthLimiter, forgotPassword);
authRouter.post("/reset-password", strictAuthLimiter, resetPassword);

// General auth rate limit — 20 per 15 min per IP
authRouter.post("/register", authLimiter, register);
authRouter.post("/refresh", authLimiter, refreshToken);

// Protected routes — valid JWT required (no rate limit needed, token already gates access)
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
