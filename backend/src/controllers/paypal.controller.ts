import type { Request, Response, NextFunction } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { getPayPalAccessToken, getPayPalBaseURL } from "../config/paypal.js";
import { calculateTax } from "../lib/calculateTax.js";
import { getGatewayConfig } from "./payment-gateways.controller.js";
import {
  dispatchCheckoutOutbox,
  releaseCheckoutReservation,
  type FinalizationOutcome,
} from "../services/checkoutFinalization.service.js";
import {
  capturePayPalRequestSchema,
  createPendingPayPalCheckout,
  verifyPayPalCapture,
  type PayPalCaptureResponse,
} from "../services/paypalCheckout.service.js";

const cartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
});

const shippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  phone: z.string().optional().default(""),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.literal("US").default("US"),
});

const createPayPalOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  shippingAddress: shippingAddressSchema,
  customerNotes: z.string().optional(),
  couponCode: z.string().optional(),
});

interface CouponRow {
  id: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

interface PayPalDraftRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  total: number;
  payment_processor: string;
  payment_provider_order_id: string | null;
  payment_transaction_id: string | null;
  payment_status: string;
  reservation_status: string;
  confirmation_token_hash: string | null;
  payment_gateway_id: string | null;
}

interface RpcOutcome {
  outcome: FinalizationOutcome;
  order_id: string;
}

const FREE_SHIPPING_THRESHOLD = 350_00;

function hashConfirmationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function paypalRequestId(operation: "create" | "capture", orderId: string): string {
  const digest = createHash("sha256").update(`${operation}:${orderId}`).digest("hex").slice(0, 24);
  return `${operation}-${digest}`;
}

