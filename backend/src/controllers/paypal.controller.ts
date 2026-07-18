import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { getPayPalAccessToken, getPayPalBaseURL } from "../config/paypal.js";
import { calculateTax } from "../lib/calculateTax.js";
import { sendOrderConfirmationEmail, type EmailOrderItem } from "../emails/orderConfirmation.js";
import { env } from "../config/env.js";

// ─── Shared validation schemas (same as Stripe flow) ──────────────────────

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().int().min(1),
});

const shippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().optional().default(""),
  address:   z.string().min(1),
  city:      z.string().min(1),
  state:     z.string().min(1),
  zip:       z.string().min(1),
  country:   z.string().default("US"),
});

const createPayPalOrderSchema = z.object({
  items:           z.array(cartItemSchema).min(1),
  shippingAddress: shippingAddressSchema,
  customerNotes:   z.string().optional(),
  couponCode:      z.string().optional(),
});

interface CouponRow {
  id: string;
  discount_type:    "percentage" | "fixed";
  discount_value:   number;
  min_order_amount: number | null;
  max_uses:         number | null;
  used_count:       number;
  valid_until:      string | null;
  is_active:        boolean;
}

const FREE_SHIPPING_THRESHOLD = 350_00; // cents

// ─── POST /api/checkout/paypal/create-order ────────────────────────────────
// Creates a PayPal order, stores a pending DB order, returns the PayPal orderId.
// The frontend uses the orderId to render the PayPal button and capture payment.
export async function createPayPalOrder(req: Request, res: Response, next: NextFunction) {
  try {
    // ── 1. Check PayPal is configured ───────────────────────────────────────
    const accessToken = await getPayPalAccessToken();
    if (!accessToken) {
      return res.status(503).json({ error: "PayPal is not configured on this server" });
    }

    // ── 2. Validate request body ────────────────────────────────────────────
    const parsed = createPayPalOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { items, shippingAddress, customerNotes, couponCode } = parsed.data;

    // ── 3. Fetch live product prices from DB ────────────────────────────────
    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodError } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, price, availability, stock_quantity, primary_image_url")
      .in("id", productIds)
      .eq("is_active", true);

    if (prodError) throw prodError;

    for (const item of items) {
      const product = (products ?? []).find((p: { id: string }) => p.id === item.productId);
      if (!product) return res.status(400).json({ error: "Product not found or unavailable" });
      if (product.availability === "out_of_stock") return res.status(400).json({ error: `"${product.name}" is out of stock` });
      if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Only ${product.stock_quantity} unit(s) of "${product.name}" available` });
      }
    }

    // ── 4. Calculate totals ─────────────────────────────────────────────────
    let subtotalCents = 0;
    const lineItems = items.map((item) => {
      const product = (products ?? []).find((p: { id: string }) => p.id === item.productId)!;
      const unitPriceCents = Math.round(product.price * 100);
      const lineTotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineTotalCents;
      return { product, item, unitPriceCents, lineTotalCents };
    });

    const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : 999;

    const taxResult = await calculateTax(
      { zip: shippingAddress.zip, state: shippingAddress.state, city: shippingAddress.city, street: shippingAddress.address },
      lineItems.map(({ product, item, unitPriceCents }) => ({ id: product.id, quantity: item.quantity, unit_price: unitPriceCents / 100 })),
      shippingCents / 100,
    );
    const taxCents = taxResult.taxAmountCents;

    // ── 5. Apply coupon ─────────────────────────────────────────────────────
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
        const isExpired  = c.valid_until && new Date(c.valid_until) < new Date();
        const isExhausted = c.max_uses !== null && c.used_count >= c.max_uses;
        const belowMin   = c.min_order_amount !== null && subtotalDollars < c.min_order_amount;
        if (!isExpired && !isExhausted && !belowMin) {
          discountCents = c.discount_type === "percentage"
            ? Math.round(subtotalCents * c.discount_value / 100)
            : Math.min(Math.round(c.discount_value * 100), subtotalCents);
          appliedCouponId = c.id;
        }
      }
    }

    const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - discountCents);
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}`;

    // ── 6. Create PayPal order ──────────────────────────────────────────────
    const paypalRes = await fetch(`${getPayPalBaseURL()}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${accessToken}`,
        "PayPal-Request-Id": orderNumber, // idempotency key
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: orderNumber,
          description:  `CutHaven order ${orderNumber}`,
          amount: {
            currency_code: "USD",
            value: (totalCents / 100).toFixed(2),
            breakdown: {
              item_total:        { currency_code: "USD", value: (subtotalCents / 100).toFixed(2) },
              shipping:          { currency_code: "USD", value: (shippingCents / 100).toFixed(2) },
              tax_total:         { currency_code: "USD", value: (taxCents / 100).toFixed(2) },
              discount:          { currency_code: "USD", value: (discountCents / 100).toFixed(2) },
            },
          },
          items: lineItems.map(({ product, item, unitPriceCents }) => ({
            name:        product.name.slice(0, 127),
            quantity:    String(item.quantity),
            unit_amount: { currency_code: "USD", value: (unitPriceCents / 100).toFixed(2) },
            category:    "PHYSICAL_GOODS",
          })),
          shipping: {
            name:    { full_name: `${shippingAddress.firstName} ${shippingAddress.lastName}` },
            address: {
              address_line_1: shippingAddress.address,
              admin_area_2:   shippingAddress.city,
              admin_area_1:   shippingAddress.state,
              postal_code:    shippingAddress.zip,
              country_code:   "US",
            },
          },
        }],
        application_context: {
          brand_name:          "CutHaven",
          shipping_preference: "SET_PROVIDED_ADDRESS",
          user_action:         "PAY_NOW",
        },
      }),
    });

    if (!paypalRes.ok) {
      const errBody = await paypalRes.text();
      console.error("[PAYPAL] Create order failed:", paypalRes.status, errBody);
      return res.status(502).json({ error: "Failed to create PayPal order. Please try again." });
    }

    const paypalOrder = await paypalRes.json() as { id: string };

    // Return PayPal order ID and totals — NO DB ORDER YET.
    // The DB order is created in /paypal/capture-order after the customer approves.
    return res.json({
      paypalOrderId: paypalOrder.id,
      orderNumber,
      subtotal:       subtotalCents / 100,
      shippingCost:   shippingCents / 100,
      taxAmount:      taxCents / 100,
      discountAmount: discountCents / 100,
      total:          totalCents / 100,
      // Pass totals + line items back so capture can create the DB order
      _checkoutData: {
        orderNumber, appliedCouponId,
        subtotalCents, shippingCents, taxCents, discountCents, totalCents,
        shippingAddress: { ...shippingAddress },
        customerNotes: customerNotes ?? null,
        lineItems: lineItems.map(({ product, item, unitPriceCents, lineTotalCents }) => ({
          productId: product.id, productName: product.name, productSlug: product.slug,
          productImage: product.primary_image_url ?? null,
          quantity: item.quantity, unitPrice: unitPriceCents / 100, totalPrice: lineTotalCents / 100,
        })),
      },
    });
  } catch (err) { next(err); }
}

