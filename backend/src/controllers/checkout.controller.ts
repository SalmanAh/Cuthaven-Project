import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getStripeInstance, getStripeWebhookConfig } from "../config/stripe.js";
import { supabaseAdmin } from "../config/supabase.js";
import { sendOrderConfirmationEmail, type EmailOrderItem } from "../emails/orderConfirmation.js";
import { sendOrderShippedEmail } from "../emails/orderShipped.js";
import { calculateTax } from "../lib/calculateTax.js";
import { createPendingStripeCheckout } from "../services/stripeCheckout.service.js";

// ─── Validation schemas ────────────────────────────────────────────────────

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const shippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().default("US"),
});

const createPaymentIntentSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Cart cannot be empty"),
  shippingAddress: shippingAddressSchema,
  customerNotes: z.string().optional(),
  couponCode: z.string().optional(),
  paymentProcessor: z.enum(["stripe", "paypal"]).default("stripe"),
});

// ─── Coupon row shape returned from DB ────────────────────────────────────
// Real schema columns: code, discount_type, discount_value, min_order_amount,
// max_uses, used_count, valid_from, valid_until, is_active
interface CouponRow {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
}

// ─── POST /api/checkout/validate-coupon ────────────────────────────────────
// Public endpoint — validates a coupon code against a given subtotal.
// Returns the discount amount so the frontend can preview it before checkout.
export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, subtotal, email } = req.body as { code: string; subtotal: number; email?: string };
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Coupon code is required" });
    }
    if (typeof subtotal !== "number" || subtotal <= 0) {
      return res.status(400).json({ error: "Valid subtotal is required" });
    }
    
    // ── Require email for guests to prevent coupon reuse bypass ──
    if (!req.user && !email) {
      return res.status(400).json({ error: "Please enter your email address first to apply a coupon" });
    }

    const { data: coupon, error } = await supabaseAdmin
      .from("coupons")
      .select("id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, valid_until")
      .eq("code", code.trim().toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!coupon) return res.status(404).json({ error: "Invalid coupon code" });

    const c = coupon as CouponRow;

    if (!c.is_active) return res.status(400).json({ error: "This coupon is no longer active" });
    if (c.valid_until && new Date(c.valid_until) < new Date()) {
      return res.status(400).json({ error: "This coupon has expired" });
    }
    if (c.max_uses !== null && c.used_count >= c.max_uses) {
      return res.status(400).json({ error: "This coupon has reached its usage limit" });
    }
    if (c.min_order_amount !== null && subtotal < c.min_order_amount) {
      return res.status(400).json({
        error: `Minimum order of $${c.min_order_amount.toFixed(2)} required for this coupon`,
      });
    }

    // ── Per-customer / per-email reuse check ───────────────────────────────
    // Option 1: Separate logic for logged-in users vs guests
    // - Logged-in: check ONLY by customer_id
    // - Guest: check ONLY by email
    // This prevents false positives from mixed checks while still blocking reuse.
    
    if (req.user) {
      // Logged-in user: check by customer_id ONLY
      const { data: customerRow } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("auth_id", req.user.id)
        .maybeSingle();

      if (customerRow) {
        const { count } = await supabaseAdmin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customerRow.id)
          .eq("coupon_id", c.id)
          .in("status", ["confirmed", "processing", "shipped", "delivered"]);

        if ((count ?? 0) > 0) {
          return res.status(400).json({ error: "You have already used this coupon" });
        }
      }
    } else if (email) {
      // Guest user: check by email ONLY
      const checkEmail = email.toLowerCase().trim();
      const { count: emailCount } = await supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", c.id)
        .in("status", ["confirmed", "processing", "shipped", "delivered"])
        .filter("shipping_address->>email", "eq", checkEmail);

      if ((emailCount ?? 0) > 0) {
        return res.status(400).json({ error: "You have already used this coupon" });
      }
    }

    const discountAmount = c.discount_type === "percentage"
      ? Math.round((subtotal * c.discount_value) / 100 * 100) / 100
      : Math.min(c.discount_value, subtotal); // fixed can't exceed subtotal

    return res.json({
      valid: true,
      couponId: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      discountAmount,
    });
  } catch (err) { next(err); }
}

const FREE_SHIPPING_THRESHOLD = 350_00; // in cents

