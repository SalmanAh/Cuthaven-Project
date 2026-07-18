import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import type { AuthUser } from "../types/auth.js";

// Extend Express Request so downstream handlers can access req.user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Verifies the JWT from the Authorization header.
// Sets req.user on success; returns 401 on failure.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice(7);

  // Let Supabase verify the JWT signature and expiry
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const supabaseUser = data.user;

  // Determine role: check staff table first, then customers
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, first_name, last_name, role, is_active")
    .eq("auth_id", supabaseUser.id)
    .maybeSingle();

  if (staffRow) {
    if (!staffRow.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      role: staffRow.role as "admin" | "store_manager" | "product_manager",
      firstName: staffRow.first_name,
      lastName: staffRow.last_name,
    };
    return next();
  }

  // Not staff — check customers table
  const { data: customerRow } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, is_active")
    .eq("auth_id", supabaseUser.id)
    .maybeSingle();

  if (customerRow) {
    if (!customerRow.is_active) {
      return res.status(403).json({ error: "Account is inactive" });
    }
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      role: "customer",
      firstName: customerRow.first_name,
      lastName: customerRow.last_name,
    };
    return next();
  }

  // Auth user exists but has no profile row — should not happen in normal flow
  return res.status(401).json({ error: "User profile not found" });
}

// Role guard — use AFTER requireAuth
// e.g. router.get("/admin/...", requireAuth, requireRole("admin"), handler)
export function requireRole(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Optional auth — silently populates req.user if a valid token is present.
// Never rejects the request — used for endpoints that work for both guests and logged-in users.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(); // no token — continue as guest

  const token = header.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return next(); // invalid token — continue as guest

  const supabaseUser = data.user;

  // Check staff first, then customers
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, first_name, last_name, role, is_active")
    .eq("auth_id", supabaseUser.id)
    .maybeSingle();

  if (staffRow?.is_active) {
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      role: staffRow.role as "admin" | "store_manager" | "product_manager",
      firstName: staffRow.first_name,
      lastName: staffRow.last_name,
    };
    return next();
  }

  const { data: customerRow } = await supabaseAdmin
    .from("customers")
    .select("id, first_name, last_name, is_active")
    .eq("auth_id", supabaseUser.id)
    .maybeSingle();

  if (customerRow?.is_active) {
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      role: "customer",
      firstName: customerRow.first_name,
      lastName: customerRow.last_name,
    };
  }

  next(); // always continue — even if profile not found
}
