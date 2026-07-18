import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { stripe } from "../config/stripe.js";
import { supabaseAdmin } from "../config/supabase.js";
import { sendOrderConfirmationEmail, type EmailOrderItem } from "../emails/orderConfirmation.js";
import { sendOrderShippedEmail } from "../emails/orderShipped.js";
import { calculateTax } from "../lib/calculateTax.js";

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

    // NOTE: used_count is incremented in confirmStripeOrder AFTER the order row
    // is successfully created — not here. Incrementing here (before the order exists)
    // caused orphaned increments whenever the browser closed between payment and
    // order creation, and meant the reuse check could never find the order.

    const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - discountCents);

    // ── 3. Generate order number ─────────────────────────────────────────────
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}`;

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

    // ── 4. Create Stripe PaymentIntent ──────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: {
        orderNumber,
        customerId: req.user?.id ?? "guest",
        customerEmail: shippingAddress.email,
        // Store everything needed to create the DB order after payment succeeds.
        // We do NOT create the DB order here — only after stripe.confirmPayment
        // succeeds on the frontend (or the webhook fires as a backup).
        shippingAddress: JSON.stringify(shippingAddressJson),
        customerNotes: customerNotes ?? "",
        couponCode: couponCode ?? "",
        appliedCouponId: appliedCouponId ?? "",
        subtotal: String(subtotalCents),
        shippingCents: String(shippingCents),
        taxCents: String(taxCents),
        discountCents: String(discountCents),
        totalCents: String(totalCents),
        taxJurisdiction: taxResult.jurisdiction,
        taxRate: String(taxResult.taxRate),
        lineItems: JSON.stringify(lineItems.map(({ product, item, unitPriceCents, lineTotalCents }) => ({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          productImage: product.primary_image_url ?? null,
          quantity: item.quantity,
          unitPrice: unitPriceCents / 100,
          totalPrice: lineTotalCents / 100,
        }))),
      },
      receipt_email: shippingAddress.email,
      description: `CutHaven order ${orderNumber}`,
    });

    // Return client_secret and totals to the frontend.
    // NO DB ORDER IS CREATED HERE — the order is created in /confirm-stripe-order
    // after the customer successfully completes payment.
    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderNumber,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100,
      taxJurisdiction: taxResult.jurisdiction,
      taxRate: taxResult.taxRate,
      discountAmount: discountCents / 100,
      total: totalCents / 100,
      // Pass back to frontend so it can send to confirm-stripe-order
      checkoutToken: paymentIntent.id,
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // In production, STRIPE_WEBHOOK_SECRET is guaranteed by env.ts startup check.
  // In development without the CLI running it will be undefined — we parse directly.
  let event;
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch {
      console.error("[WEBHOOK] Signature verification failed — possible spoofed request");
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      // Should never reach here in production because env.ts throws on startup,
      // but this is a defence-in-depth guard.
      console.error("[WEBHOOK] STRIPE_WEBHOOK_SECRET missing in production — rejecting");
      return res.status(400).json({ error: "Webhook not configured" });
    }
    // Dev mode without webhook secret — parse directly (never in production)
    event = req.body;
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as { id: string };

      // 1. Flip order status to confirmed
      const { data: updatedOrders } = await supabaseAdmin
        .from("orders")
        .update({
          status: "confirmed",
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_transaction_id", pi.id)
        .select("id, order_number, subtotal, shipping_cost, tax_amount, discount_amount, total, shipping_address, coupon_id")
        .limit(1);

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
      const pi = event.data.object as { id: string };
      await supabaseAdmin
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_transaction_id", pi.id);
    }

    return res.json({ received: true });
  } catch (err) {
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

// ─── GET /api/checkout/order/:id ──────────────────────────────────────────
// Returns a confirmed order's summary for the confirmation page.
// Accessible by the customer who placed it OR guests (by orderId only — no auth required
// since this page is reached immediately after checkout, before account creation).
export async function getOrderSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Order not found" });

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", id);

    if (itemsError) throw itemsError;

    return res.json({ order, items: items ?? [] });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/checkout/confirm-stripe-order ──────────────────────────────
// Called by the FRONTEND after stripe.confirmPayment() succeeds.
// Creates the DB order only at this point — customer has already paid.
// The Stripe webhook acts as a backup for cases where the browser closes.
export async function confirmStripeOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { paymentIntentId } = req.body as { paymentIntentId: string };
    if (!paymentIntentId) {
      return res.status(400).json({ error: "paymentIntentId is required" });
    }

    // Verify the PaymentIntent is actually paid — never trust the frontend claim
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.status(400).json({ error: "Payment has not been completed" });
    }

    // Check if order already exists (webhook may have already created it)
    const { data: existing } = await supabaseAdmin
      .from("orders")
      .select("id, order_number")
      .eq("payment_transaction_id", paymentIntentId)
      .maybeSingle();

    if (existing) {
      return res.json({ orderId: existing.id, orderNumber: existing.order_number });
    }

    // Reconstruct order data from PaymentIntent metadata
    const meta = pi.metadata;
    const shippingAddr = JSON.parse(meta.shippingAddress ?? "{}");
    const lineItems: Array<{
      productId: string; productName: string; productSlug: string;
      productImage: string | null; quantity: number; unitPrice: number; totalPrice: number;
    }> = JSON.parse(meta.lineItems ?? "[]");

    const orderNumber = meta.orderNumber ?? `CUT-${Date.now().toString(36).toUpperCase()}`;
    const appliedCouponId = meta.appliedCouponId || null;

    let customerId: string | null = null;
    if (req.user) {
      const { data: cust } = await supabaseAdmin.from("customers").select("id").eq("auth_id", req.user.id).maybeSingle();
      customerId = cust?.id ?? null;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: "confirmed",
        payment_status: "paid",
        subtotal: Number(meta.subtotal) / 100,
        shipping_cost: Number(meta.shippingCents) / 100,
        tax_amount: Number(meta.taxCents) / 100,
        discount_amount: Number(meta.discountCents) / 100,
        total: Number(meta.totalCents) / 100,
        shipping_address: shippingAddr,
        billing_address: shippingAddr,
        payment_processor: "stripe",
        payment_transaction_id: paymentIntentId,
        customer_notes: meta.customerNotes || null,
        coupon_id: appliedCouponId,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    await supabaseAdmin.from("order_items").insert(
      lineItems.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.productName,
        product_slug: i.productSlug,
        product_image: i.productImage,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        total_price: i.totalPrice,
      }))
    );

    // ── Deduct stock for each product ──────────────────────────────────────
    for (const item of lineItems) {
      await supabaseAdmin.rpc("decrement_product_stock", {
        product_id: item.productId,
        quantity: item.quantity,
      });
    }

    // ── Increment coupon used_count AFTER the order row exists ──────────────
    // Doing this here (not in createPaymentIntent) ensures the order with
    // coupon_id is already in the DB when the reuse check fires next time.
    if (appliedCouponId) {
      const { error: rpcError } = await supabaseAdmin.rpc("increment_coupon_usage", {
        coupon_id: appliedCouponId,
      });
      if (rpcError && !rpcError.message?.includes("coupon_exhausted")) {
        console.warn("[CONFIRM] increment_coupon_usage RPC failed — manual fallback:", rpcError.message);
        const { data: cur } = await supabaseAdmin.from("coupons").select("used_count").eq("id", appliedCouponId).single();
        if (cur) {
          await supabaseAdmin.from("coupons").update({ used_count: cur.used_count + 1 }).eq("id", appliedCouponId);
        }
      }
    }

    // Send confirmation email fire-and-forget
    void (async () => {
      try {
        const emailItems: EmailOrderItem[] = lineItems.map((i) => ({
          productName: i.productName, productImage: i.productImage,
          quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice,
        }));
        let couponCode: string | undefined;
        if (appliedCouponId) {
          const { data: c } = await supabaseAdmin.from("coupons").select("code").eq("id", appliedCouponId).maybeSingle();
          couponCode = (c as { code: string } | null)?.code;
        }
        await sendOrderConfirmationEmail({
          to: shippingAddr.email, orderNumber, orderId: order.id,
          items: emailItems,
          subtotal: Number(meta.subtotal) / 100, shippingCost: Number(meta.shippingCents) / 100,
          taxAmount: Number(meta.taxCents) / 100, discountAmount: Number(meta.discountCents) / 100,
          couponCode, total: Number(meta.totalCents) / 100,
          shippingAddress: {
            firstName: shippingAddr.firstName ?? "", lastName: shippingAddr.lastName ?? "",
            address: shippingAddr.address ?? "", city: shippingAddr.city ?? "",
            state: shippingAddr.state ?? "", zip: shippingAddr.zip ?? "", country: shippingAddr.country ?? "US",
          },
          estimatedDelivery: getEstimatedDelivery(),
        });
      } catch (e) { console.error("[CONFIRM] Email error (non-fatal):", e); }
    })();

    return res.json({ orderId: order.id, orderNumber });
  } catch (err) { next(err); }
}

// ─── POST /api/checkout/cod-order ─────────────────────────────────────────
// Cash on Delivery — creates order only when customer clicks "Confirm Order".
// No payment processor involved — order is immediately confirmed, payment_status = pending.
export async function createCodOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = z.object({
      items:           z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
      shippingAddress: z.object({
        firstName: z.string().min(1), lastName: z.string().min(1),
        email: z.string().email(), phone: z.string().optional().default(""),
        address: z.string().min(1), city: z.string().min(1),
        state: z.string().min(1), zip: z.string().min(1), country: z.string().default("US"),
      }),
      customerNotes: z.string().optional(),
      couponCode:    z.string().optional(),
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { items, shippingAddress, customerNotes, couponCode } = parsed.data;

    // Validate products + calculate totals
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products").select("id, name, slug, price, availability, stock_quantity, primary_image_url")
      .in("id", items.map((i) => i.productId)).eq("is_active", true);
    if (prodError) throw prodError;

    for (const item of items) {
      const p = (products ?? []).find((x: { id: string }) => x.id === item.productId);
      if (!p) return res.status(400).json({ error: "Product not found" });
      if (p.availability === "out_of_stock") return res.status(400).json({ error: `"${p.name}" is out of stock` });
      if (p.stock_quantity !== null && p.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Only ${p.stock_quantity} unit(s) of "${p.name}" available` });
      }
    }

    let subtotalCents = 0;
    const lineItems = items.map((item) => {
      const p = (products ?? []).find((x: { id: string }) => x.id === item.productId)!;
      const unitCents = Math.round(p.price * 100);
      const totalCents = unitCents * item.quantity;
      subtotalCents += totalCents;
      return { p, item, unitCents, totalCents };
    });

    const shippingCents = subtotalCents >= 350_00 ? 0 : 999;
    const taxResult = await calculateTax(
      { zip: shippingAddress.zip, state: shippingAddress.state, city: shippingAddress.city, street: shippingAddress.address },
      lineItems.map(({ p, item, unitCents }) => ({ id: p.id, quantity: item.quantity, unit_price: unitCents / 100 })),
      shippingCents / 100,
    );
    const taxCents = taxResult.taxAmountCents;

    // Resolve customer ID early — needed for coupon reuse check
    let customerId: string | null = null;
    if (req.user) {
      const { data: cust } = await supabaseAdmin.from("customers").select("id").eq("auth_id", req.user.id).maybeSingle();
      customerId = cust?.id ?? null;
    }

    let discountCents = 0;
    let appliedCouponId: string | null = null;
    if (couponCode) {
      const { data: coupon } = await supabaseAdmin.from("coupons")
        .select("id, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, valid_until")
        .eq("code", couponCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (coupon) {
        const c = coupon as CouponRow;
        const ok = !c.valid_until || new Date(c.valid_until) >= new Date();
        const notExhausted = c.max_uses === null || c.used_count < c.max_uses;
        const aboveMin = c.min_order_amount === null || subtotalCents / 100 >= c.min_order_amount;

        // Per-customer / per-email reuse check — Option 1: separate logic
        let alreadyUsed = false;
        if (req.user && customerId) {
          // Logged-in: check ONLY by customer_id
          const { count } = await supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", customerId)
            .eq("coupon_id", c.id)
            .in("status", ["confirmed", "processing", "shipped", "delivered"]);
          alreadyUsed = (count ?? 0) > 0;
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

        if (ok && notExhausted && aboveMin && !alreadyUsed) {
          discountCents = c.discount_type === "percentage"
            ? Math.round(subtotalCents * c.discount_value / 100)
            : Math.min(Math.round(c.discount_value * 100), subtotalCents);
          appliedCouponId = c.id;
        }
      }
    }

    const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - discountCents);
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}`;

    const addr = { ...shippingAddress };
    const { data: order, error: orderError } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber, customer_id: customerId,
      status: "confirmed", payment_status: "pending",
      subtotal: subtotalCents / 100, shipping_cost: shippingCents / 100,
      tax_amount: taxCents / 100, discount_amount: discountCents / 100, total: totalCents / 100,
      shipping_address: addr, billing_address: addr,
      payment_processor: "stripe", payment_method: "card",
      customer_notes: customerNotes ?? null, coupon_id: appliedCouponId,
    }).select("id").single();

    if (orderError) throw orderError;

    await supabaseAdmin.from("order_items").insert(
      lineItems.map(({ p, item, unitCents, totalCents: lTotal }) => ({
        order_id: order.id, product_id: p.id, product_name: p.name,
        product_slug: p.slug, product_image: p.primary_image_url ?? null,
        quantity: item.quantity, unit_price: unitCents / 100, total_price: lTotal / 100,
      }))
    );

    // ── Deduct stock for each product ──────────────────────────────────────
    for (const lineItem of lineItems) {
      await supabaseAdmin.rpc("decrement_product_stock", {
        product_id: lineItem.p.id,
        quantity: lineItem.item.quantity,
      });
    }

    if (appliedCouponId) {
      const { error: rpcError } = await supabaseAdmin.rpc("increment_coupon_usage", { coupon_id: appliedCouponId });
      if (rpcError && !rpcError.message?.includes("coupon_exhausted")) {
        // RPC function doesn't exist — manual fallback
        console.warn("[COD] increment_coupon_usage RPC not found — using manual increment");
        const { data: currentCoupon } = await supabaseAdmin
          .from("coupons")
          .select("used_count")
          .eq("id", appliedCouponId)
          .single();
        if (currentCoupon) {
          await supabaseAdmin
            .from("coupons")
            .update({ used_count: currentCoupon.used_count + 1 })
            .eq("id", appliedCouponId);
        }
      }
    }

    return res.status(201).json({
      orderId: order.id, orderNumber,
      subtotal: subtotalCents / 100, shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100, discountAmount: discountCents / 100, total: totalCents / 100,
    });
  } catch (err) { next(err); }
}
