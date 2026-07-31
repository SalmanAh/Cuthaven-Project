// ═══════════════════════════════════════════════════════════════════════════
// Payment Gateways Controller
// Admin-only CRUD for managing multiple Stripe/PayPal accounts
// ═══════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import type {
  PaymentGatewayRow,
  PaymentGatewayResponse,
  CreatePaymentGatewayRequest,
  ActiveGatewayConfig,
} from "../types/payment-gateway.js";

// ─── Helper: Mask sensitive keys for API responses ─────────────────────────

function maskKey(key: string | null): string | undefined {
  if (!key) return undefined;
  if (key.length <= 8) return "***";
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

function rowToResponse(row: PaymentGatewayRow): PaymentGatewayResponse {
  const base = {
    id: row.id,
    gatewayType: row.gateway_type,
    accountName: row.account_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.gateway_type === "stripe") {
    return {
      ...base,
      stripeSecretKey: maskKey(row.stripe_secret_key),
      stripePublishableKey: maskKey(row.stripe_publishable_key),
      stripeWebhookSecret: maskKey(row.stripe_webhook_secret),
    };
  } else {
    return {
      ...base,
      paypalClientId: maskKey(row.paypal_client_id),
      paypalClientSecret: maskKey(row.paypal_client_secret),
      paypalMode: row.paypal_mode ?? undefined,
    };
  }
}

// ─── GET /api/admin/payment-gateways ────────────────────────────────────────
// List all payment gateways (admin only)

export async function listPaymentGateways(req: Request, res: Response, next: NextFunction) {
  try {
    const { data: gateways, error } = await supabaseAdmin
      .from("payment_gateways")
      .select("*")
      .order("gateway_type", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const response = (gateways ?? []).map((g: PaymentGatewayRow) => rowToResponse(g));

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/payment-gateways/:id ────────────────────────────────────
// Get single gateway with FULL unmasked keys (for edit form)

export async function getPaymentGateway(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const { data: gateway, error } = await supabaseAdmin
      .from("payment_gateways")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!gateway) return res.status(404).json({ error: "Gateway not found" });

    // Return FULL keys for edit form (admin only endpoint)
    const row = gateway as PaymentGatewayRow;
    const response: any = {
      id: row.id,
      gatewayType: row.gateway_type,
      accountName: row.account_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (row.gateway_type === "stripe") {
      response.stripeSecretKey = row.stripe_secret_key;
      response.stripePublishableKey = row.stripe_publishable_key;
      response.stripeWebhookSecret = row.stripe_webhook_secret;
    } else {
      response.paypalClientId = row.paypal_client_id;
      response.paypalClientSecret = row.paypal_client_secret;
      response.paypalMode = row.paypal_mode;
    }

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/admin/payment-gateways ───────────────────────────────────────
// Create new payment gateway

export async function createPaymentGateway(req: Request, res: Response, next: NextFunction) {
  try {
    const stripeSchema = z.object({
      gatewayType: z.literal("stripe"),
      accountName: z.string().min(1).max(100),
      stripeSecretKey: z.string().startsWith("sk_"),
      stripePublishableKey: z.string().startsWith("pk_"),
      stripeWebhookSecret: z.string().startsWith("whsec_"),
      isActive: z.boolean().optional().default(false),
    });

    const paypalSchema = z.object({
      gatewayType: z.literal("paypal"),
      accountName: z.string().min(1).max(100),
      paypalClientId: z.string().min(10),
      paypalClientSecret: z.string().min(10),
      paypalMode: z.enum(["sandbox", "live"]),
      isActive: z.boolean().optional().default(false),
    });

    const parsed = z.union([stripeSchema, paypalSchema]).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const body = parsed.data as CreatePaymentGatewayRequest;

    // Get staff ID for created_by
    let createdBy: string | null = null;
    if (req.user) {
      const { data: staff } = await supabaseAdmin
        .from("staff")
        .select("id")
        .eq("auth_id", req.user.id)
        .maybeSingle();
      createdBy = staff?.id ?? null;
    }

    // Build insert object
    const insertData: any = {
      gateway_type: body.gatewayType,
      account_name: body.accountName,
      is_active: body.isActive ?? false,
      created_by: createdBy,
    };

    if (body.gatewayType === "stripe") {
      insertData.stripe_secret_key = body.stripeSecretKey;
      insertData.stripe_publishable_key = body.stripePublishableKey;
      insertData.stripe_webhook_secret = body.stripeWebhookSecret;
    } else {
      insertData.paypal_client_id = body.paypalClientId;
      insertData.paypal_client_secret = body.paypalClientSecret;
      insertData.paypal_mode = body.paypalMode;
    }

    const { data: gateway, error } = await supabaseAdmin
      .from("payment_gateways")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === "23505") {
        return res.status(400).json({
          error: `A ${body.gatewayType} account named "${body.accountName}" already exists`,
        });
      }
      throw error;
    }

    return res.status(201).json(rowToResponse(gateway as PaymentGatewayRow));
  } catch (err) {
    next(err);
  }
}

// ─── PUT /api/admin/payment-gateways/:id ────────────────────────────────────
// Update existing gateway

export async function updatePaymentGateway(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // First get existing gateway to know its type
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("payment_gateways")
      .select("gateway_type")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: "Gateway not found" });

    const gatewayType = existing.gateway_type as "stripe" | "paypal";

    // Build validation schema based on gateway type
    let schema: z.ZodTypeAny;
    if (gatewayType === "stripe") {
      schema = z.object({
        accountName: z.string().min(1).max(100).optional(),
        stripeSecretKey: z.string().startsWith("sk_").optional(),
        stripePublishableKey: z.string().startsWith("pk_").optional(),
        stripeWebhookSecret: z.string().startsWith("whsec_").optional(),
        isActive: z.boolean().optional(),
      });
    } else {
      schema = z.object({
        accountName: z.string().min(1).max(100).optional(),
        paypalClientId: z.string().min(10).optional(),
        paypalClientSecret: z.string().min(10).optional(),
        paypalMode: z.enum(["sandbox", "live"]).optional(),
        isActive: z.boolean().optional(),
      });
    }

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const body = parsed.data as any;

    // Build update object (only fields that were provided)
    const updateData: any = {};
    if (body.accountName !== undefined) updateData.account_name = body.accountName;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    if (gatewayType === "stripe") {
      if (body.stripeSecretKey) updateData.stripe_secret_key = body.stripeSecretKey;
      if (body.stripePublishableKey) updateData.stripe_publishable_key = body.stripePublishableKey;
      if (body.stripeWebhookSecret) updateData.stripe_webhook_secret = body.stripeWebhookSecret;
    } else {
      if (body.paypalClientId) updateData.paypal_client_id = body.paypalClientId;
      if (body.paypalClientSecret) updateData.paypal_client_secret = body.paypalClientSecret;
      if (body.paypalMode) updateData.paypal_mode = body.paypalMode;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("payment_gateways")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    return res.json(rowToResponse(updated as PaymentGatewayRow));
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/payment-gateways/:id/activate ────────────────────────
// Activate a gateway (deactivates all others of same type)

export async function activatePaymentGateway(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const { data: gateway, error } = await supabaseAdmin
      .from("payment_gateways")
      .update({ is_active: true })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ error: "Gateway not found" });
      }
      throw error;
    }

    return res.json(rowToResponse(gateway as PaymentGatewayRow));
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/admin/payment-gateways/:id ─────────────────────────────────
// Delete gateway (cannot delete if it's the only active one)