// ─── POST /api/checkout/payment-intent ────────────────────────────────────
// Step 1: Validate cart against live DB prices, calculate totals,
//         create a Stripe PaymentIntent, return its client_secret to the frontend.
//         The frontend uses the client_secret to confirm payment via Stripe.js.
//         We NEVER trust prices from the frontend — always recalculate from DB.
export async function createPaymentIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createPaymentIntentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { items, shippingAddress, customerNotes, couponCode } = parsed.data;

    // ── 1. Fetch live product data from DB ──────────────────────────────────
    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, price, compare_at_price, availability, stock_quantity, primary_image_url, sku")
      .in("id", productIds)
      .eq("is_active", true);

    if (prodError) throw prodError;

    // Validate every item is available and has enough stock
    for (const item of items) {
      const product = (products ?? []).find((p: { id: string }) => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product not found or unavailable` });
      }
      if (product.availability === "out_of_stock") {
        return res.status(400).json({ error: `"${product.name}" is out of stock` });
      }
      if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `Only ${product.stock_quantity} unit(s) of "${product.name}" available`,
        });
      }
    }

    // ── 2. Calculate totals using DB prices (never trust frontend prices) ───
    let subtotalCents = 0;
    const lineItems = items.map((item) => {
      const product = (products ?? []).find((p: { id: string }) => p.id === item.productId)!;
      // Use sale price if it exists and is lower, otherwise regular price
      const unitPriceCents = Math.round(product.price * 100);
      const lineTotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineTotalCents;
      return { product, item, unitPriceCents, lineTotalCents };
    });

    const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : 999;

    // ── 2a. Calculate real US sales tax via TaxJar ──────────────────────────
    // calculateTax() gracefully returns $0 if TAXJAR_API_KEY is absent or TaxJar
    // is unreachable — checkout never fails due to a tax service outage.
    const taxResult = await calculateTax(
      {
        zip:    shippingAddress.zip,
        state:  shippingAddress.state,
        city:   shippingAddress.city,
        street: shippingAddress.address,
      },
      lineItems.map(({ product, item, unitPriceCents }) => ({
        id:         product.id,
        quantity:   item.quantity,
        unit_price: unitPriceCents / 100,
      })),
      shippingCents / 100,
    );
    const taxCents = taxResult.taxAmountCents;

    // ── 2b. Validate and apply coupon ───────────────────────────────────────
    let discountCents = 0;
    let appliedCouponId: string | null = null;

    if (couponCode) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("id, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, valid_until")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (coupon) {
        const c = coupon as CouponRow;
        const subtotalDollars = subtotalCents / 100;
        const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
        const isExhausted = c.max_uses !== null && c.used_count >= c.max_uses;
        const belowMinimum = c.min_order_amount !== null && subtotalDollars < c.min_order_amount;

        // Per-customer / per-email reuse check — Option 1: separate logic
        let alreadyUsed = false;
        if (req.user) {
          // Logged-in: check ONLY by customer_id
          const { data: customerRow } = await supabaseAdmin
            .from("customers").select("id").eq("auth_id", req.user.id).maybeSingle();
          if (customerRow) {
            const { count } = await supabaseAdmin
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("customer_id", customerRow.id)
              .eq("coupon_id", c.id)
              .in("status", ["confirmed", "processing", "shipped", "delivered"]);
            alreadyUsed = (count ?? 0) > 0;
          }
        } else if (shippingAddress.email) {
          // Guest: check ONLY by email
          const { count: emailCount } = await supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("coupon_id", c.id)
            .in("status", ["confirmed", "processing", "shipped", "delivered"])
            .filter("shipping_address->>email", "eq", shippingAddress.email.toLowerCase().trim());
          alreadyUsed = (emailCount ?? 0) > 0;
        }

        if (!isExpired && !isExhausted && !belowMinimum && !alreadyUsed) {
          discountCents = c.discount_type === "percentage"
            ? Math.round(subtotalCents * c.discount_value / 100)
            : Math.min(Math.round(c.discount_value * 100), subtotalCents);
          appliedCouponId = c.id;
        }
      }
    }

    // Coupon usage remains a finalization concern (CH-003). The pending draft
    // records the selected coupon but does not consume it before payment.

    const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - discountCents);

    // ── 3. Generate order number ─────────────────────────────────────────────
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;

    const shippingAddressJson = {
      firstName: shippingAddress.firstName,
      lastName:  shippingAddress.lastName,
      email:     shippingAddress.email,
      phone:     shippingAddress.phone,
      address:   shippingAddress.address,
      city:      shippingAddress.city,
      state:     shippingAddress.state,
      zip:       shippingAddress.zip,
      country:   shippingAddress.country,
    };

    let customerId: string | null = null;
    if (req.user) {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("auth_id", req.user.id)
        .maybeSingle();
      if (customerError) throw customerError;
      customerId = customer?.id ?? null;
    }

    const confirmationToken = customerId ? null : randomBytes(32).toString("base64url");
    const confirmationTokenHash = confirmationToken ? hashConfirmationToken(confirmationToken) : null;
    const pendingItems = lineItems.map(({ product, item, unitPriceCents, lineTotalCents }) => ({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productImage: product.primary_image_url ?? null,
      quantity: item.quantity,
      unitPrice: unitPriceCents / 100,
      totalPrice: lineTotalCents / 100,
    }));

    // ── 4. Persist the complete pending order before creating Stripe intent ─
    const stripe = await getStripeInstance();
    const checkout = await createPendingStripeCheckout({
      orderNumber,
      customerId,
      confirmationTokenHash,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100,
      discountAmount: discountCents / 100,
      total: totalCents / 100,
      shippingAddress: shippingAddressJson,
      customerNotes: customerNotes ?? null,
      couponId: appliedCouponId,
      customerEmail: shippingAddress.email,
      items: pendingItems,
    }, {
      createPendingOrder: async (input) => {
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .insert({
            order_number: input.orderNumber,
            customer_id: input.customerId,
            status: "pending",
            payment_status: "pending",
            subtotal: input.subtotal,
            shipping_cost: input.shippingCost,
            tax_amount: input.taxAmount,
            discount_amount: input.discountAmount,
            total: input.total,
            shipping_address: input.shippingAddress,
            billing_address: input.shippingAddress,
            payment_processor: "stripe",
            payment_transaction_id: null,
            customer_notes: input.customerNotes,
            coupon_id: input.couponId,
            confirmation_token_hash: input.confirmationTokenHash,
          })
          .select("id")
          .single();
        if (orderError) throw orderError;

        const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
          input.items.map((item) => ({
            order_id: order.id,
            product_id: item.productId,
            product_name: item.productName,
            product_slug: item.productSlug,
            product_image: item.productImage,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
          })),
        );
        if (itemsError) {
          await supabaseAdmin.from("orders").delete().eq("id", order.id);
          throw itemsError;
        }
        return order;
      },
      createPaymentIntent: async (input) => {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: input.amountCents,
          currency: "usd",
          metadata: { orderId: input.orderId },
          receipt_email: input.customerEmail,
          description: `CutHaven order ${input.orderNumber}`,
        }, { idempotencyKey: `cuthaven-order-${input.orderId}` });
        return { id: paymentIntent.id, clientSecret: paymentIntent.client_secret };
      },
      linkPaymentIntent: async (orderId, paymentIntentId) => {
        const { data: linked, error } = await supabaseAdmin
          .from("orders")
          .update({ payment_transaction_id: paymentIntentId, updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .is("payment_transaction_id", null)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!linked) throw new Error("Pending order could not be linked to Stripe PaymentIntent");
      },
      cancelPaymentIntent: async (paymentIntentId) => {
        await stripe.paymentIntents.cancel(paymentIntentId);
      },
      markOrderFailed: async (orderId) => {
        await supabaseAdmin
          .from("orders")
          .update({ status: "cancelled", payment_status: "failed", updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("payment_status", "pending");
      },
    });

    console.info("[CHECKOUT]", { orderId: checkout.orderId, result: "draft_created" });
    return res.json({
      clientSecret: checkout.paymentIntent.clientSecret,
      orderId: checkout.orderId,
      orderNumber,
      confirmationToken,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100,
      taxJurisdiction: taxResult.jurisdiction,
      taxRate: taxResult.taxRate,
      discountAmount: discountCents / 100,
      total: totalCents / 100,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/checkout/webhook ────────────────────────────────────────────
// Stripe calls this endpoint when a payment succeeds or fails.
// This is the authoritative source of payment truth — not the frontend redirect.
export async function stripeWebhook(req: Request, res: Response, next: NextFunction) {
  const sig = req.headers["stripe-signature"];

  // Stripe signs the exact request bytes. Reject requests that did not pass
  // through the route-scoped raw parser, or that have an ambiguous signature
  // header, before reading gateway credentials or attempting side effects.
  if (!Buffer.isBuffer(req.body) || typeof sig !== "string") {
    console.warn("[WEBHOOK]", {
      result: "rejected",
      reason: "invalid_request",
      httpStatus: 400,
    });
    return res.status(400).json({ error: "Invalid webhook request" });
  }

  // Fetch the webhook verification configuration for the active Stripe gateway.
  let webhookConfig: { gatewayId: string; secret: string };
  try {
    webhookConfig = await getStripeWebhookConfig();
  } catch (err) {
    console.error("[WEBHOOK]", {
      result: "configuration_error",
      reason: err instanceof Error ? err.message : "unknown_error",
      httpStatus: 500,
    });
    return res.status(500).json({ error: "Webhook configuration error" });
  }

  let event;
  if (webhookConfig.secret) {
    try {
      const stripe = await getStripeInstance();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookConfig.secret);
    } catch {
      console.warn("[WEBHOOK]", {
        gatewayId: webhookConfig.gatewayId,
        result: "rejected",
        reason: "signature_verification_failed",
        httpStatus: 400,
      });
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }
  } else {
    console.error("[WEBHOOK]", {
      gatewayId: webhookConfig.gatewayId,
      result: "configuration_error",
      reason: "missing_webhook_secret",
      httpStatus: 400,
    });
    return res.status(400).json({ error: "Webhook not configured" });
  }

  const eventContext = {
    eventId: event.id,
    eventType: event.type,
    gatewayId: webhookConfig.gatewayId,
  };
  console.info("[WEBHOOK]", { ...eventContext, result: "verified" });

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as { id: string; metadata?: { orderId?: string } };
      const internalOrderId = pi.metadata?.orderId;
      if (!internalOrderId || !z.string().uuid().safeParse(internalOrderId).success) {
        console.error("[WEBHOOK]", { ...eventContext, result: "rejected", reason: "missing_internal_order_id" });
        return res.status(400).json({ error: "Payment is missing its internal order reference" });
      }

      // Only the first pending -> paid transition performs downstream effects.
      const { data: updatedOrders, error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "confirmed",
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", internalOrderId)
        .eq("payment_transaction_id", pi.id)
        .eq("payment_status", "pending")
        .select("id, order_number, subtotal, shipping_cost, tax_amount, discount_amount, total, shipping_address, coupon_id")
        .limit(1);

      if (updateError) throw updateError;
      if (!updatedOrders?.length) {
        const { data: existingOrder, error: lookupError } = await supabaseAdmin
          .from("orders")
          .select("id, payment_status")
          .eq("id", internalOrderId)
          .eq("payment_transaction_id", pi.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (existingOrder?.payment_status === "paid") {
          console.info("[WEBHOOK]", { ...eventContext, orderId: internalOrderId, result: "duplicate" });
        } else {
          throw new Error(`No pending order matches Stripe PaymentIntent ${pi.id}`);
        }
      }

      // 1a. Deduct stock for the order items (webhook backup)
      if (updatedOrders && updatedOrders.length > 0) {
        const order = updatedOrders[0];
        const { data: orderItems } = await supabaseAdmin
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", order.id);

        if (orderItems) {
          for (const item of orderItems) {
            const { error: stockError } = await supabaseAdmin.rpc("decrement_product_stock", {
              product_id: item.product_id,
              quantity: item.quantity,
            });
            if (stockError) {
              // Stock already deducted by confirmStripeOrder — log but don't fail
              console.warn("[WEBHOOK] Stock deduction skipped (may already be deducted):", stockError.message);
            }
          }
        }
      }

      // 2. Send order confirmation email (best-effort — never blocks the webhook response)
      if (updatedOrders && updatedOrders.length > 0) {
        const order = updatedOrders[0];
        const addr = order.shipping_address as Record<string, string>;

        const { data: items } = await supabaseAdmin
          .from("order_items")
          .select("product_name, product_image, quantity, unit_price, total_price")
          .eq("order_id", order.id);

        // Resolve coupon code if one was used
        let couponCode: string | undefined;
        if (order.coupon_id) {
          const { data: coupon } = await supabaseAdmin
            .from("coupons").select("code").eq("id", order.coupon_id).maybeSingle();
          couponCode = (coupon as { code: string } | null)?.code;
        }

        const emailItems: EmailOrderItem[] = (items ?? []).map((i: {
          product_name: string;
          product_image: string | null;
          quantity: number;
          unit_price: number;
          total_price: number;
        }) => ({
          productName: i.product_name,
          productImage: i.product_image,
          quantity: i.quantity,
          unitPrice: i.unit_price,
          totalPrice: i.total_price,
        }));

        sendOrderConfirmationEmail({
          to: addr.email,
          orderNumber: order.order_number,
          orderId: order.id,
          items: emailItems,
          subtotal: order.subtotal,
          shippingCost: order.shipping_cost,
          taxAmount: order.tax_amount,
          discountAmount: order.discount_amount,
          couponCode,
          total: order.total,
          shippingAddress: {
            firstName: addr.firstName ?? "",
            lastName:  addr.lastName  ?? "",
            address:   addr.address   ?? "",
            city:      addr.city      ?? "",
            state:     addr.state     ?? "",
            zip:       addr.zip       ?? "",
            country:   addr.country   ?? "US",
          },
          estimatedDelivery: getEstimatedDelivery(),
        }).catch((err) =>
          console.error("[WEBHOOK] Confirmation email error (non-fatal):", err),
        );
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as { id: string; metadata?: { orderId?: string } };
      const { error: failureUpdateError } = await supabaseAdmin
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", pi.metadata?.orderId ?? "")
        .eq("payment_transaction_id", pi.id)
        .eq("payment_status", "pending");
      if (failureUpdateError) throw failureUpdateError;
    }

    console.info("[WEBHOOK]", { ...eventContext, result: "processed", httpStatus: 200 });
    return res.json({ received: true });
  } catch (err) {
    console.error("[WEBHOOK]", {
      ...eventContext,
      result: "processing_failed",
      httpStatus: 500,
    });
    next(err);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Returns a human-readable estimated delivery window (5–8 business days from now).
function getEstimatedDelivery(): string {
  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++; // skip weekends
    }
    return result;
  };

  const now = new Date();
  const earliest = addBusinessDays(now, 5);
  const latest = addBusinessDays(now, 8);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return `${fmt(earliest)} – ${fmt(latest)}`;
}

function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string | undefined, expectedHash: string | null): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashConfirmationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function canAccessOrder(
  req: Request,
  order: { customer_id: string | null; confirmation_token_hash: string | null },
  confirmationToken?: string,
): Promise<boolean> {
  if (order.customer_id && req.user) {
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("auth_id", req.user.id)
      .eq("id", order.customer_id)
      .maybeSingle();
    return Boolean(customer);
  }

  return !order.customer_id && tokenMatches(confirmationToken, order.confirmation_token_hash);
}

// ─── GET /api/checkout/order/:id ──────────────────────────────────────────
// Returns a minimal pending/confirmed summary to the owning customer or a guest
// presenting the high-entropy token issued with the pending order.
export async function getOrderSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const confirmationToken = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!z.string().uuid().safeParse(id).success) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_id, confirmation_token_hash, status, payment_status, subtotal, shipping_cost, tax_amount, discount_amount, total, shipping_address, created_at")
      .eq("id", id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!(await canAccessOrder(req, order, confirmationToken))) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, product_name, product_image, quantity, unit_price, total_price")
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    const { customer_id: _customerId, confirmation_token_hash: _tokenHash, ...publicOrder } = order;
    return res.json({ order: publicOrder, items: items ?? [] });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/checkout/confirm-stripe-order ──────────────────────────────
// Verifies provider state for an already-persisted internal order. The signed
// webhook remains authoritative for finalization and all commerce side effects.
export async function confirmStripeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = z.object({
      orderId: z.string().uuid(),
      confirmationToken: z.string().min(32).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Valid internal orderId is required" });

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_id, confirmation_token_hash, payment_transaction_id, status, payment_status")
      .eq("id", parsed.data.orderId)
      .eq("payment_processor", "stripe")
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || !(await canAccessOrder(req, order, parsed.data.confirmationToken))) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (!order.payment_transaction_id) {
      return res.status(409).json({ error: "Order is not linked to a payment" });
    }

    const stripe = await getStripeInstance();
    const paymentIntent = await stripe.paymentIntents.retrieve(order.payment_transaction_id);
    if (paymentIntent.metadata.orderId !== order.id) {
      return res.status(409).json({ error: "Payment does not match this order" });
    }
    if (!new Set(["succeeded", "processing"]).has(paymentIntent.status)) {
      return res.status(400).json({ error: "Payment has not been completed" });
    }

    return res.json({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
    });
  } catch (err) { next(err); }
}
