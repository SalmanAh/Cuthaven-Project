import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { stripe } from "../config/stripe.js";
import { supabaseAdmin } from "../config/supabase.js";

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
  paymentProcessor: z.enum(["stripe", "paypal"]).default("stripe"),
});

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
    const { items, shippingAddress, customerNotes } = parsed.data;

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

    const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : 999; // $9.99 below threshold
    const taxCents = 0; // TODO: integrate TaxJar/Avalara for US sales tax calculation
    const totalCents = subtotalCents + shippingCents + taxCents;

    // ── 3. Generate order number ─────────────────────────────────────────────
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}`;

    // ── 4. Create Stripe PaymentIntent ──────────────────────────────────────
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: {
        orderNumber,
        customerId: req.user?.id ?? "guest",
        customerEmail: shippingAddress.email,
      },
      receipt_email: shippingAddress.email,
      description: `CutHaven order ${orderNumber}`,
    });

    // ── 5. Create a pending order in DB ─────────────────────────────────────
    // Order is created NOW, in "pending" state.
    // It becomes "confirmed" when the Stripe webhook fires (payment_intent.succeeded).
    // This ensures we always have a record even if the user closes the tab mid-payment.

    // Resolve customer_id if logged in
    let customerId: string | null = null;
    if (req.user) {
      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("auth_id", req.user.id)
        .maybeSingle();
      customerId = customer?.id ?? null;
    }

    const shippingAddressJson = {
      firstName: shippingAddress.firstName,
      lastName: shippingAddress.lastName,
      email: shippingAddress.email,
      phone: shippingAddress.phone,
      address: shippingAddress.address,
      city: shippingAddress.city,
      state: shippingAddress.state,
      zip: shippingAddress.zip,
      country: shippingAddress.country,
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: "pending",
        subtotal: subtotalCents / 100,
        shipping_cost: shippingCents / 100,
        tax_amount: taxCents / 100,
        discount_amount: 0,
        total: totalCents / 100,
        shipping_address: shippingAddressJson,
        billing_address: shippingAddressJson,
        payment_processor: "stripe",
        payment_status: "pending",
        payment_transaction_id: paymentIntent.id,
        customer_notes: customerNotes ?? null,
      })
      .select("id")
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = lineItems.map(({ product, item, unitPriceCents, lineTotalCents }) => ({
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      product_image: product.primary_image_url ?? null,  // column is product_image not product_image_url
      quantity: item.quantity,
      unit_price: unitPriceCents / 100,
      total_price: lineTotalCents / 100,
    }));

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(orderItems);
    if (itemsError) throw itemsError;

    // Return client_secret and order details to the frontend
    return res.json({
      clientSecret: paymentIntent.client_secret,
      orderId: order.id,
      orderNumber,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100,
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // In production, always verify the signature
  let event;
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch {
      return res.status(400).json({ error: "Webhook signature verification failed" });
    }
  } else {
    // Dev mode without webhook secret — parse directly (never in production)
    event = req.body;
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as { id: string };
      await supabaseAdmin
        .from("orders")
        .update({
          status: "confirmed",
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_transaction_id", pi.id);
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
