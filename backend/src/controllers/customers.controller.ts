import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin, supabaseAuth } from "../config/supabase.js";

// Address shape stored in customers.addresses jsonb column
const addressSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  phone: z.string().default(""),
  isDefault: z.boolean().default(false),
});

const profileUpdateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ─── GET /api/customers/me ─────────────────────────────────────────────────
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("id, email, first_name, last_name, phone, addresses, created_at")
      .eq("auth_id", req.user!.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Customer not found" });

    return res.json({
      customer: {
        id: data.id,
        email: data.email,
        firstName: data.first_name,
        lastName: data.last_name,
        phone: data.phone ?? "",
        addresses: data.addresses ?? [],
        createdAt: data.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/customers/me ───────────────────────────────────────────────
export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { firstName, lastName, phone } = parsed.data;

    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("auth_id", req.user!.id);

    if (error) throw error;

    return res.json({ message: "Profile updated" });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/customers/me/change-password ────────────────────────────────
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = passwordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { currentPassword, newPassword } = parsed.data;

    // Verify current password by attempting a sign-in
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: req.user!.email,
      password: currentPassword,
    });

    if (signInError) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      req.user!.id,
      { password: newPassword },
    );

    if (updateError) throw updateError;

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/customers/me/addresses ──────────────────────────────────────
export async function getAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("addresses")
      .eq("auth_id", req.user!.id)
      .maybeSingle();

    if (error) throw error;

    return res.json({ addresses: data?.addresses ?? [] });
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/customers/me/addresses ──────────────────────────────────────
// Replaces the entire addresses array. Frontend sends the full updated array.
export async function updateAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const rawAddresses = req.body.addresses;
    if (!Array.isArray(rawAddresses)) {
      return res.status(400).json({ error: "addresses must be an array" });
    }

    const parsed = z.array(addressSchema).safeParse(rawAddresses);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    // Enforce: only one default at a time
    const addresses = parsed.data;
    const defaultCount = addresses.filter((a) => a.isDefault).length;
    if (defaultCount > 1) {
      return res.status(400).json({ error: "Only one address can be set as default" });
    }

    const { error } = await supabaseAdmin
      .from("customers")
      .update({ addresses, updated_at: new Date().toISOString() })
      .eq("auth_id", req.user!.id);

    if (error) throw error;

    return res.json({ addresses });
  } catch (err) {
    next(err);
  }
}
