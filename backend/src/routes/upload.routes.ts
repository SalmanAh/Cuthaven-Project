import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { uploadProductImage } from "../controllers/upload.controller.js";

// Store files in memory — we pass the buffer directly to Supabase Storage.
// No temp files written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

export const uploadRouter = Router();

// Admin only — only admins can upload product images
uploadRouter.post(
  "/product-image",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  uploadProductImage,
);
