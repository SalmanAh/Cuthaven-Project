import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

const consentSchema = z.object({
  consentAction: z.enum([
    "accept_all",
    "reject_all",
    "custom",
    "opt_out_sale_share",
    "limit_sensitive_pi",
  ]),
  analytics:            z.boolean().optional(),
  marketing:            z.boolean().optional(),
  gpcSignalDetected:    z.boolean().default(false),
  privacyPolicyVersion: z.string().default("1.0"),
  sessionId:            z.string().optional(),
});

// ─── POST /api/consent ─────────────────────────────────────────────────────
// Public — no auth required. Called on every Accept / Reject / Save Preferences.
// Writes an immutable row to consent_log.
// customer_id is resolved from the auth token if the user is logged in.
export async function logConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const {
      consentAction,
      analytics,
      marketing,
      gpcSignalDetected,
      privacyPolicyVersion,
      sessionId,
    } = parsed.data;

    // Resolve customer_id if the request carries a valid auth token
    let customerId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user) {
        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("auth_id", userData.user.id)
          .maybeSingle();
        customerId = cust?.id ?? null;
      }
    }

    // Build consent_details — granular per-category state
    const consentDetails: Record<string, boolean> = {
      necessary: true,
      analytics:  analytics  ?? (consentAction === "accept_all"),
      marketing:  marketing  ?? (consentAction === "accept_all"),
    };

    const { error } = await supabaseAdmin
      .from("consent_log")
      .insert({
        customer_id:           customerId,
        session_id:            sessionId ?? null,
        consent_action:        consentAction,
        gpc_signal_detected:   gpcSignalDetected,
        privacy_policy_version: privacyPolicyVersion,
        consent_details:       consentDetails,
        created_at:            new Date().toISOString(),
      });

    if (error) throw error;

    return res.status(201).json({ message: "Consent recorded" });
  } catch (err) {
    next(err);
  }
}