function tokenMatches(token: string | null | undefined, expectedHash: string | null): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashConfirmationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function resolveCustomerId(req: Request): Promise<string | null> {
  if (!req.user) return null;
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_id", req.user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createPayPalOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createPayPalOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { items, shippingAddress, customerNotes, couponCode } = parsed.data;

    const paypalConfig = await getGatewayConfig("paypal");
    if (!paypalConfig || paypalConfig.type !== "paypal") {
      return res.status(503).json({ error: "PayPal is not configured on this server" });
    }
    const accessToken = await getPayPalAccessToken(
      paypalConfig.clientId,
      paypalConfig.clientSecret,
      paypalConfig.mode,
    );
    if (!accessToken) return res.status(503).json({ error: "Failed to authenticate with PayPal" });

    const productIds = [...new Set(items.map((item) => item.productId))];
    const { data: products, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, price, availability, stock_quantity, primary_image_url")
      .in("id", productIds)
      .eq("is_active", true);
    if (productError) throw productError;

    for (const item of items) {
      const product = (products ?? []).find((row: { id: string }) => row.id === item.productId);
      if (!product) return res.status(400).json({ error: "Product not found or unavailable" });
      if (product.availability === "out_of_stock") {
        return res.status(400).json({ error: `"${product.name}" is out of stock` });
      }
      if (product.stock_quantity !== null && product.stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `Only ${product.stock_quantity} unit(s) of "${product.name}" available`,
        });
      }
    }

    let subtotalCents = 0;
    const lineItems = items.map((item) => {
      const product = (products ?? []).find((row: { id: string }) => row.id === item.productId)!;
      const unitPriceCents = Math.round(product.price * 100);
      const lineTotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineTotalCents;
      return { product, item, unitPriceCents, lineTotalCents };
    });
    const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : 999;
    const taxResult = await calculateTax(
      {
        zip: shippingAddress.zip,
        state: shippingAddress.state,
        city: shippingAddress.city,
        street: shippingAddress.address,
      },
      lineItems.map(({ product, item, unitPriceCents }) => ({
        id: product.id,
        quantity: item.quantity,
        unit_price: unitPriceCents / 100,
      })),
      shippingCents / 100,
    );
    const taxCents = taxResult.taxAmountCents;
    const customerId = await resolveCustomerId(req);

    let discountCents = 0;
    let appliedCouponId: string | null = null;
    if (couponCode) {
      const { data: coupon, error: couponError } = await supabaseAdmin
        .from("coupons")
        .select("id, discount_type, discount_value, min_order_amount, max_uses, used_count, is_active, valid_from, valid_until")
        .eq("code", couponCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();
      if (couponError) throw couponError;

      if (coupon) {
        const value = coupon as CouponRow;
        const now = new Date();
        const unavailable =
          !value.is_active ||
          (value.valid_from !== null && new Date(value.valid_from) > now) ||
          (value.valid_until !== null && new Date(value.valid_until) < now) ||
          (value.max_uses !== null && value.used_count >= value.max_uses) ||
          (value.min_order_amount !== null && subtotalCents / 100 < value.min_order_amount);

        let alreadyUsed = false;
        if (!unavailable && customerId) {
          const { count, error } = await supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", customerId)
            .eq("coupon_id", value.id)
            .or("reservation_status.in.(reserved,committed),status.in.(confirmed,processing,shipped,delivered)");
          if (error) throw error;
          alreadyUsed = (count ?? 0) > 0;
        } else if (!unavailable) {
          const { count, error } = await supabaseAdmin
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("coupon_id", value.id)
            .or("reservation_status.in.(reserved,committed),status.in.(confirmed,processing,shipped,delivered)")
            .filter("shipping_address->>email", "eq", shippingAddress.email.toLowerCase().trim());
          if (error) throw error;
          alreadyUsed = (count ?? 0) > 0;
        }

        if (!unavailable && !alreadyUsed) {
          discountCents = value.discount_type === "percentage"
            ? Math.round(subtotalCents * value.discount_value / 100)
            : Math.min(Math.round(value.discount_value * 100), subtotalCents);
          appliedCouponId = value.id;
        }
      }
    }

    const totalCents = Math.max(0, subtotalCents + shippingCents + taxCents - discountCents);
    const orderNumber = `CUT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const confirmationToken = customerId ? null : randomBytes(32).toString("base64url");
    const confirmationTokenHash = confirmationToken ? hashConfirmationToken(confirmationToken) : null;
    const shippingAddressJson = { ...shippingAddress };

    const checkout = await createPendingPayPalCheckout({
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
      items: lineItems.map(({ product, item, unitPriceCents, lineTotalCents }) => ({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productImage: product.primary_image_url ?? null,
        quantity: item.quantity,
        unitPrice: unitPriceCents / 100,
        totalPrice: lineTotalCents / 100,
      })),
    }, {
      createPendingOrder: async (input) => {
        const { data, error } = await supabaseAdmin.rpc("create_checkout_draft", {
          p_order: {
            order_number: input.orderNumber,
            customer_id: input.customerId,
            subtotal: input.subtotal,
            shipping_cost: input.shippingCost,
            tax_amount: input.taxAmount,
            discount_amount: input.discountAmount,
            total: input.total,
            shipping_address: input.shippingAddress,
            customer_notes: input.customerNotes,
            coupon_id: input.couponId,
            confirmation_token_hash: input.confirmationTokenHash,
            payment_processor: "paypal",
            payment_gateway_id: paypalConfig.gatewayId,
          },
          p_items: input.items.map((item) => ({
            product_id: item.productId,
            product_name: item.productName,
            product_slug: item.productSlug,
            product_image: item.productImage,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice,
          })),
        });
        if (error) throw error;
        if (typeof data !== "string") throw new Error("create_checkout_draft returned no order ID");
        return { id: data };
      },
      createProviderOrder: async (input) => {
        const paypalResponse = await fetch(`${getPayPalBaseURL(paypalConfig.mode)}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "PayPal-Request-Id": paypalRequestId("create", input.orderId),
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [{
              reference_id: input.orderNumber,
              custom_id: input.orderId,
              description: `CutHaven order ${input.orderNumber}`,
              amount: {
                currency_code: "USD",
                value: (input.amountCents / 100).toFixed(2),
                breakdown: {
                  item_total: { currency_code: "USD", value: (subtotalCents / 100).toFixed(2) },
                  shipping: { currency_code: "USD", value: (shippingCents / 100).toFixed(2) },
                  tax_total: { currency_code: "USD", value: (taxCents / 100).toFixed(2) },
                  discount: { currency_code: "USD", value: (discountCents / 100).toFixed(2) },
                },
              },
              items: lineItems.map(({ product, item, unitPriceCents }) => ({
                name: product.name.slice(0, 127),
                quantity: String(item.quantity),
                unit_amount: { currency_code: "USD", value: (unitPriceCents / 100).toFixed(2) },
                category: "PHYSICAL_GOODS",
              })),
              shipping: {
                name: { full_name: `${shippingAddress.firstName} ${shippingAddress.lastName}` },
                address: {
                  address_line_1: shippingAddress.address,
                  admin_area_2: shippingAddress.city,
                  admin_area_1: shippingAddress.state,
                  postal_code: shippingAddress.zip,
                  country_code: "US",
                },
              },
            }],
            application_context: {
              brand_name: "CutHaven",
              shipping_preference: "SET_PROVIDED_ADDRESS",
              user_action: "PAY_NOW",
            },
          }),
        });
        const responseBody = await paypalResponse.json() as { id?: string; status?: string };
        if (!paypalResponse.ok || !responseBody.id) {
          console.error("[PAYPAL]", { orderId: input.orderId, result: "create_failed", httpStatus: paypalResponse.status });
          throw new Error("Failed to create PayPal order");
        }
        return { id: responseBody.id };
      },
      linkProviderOrder: async (orderId, providerOrderId) => {
        const { data, error } = await supabaseAdmin.rpc("link_paypal_order", {
          p_order_id: orderId,
          p_paypal_order_id: providerOrderId,
        });
        if (error) throw error;
        if (!new Set(["linked", "already_linked"]).has(data as string)) {
          throw new Error(`Could not link PayPal order: ${String(data)}`);
        }
      },
      releasePendingOrder: async (orderId) => {
        const outcome = await releaseCheckoutReservation(orderId, "PayPal order setup failed");
        if (!new Set(["released", "already_released"]).has(outcome)) {
          throw new Error(`Could not release PayPal reservation: ${outcome}`);
        }
      },
    });

    console.info("[PAYPAL]", { orderId: checkout.orderId, providerOrderId: checkout.providerOrderId, result: "draft_created" });
    return res.json({
      paypalOrderId: checkout.providerOrderId,
      orderId: checkout.orderId,
      orderNumber,
      confirmationToken,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      taxAmount: taxCents / 100,
      discountAmount: discountCents / 100,
      total: totalCents / 100,
    });
  } catch (error) {
    next(error);
  }
}

