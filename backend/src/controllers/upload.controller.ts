import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { env } from "../config/env.js";
import crypto from "crypto";

// Supabase Storage bucket name — create this in Supabase Dashboard:
// Storage → New bucket → name: "product-images" → Public: ON
const BUCKET = "product-images";

// ─── POST /api/admin/upload ─────────────────────────────────────────────────
// Accepts multipart/form-data with a single "file" field.
// Returns { url } — the public CDN URL of the uploaded image.
// Admin only — protected by requireRole("admin") in the route.
export async function uploadProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded. Send a file in the 'file' field." });
    }

    // Validate file type — images only
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, WebP, GIF and AVIF images are allowed." });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "File must be under 10MB." });
    }

    // Generate a unique path so filenames never collide
    const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "jpg";
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const storagePath = `products/${uniqueName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      // If the bucket doesn't exist yet, give a clear message
      if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("bucket")) {
        return res.status(503).json({
          error: `Storage bucket "${BUCKET}" not found. Create it in Supabase Dashboard → Storage → New bucket → name: "product-images" → Public: ON`,
        });
      }
      throw uploadError;
    }

    // Get the public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    return res.json({ url: urlData.publicUrl, path: storagePath });
  } catch (err) {
    next(err);
  }
}
