import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

// ─── Real schema columns (cuthaven_db_schema.sql) ─────────────────────────
// code, discount_type, discount_value, min_order_amount, max_uses, used_count,
// valid_from, valid_until, is_active, created_at, updated_at

export interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

const couponWriteSchema = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  validUntil: z.string().datetime().nullable().optional(),
});

// ─── GET /api/admin/coupons ────────────────────────────────────────────────
export async function listCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ coupons: data ?? [] });
  } catch (err) { next(err); }
}

// ─── POST /api/admin/coupons ───────────────────────────────────────────────
export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = couponWriteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const d = parsed.data;

    const { data: existing } = await supabaseAdmin
      .from("coupons").select("id").eq("code", d.code).maybeSingle();
    if (existing) return res.status(409).json({ error: "Coupon code already exists" });

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .insert({
        code: d.code,
        discount_type: d.discountType,
        discount_value: d.discountValue,
        min_order_amount: d.minOrderAmount ?? 0,
        max_uses: d.maxUses ?? null,
        used_count: 0,
        valid_from: now,
        valid_until: d.validUntil ?? null,
        is_active: d.isActive,
        created_at: now,
        updated_at: now,
      })
      .select("*").single();

    if (error) throw error;
    return res.status(201).json({ coupon: data });
  } catch (err) { next(err); }
}

// ─── PATCH /api/admin/coupons/:id ─────────────────────────────────────────
export async function updateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = couponWriteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const d = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.code !== undefined)           patch.code = d.code;
    if (d.discountType !== undefined)   patch.discount_type = d.discountType;
    if (d.discountValue !== undefined)  patch.discount_value = d.discountValue;
    if (d.minOrderAmount !== undefined) patch.min_order_amount = d.minOrderAmount;
    if (d.maxUses !== undefined)        patch.max_uses = d.maxUses;
    if (d.isActive !== undefined)       patch.is_active = d.isActive;
    if (d.validUntil !== undefined)     patch.valid_until = d.validUntil;

    const { data, error } = await supabaseAdmin
      .from("coupons").update(patch).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Coupon not found" });
    return res.json({ coupon: data });
  } catch (err) { next(err); }
}

// ─── DELETE /api/admin/coupons/:id ────────────────────────────────────────
export async function deleteCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("coupons").delete().eq("id", id);
    if (error) throw error;
    return res.json({ message: "Coupon deleted" });
  } catch (err) { next(err); }
}