export async function deletePaymentGateway(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Get gateway to check if it's active
    const { data: gateway, error: fetchError } = await supabaseAdmin
      .from("payment_gateways")
      .select("gateway_type, is_active")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!gateway) return res.status(404).json({ error: "Gateway not found" });

    // If active, check if there's another one of the same type
    if (gateway.is_active) {
      const { data: alternatives } = await supabaseAdmin
        .from("payment_gateways")
        .select("id")
        .eq("gateway_type", gateway.gateway_type)
        .neq("id", id)
        .limit(1);

      if (!alternatives || alternatives.length === 0) {
        return res.status(400).json({
          error: `Cannot delete the only ${gateway.gateway_type} gateway. Add another one first, activate it, then delete this one.`,
        });
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("payment_gateways")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return res.json({ success: true, message: "Gateway deleted" });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/checkout/active-gateways ──────────────────────────────────────
// Public endpoint: returns active gateway configs for checkout
// Returns publishable keys only (safe for frontend)

export async function getActiveGatewaysForCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const { data: gateways, error } = await supabaseAdmin
      .from("payment_gateways")
      .select("gateway_type, stripe_publishable_key, paypal_client_id, paypal_mode")
      .eq("is_active", true)
      .in("gateway_type", ["stripe", "paypal"]);

    if (error) throw error;

    const response: any = {};

    for (const g of gateways ?? []) {
      if (g.gateway_type === "stripe" && g.stripe_publishable_key) {
        response.stripe = {
          publishableKey: g.stripe_publishable_key,
        };
      } else if (g.gateway_type === "paypal" && g.paypal_client_id) {
        response.paypal = {
          clientId: g.paypal_client_id,
          mode: g.paypal_mode,
        };
      }
    }

    return res.json(response);
  } catch (err) {
    next(err);
  }
}

// ─── Internal helper: Get active gateway config (for backend use) ───────────
// Used by checkout controller to get secret keys

export async function getActiveGatewayConfig(
  type: "stripe" | "paypal"
): Promise<ActiveGatewayConfig | null> {
  const { data: gateway, error } = await supabaseAdmin
    .from("payment_gateways")
    .select("*")
    .eq("gateway_type", type)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !gateway) return null;

  const row = gateway as PaymentGatewayRow;

  if (type === "stripe") {
    if (!row.stripe_secret_key || !row.stripe_publishable_key || !row.stripe_webhook_secret) {
      return null;
    }
    return {
      type: "stripe",
      secretKey: row.stripe_secret_key,
      publishableKey: row.stripe_publishable_key,
      webhookSecret: row.stripe_webhook_secret,
    };
  } else {
    if (!row.paypal_client_id || !row.paypal_client_secret || !row.paypal_mode) {
      return null;
    }
    return {
      type: "paypal",
      clientId: row.paypal_client_id,
      clientSecret: row.paypal_client_secret,
      mode: row.paypal_mode,
    };
  }
}
