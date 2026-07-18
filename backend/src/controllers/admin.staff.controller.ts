import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import type { AdminStaffMember } from "../types/admin.js";

const createStaffSchema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  role: z.enum(["store_manager"]), // only admins exist; admin cannot create another admin via API
});

// ─── GET /api/admin/staff ──────────────────────────────────────────────────
export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("staff")
      .select("id, auth_id, email, first_name, last_name, role, is_active, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const staff: AdminStaffMember[] = (
      data as Array<{
        id: string; auth_id: string; email: string;
        first_name: string; last_name: string;
        role: "admin" | "store_manager"; is_active: boolean; created_at: string;
      }>
    ).map((s) => ({
      id: s.id,
      authId: s.auth_id,
      email: s.email,
      firstName: s.first_name,
      lastName: s.last_name,
      role: s.role,
      isActive: s.is_active,
      createdAt: s.created_at,
    }));

    return res.json({ staff });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/admin/staff ─────────────────────────────────────────────────
// Creates a new store_manager: first creates the Supabase auth user,
// then inserts a staff row. If the staff insert fails, the auth user is
// cleaned up to avoid orphaned accounts.
export async function createStaffMember(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { email, password, firstName, lastName, role } = parsed.data;

    // Check for existing staff with same email
    const { data: existing } = await supabaseAdmin
      .from("staff")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing) {
      return res.status(409).json({ error: "A staff member with this email already exists" });
    }

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation for staff — admin is creating them
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message ?? "Failed to create auth user" });
    }

    const authId = authData.user.id;
    const now = new Date().toISOString();

    // Insert staff row
    const { data: staffRow, error: staffError } = await supabaseAdmin
      .from("staff")
      .insert({
        auth_id: authId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("id, auth_id, email, first_name, last_name, role, is_active, created_at")
      .single();

    if (staffError) {
      // Roll back the auth user to avoid orphan
      await supabaseAdmin.auth.admin.deleteUser(authId).catch(() => {});
      throw staffError;
    }

    const s = staffRow as {
      id: string; auth_id: string; email: string;
      first_name: string; last_name: string;
      role: "admin" | "store_manager"; is_active: boolean; created_at: string;
    };

    return res.status(201).json({
      staff: {
        id: s.id,
        authId: s.auth_id,
        email: s.email,
        firstName: s.first_name,
        lastName: s.last_name,
        role: s.role,
        isActive: s.is_active,
        createdAt: s.created_at,
      } satisfies AdminStaffMember,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/staff/:id/toggle ────────────────────────────────────
// Toggles is_active. An admin cannot deactivate themselves.
export async function toggleStaffActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "isActive (boolean) is required" });
    }

    // Prevent admin from locking themselves out
    const { data: target } = await supabaseAdmin
      .from("staff")
      .select("auth_id, role")
      .eq("id", id)
      .maybeSingle();

    if (!target) return res.status(404).json({ error: "Staff member not found" });

    if (target.auth_id === req.user!.id && !isActive) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    const { data, error } = await supabaseAdmin
      .from("staff")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, email, is_active")
      .maybeSingle();

    if (error) throw error;
    return res.json({ staff: data });
  } catch (err) {
    next(err);
  }
}