// ─── POST /api/checkout/paypal/capture-order ──────────────────────────────
// Called after the customer approves the payment in the PayPal popup.
// Captures the payment and flips the DB order to confirmed.
export async function capturePayPalOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const { paypalOrderId, checkoutData } = req.body as {
      paypalOrderId: string;
      checkoutData: {
        orderNumber: string;
        appliedCouponId: string | null;
        subtotalCents: number;
        shippingCents: number;
        taxCents: number;
        discountCents: number;
        totalCents: number;
        shippingAddress: Record<string, string>;
        customerNotes: string | null;
        lineItems: Array<{
          productId: string; productName: string; productSlug: string;
          productImage: string | null; quantity: number; unitPrice: number; totalPrice: number;
        }>;
      };
    };

    if (!paypalOrderId || !checkoutData) {
      return res.status(400).json({ error: "paypalOrderId and checkoutData are required" });
    }

    const accessToken = await getPayPalAccessToken();
    if (!accessToken) return res.status(503).json({ error: "PayPal not configured" });

    // Capture the payment
    const captureRes = await fetch(
      `${getPayPalBaseURL()}/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
      },
    );

    const captureData = await captureRes.json() as {
      status: string;
      id: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
    };

    if (!captureRes.ok || captureData.status !== "COMPLETED") {
      console.error("[PAYPAL] Capture failed:", captureData);
      return res.status(402).json({ error: "PayPal payment was not completed. Please try again." });
    }

    // ── Payment succeeded — NOW create the DB order ─────────────────────────
    let customerId: string | null = null;
    if (req.user) {
      const { data: cust } = await supabaseAdmin.from("customers").select("id").eq("auth_id", req.user.id).maybeSingle();
      customerId = cust?.id ?? null;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: checkoutData.orderNumber,
        customer_id: customerId,
        status: "confirmed",
        payment_status: "paid",
        subtotal:         checkoutData.subtotalCents / 100,
        shipping_cost:    checkoutData.shippingCents / 100,
        tax_amount:       checkoutData.taxCents / 100,
        discount_amount:  checkoutData.discountCents / 100,
        total:            checkoutData.totalCents / 100,
        shipping_address: checkoutData.shippingAddress,
        billing_address:  checkoutData.shippingAddress,
        payment_processor: "paypal",
        payment_transaction_id: paypalOrderId,
        customer_notes:   checkoutData.customerNotes,
        coupon_id:        checkoutData.appliedCouponId,
      })
      .select("id, order_number, subtotal, shipping_cost, tax_amount, discount_amount, total, shipping_address, coupon_id")
      .single();

    if (orderError) throw orderError;

    await supabaseAdmin.from("order_items").insert(
      checkoutData.lineItems.map((i) => ({
        order_id: order.id, product_id: i.productId,
        product_name: i.productName, product_slug: i.productSlug,
        product_image: i.productImage,
        quantity: i.quantity, unit_price: i.unitPrice, total_price: i.totalPrice,
      }))
    );

    // Increment coupon usage
    if (checkoutData.appliedCouponId) {
      await supabaseAdmin.rpc("increment_coupon_usage", { coupon_id: checkoutData.appliedCouponId }).then(() => {});
    }

    // ── Send confirmation email ─────────────────────────────────────────────
    void (async () => {
      try {
        const addr = order.shipping_address as Record<string, string>;
        let couponCode: string | undefined;
        if (order.coupon_id) {
          const { data: coupon } = await supabaseAdmin.from("coupons").select("code").eq("id", order.coupon_id).maybeSingle();
          couponCode = (coupon as { code: string } | null)?.code;
        }
        await sendOrderConfirmationEmail({
          to: addr.email, orderNumber: order.order_number, orderId: order.id,
          items: checkoutData.lineItems.map((i) => ({
            productName: i.productName, productImage: i.productImage,
            quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice,
          })),
          subtotal: order.subtotal, shippingCost: order.shipping_cost,
          taxAmount: order.tax_amount, discountAmount: order.discount_amount,
          couponCode, total: order.total,
          shippingAddress: {
            firstName: addr.firstName ?? "", lastName: addr.lastName ?? "",
            address: addr.address ?? "", city: addr.city ?? "",
            state: addr.state ?? "", zip: addr.zip ?? "", country: addr.country ?? "US",
          },
          estimatedDelivery: getEstimatedDelivery(),
        });
      } catch (e: unknown) { console.error("[PAYPAL] Confirmation email failed (non-fatal):", e); }
    })();

    return res.json({ success: true, orderId: order.id, orderNumber: order.order_number });
  } catch (err) { next(err); }
}

// ─── GET /api/checkout/paypal/client-id ───────────────────────────────────
// Returns the PayPal client ID (safe to expose — it's a public key).
// The frontend uses it to initialise the PayPal JS SDK.
export async function getPayPalClientId(req: Request, res: Response) {
  if (!env.PAYPAL_CLIENT_ID) {
    return res.status(503).json({ error: "PayPal not configured" });
  }
  return res.json({ clientId: env.PAYPAL_CLIENT_ID });
}

function getEstimatedDelivery(): string {
  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result;
  };
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return `${fmt(addBusinessDays(now, 5))} – ${fmt(addBusinessDays(now, 8))}`;
}