export async function capturePayPalOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = capturePayPalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }
    const { orderId, paypalOrderId, confirmationToken } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_id, total, payment_processor, payment_provider_order_id, payment_transaction_id, payment_status, reservation_status, confirmation_token_hash, payment_gateway_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Order not found" });
    const order = data as PayPalDraftRow;

    if (order.customer_id) {
      const customerId = await resolveCustomerId(req);
      if (!customerId || customerId !== order.customer_id) {
        return res.status(403).json({ error: "You cannot capture this order" });
      }
    } else if (!tokenMatches(confirmationToken, order.confirmation_token_hash)) {
      return res.status(403).json({ error: "Invalid order confirmation token" });
    }

    if (order.payment_processor !== "paypal" || order.payment_provider_order_id !== paypalOrderId) {
      return res.status(409).json({ error: "PayPal order does not match the checkout draft" });
    }
    if (order.payment_status === "paid" && order.reservation_status === "committed") {
      return res.json({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        confirmationToken: confirmationToken ?? null,
      });
    }
    if (order.payment_status !== "pending" || order.reservation_status !== "reserved") {
      return res.status(409).json({ error: "Order is not available for capture" });
    }
    if (!order.payment_gateway_id) {
      return res.status(409).json({ error: "Order is not linked to a payment gateway" });
    }

    const paypalConfig = await getGatewayConfig("paypal", order.payment_gateway_id);
    if (!paypalConfig || paypalConfig.type !== "paypal") {
      return res.status(503).json({ error: "PayPal is not configured on this server" });
    }
    const accessToken = await getPayPalAccessToken(
      paypalConfig.clientId,
      paypalConfig.clientSecret,
      paypalConfig.mode,
    );
    if (!accessToken) return res.status(503).json({ error: "Failed to authenticate with PayPal" });

    const captureResponse = await fetch(
      `${getPayPalBaseURL(paypalConfig.mode)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "PayPal-Request-Id": paypalRequestId("capture", order.id),
        },
      },
    );
    const captureBody = await captureResponse.json() as PayPalCaptureResponse;
    if (!captureResponse.ok) {
      console.error("[PAYPAL]", { orderId: order.id, providerOrderId: paypalOrderId, result: "capture_failed", httpStatus: captureResponse.status });
      return res.status(402).json({ error: "PayPal payment was not completed. Please try again." });
    }

    let verified;
    try {
      verified = verifyPayPalCapture(captureBody, {
        paypalOrderId,
        orderNumber: order.order_number,
        amountCents: Math.round(order.total * 100),
        currency: "USD",
      });
    } catch (verificationError) {
      console.error("[PAYPAL]", {
        orderId: order.id,
        providerOrderId: paypalOrderId,
        result: "capture_verification_failed",
        reason: verificationError instanceof Error ? verificationError.message : "unknown_error",
      });
      return res.status(502).json({ error: "Captured payment could not be matched to this order; support has been alerted." });
    }

    const { data: finalizationRows, error: finalizationError } = await supabaseAdmin.rpc("finalize_paypal_capture", {
      p_order_id: order.id,
      p_paypal_order_id: paypalOrderId,
      p_capture_id: verified.captureId,
      p_currency: verified.currency,
      p_amount_cents: verified.amountCents,
      p_reference_id: order.order_number,
      p_provider_event_id: `paypal-capture:${verified.captureId}`,
    });
    if (finalizationError) throw finalizationError;
    const finalization = (finalizationRows as RpcOutcome[] | null)?.[0];
    if (!finalization || !new Set(["finalized", "already_finalized"]).has(finalization.outcome)) {
      throw new Error(`PayPal finalization rejected: ${finalization?.outcome ?? "missing_outcome"}`);
    }

    console.info("[FINALIZE]", {
      orderId: order.id,
      provider: "paypal",
      providerEventId: verified.captureId,
      result: finalization.outcome,
    });
    void dispatchCheckoutOutbox().catch((dispatchError) =>
      console.error("[OUTBOX]", {
        orderId: order.id,
        result: "dispatch_failed",
        reason: dispatchError instanceof Error ? dispatchError.message : "unknown_error",
      }),
    );

    return res.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      confirmationToken: confirmationToken ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPayPalClientId(_req: Request, res: Response) {
  const paypalConfig = await getGatewayConfig("paypal");
  if (!paypalConfig || paypalConfig.type !== "paypal") {
    return res.status(503).json({ error: "PayPal not configured" });
  }
  return res.json({ clientId: paypalConfig.clientId });
}
