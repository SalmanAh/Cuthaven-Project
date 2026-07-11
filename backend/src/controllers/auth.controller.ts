import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin, supabaseAuth } from "../config/supabase.js";
import type { AuthResponse } from "../types/auth.js";

// ─── Validation schemas ────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// ─── POST /api/auth/register ───────────────────────────────────────────────
// Creates a Supabase auth user + a row in the customers table.
// No public path to staff — staff are created by admin only.
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { email, password, firstName, lastName } = parsed.data;

    // 1. Create the Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm for now; swap to false + send email later
    });

    if (authError) {
      // Supabase returns a generic message for duplicate emails — make it clear
      if (authError.message.toLowerCase().includes("already")) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      throw authError;
    }

    const authUserId = authData.user.id;

    // 2. Insert the customer profile row
    const { error: profileError } = await supabaseAdmin.from("customers").insert({
      auth_id: authUserId,
      email,
      first_name: firstName,
      last_name: lastName,
    });

    if (profileError) {
      // Profile insert failed — clean up the auth user so we don't leave orphans
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw profileError;
    }

    // 3. Sign them in immediately so the client gets a token right away
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      // Registration succeeded but auto-login failed — not fatal, just redirect to login
      return res.status(201).json({ message: "Account created. Please sign in." });
    }

    const response: AuthResponse = {
      user: {
        id: authUserId,
        email,
        role: "customer",
        firstName,
        lastName,
      },
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    };

    return res.status(201).json(response);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { email, password } = parsed.data;

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      // Use a generic message — never reveal whether the email exists
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const authUserId = data.user.id;

    // Look up role + name: check staff first, then customers
    const { data: staffRow } = await supabaseAdmin
      .from("staff")
      .select("first_name, last_name, role, is_active")
      .eq("auth_id", authUserId)
      .maybeSingle();

    if (staffRow) {
      if (!staffRow.is_active) {
        return res.status(403).json({ error: "Account is inactive. Contact an administrator." });
      }
      const response: AuthResponse = {
        user: {
          id: authUserId,
          email,
          role: staffRow.role,
          firstName: staffRow.first_name,
          lastName: staffRow.last_name,
        },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
      return res.json(response);
    }

    const { data: customerRow } = await supabaseAdmin
      .from("customers")
      .select("first_name, last_name, is_active")
      .eq("auth_id", authUserId)
      .maybeSingle();

    if (customerRow) {
      if (!customerRow.is_active) {
        return res.status(403).json({ error: "Account is inactive." });
      }
      const response: AuthResponse = {
        user: {
          id: authUserId,
          email,
          role: "customer",
          firstName: customerRow.first_name,
          lastName: customerRow.last_name,
        },
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      };
      return res.json(response);
    }

    return res.status(401).json({ error: "Invalid email or password" });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/logout ─────────────────────────────────────────────────
// Invalidates the session on the Supabase side.
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      // Best-effort sign-out — don't fail the request if it errors
      await supabaseAdmin.auth.admin.signOut(header.slice(7)).catch(() => {});
    }
    return res.json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/auth/me ──────────────────────────────────────────────────────
// Returns the currently authenticated user. requireAuth middleware populates req.user.
export function me(req: Request, res: Response) {
  return res.json({ user: req.user });
}

// ─── POST /api/auth/forgot-password ───────────────────────────────────────
// Sends a Supabase password reset email.
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Valid email required" });
    }

    // Always return success — never reveal whether an email is registered
    await supabaseAdmin.auth.resetPasswordForEmail(parsed.data.email).catch(() => {});

    return res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/reset-password ────────────────────────────────────────
// Verifies the reset token and sets the new password.
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { accessToken, refreshToken, newPassword } = parsed.data;

    // Set the session from the reset link tokens
    const { error: sessionError } = await supabaseAuth.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      return res.status(400).json({ error: "Reset link is invalid or has expired" });
    }

    // Get the user from the access token
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return res.status(400).json({ error: "Reset link is invalid or has expired" });
    }

    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword },
    );

    if (updateError) throw updateError;

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/refresh ────────────────────────────────────────────────
// Exchanges a refresh token for a new access token.
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body as { refreshToken?: string };
    if (!token) {
      return res.status(400).json({ error: "refreshToken is required" });
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: token });
    if (error || !data.session) {
      return res.status(401).json({ error: "Refresh token invalid or expired. Please log in again." });
    }

    return res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    next(err);
  }
}
