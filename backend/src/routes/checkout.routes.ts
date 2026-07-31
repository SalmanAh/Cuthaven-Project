import { Router } from "express";
import express from "express";
import { createPaymentIntent, stripeWebhook, getOrderSummary, validateCoupon, confirmStripeOrder, createCodOrder } from "../controllers/checkout.controller.js";
import { createPayPalOrder, capturePayPalOrder, getPayPalClientId } from "../controllers/paypal.controller.js";
import { getActiveGatewaysForCheckout } from "../controllers/payment-gateways.controller.js";
import { optionalAuth } from "../middleware/requireAuth.js";

export const checkoutRouter = Router();

// Get active payment gateways (public keys only) for checkout frontend
checkoutRouter.get("/active-gateways", getActiveGatewaysForCheckout);

// Stripe webhook — raw body required for signature verification
checkoutRouter.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// Coupon validation — public
checkoutRouter.post("/validate-coupon", validateCoupon);

// Stripe: create intent (no DB order), then confirm after payment
checkoutRouter.post("/payment-intent",        optionalAuth, createPaymentIntent);
checkoutRouter.post("/confirm-stripe-order",  optionalAuth, confirmStripeOrder);

// Cash on Delivery — creates order only on customer confirmation
checkoutRouter.post("/cod-order", optionalAuth, createCodOrder);

// PayPal: create PayPal order (no DB), capture after approval (creates DB order)
checkoutRouter.get(  "/paypal/client-id",    getPayPalClientId);
checkoutRouter.post( "/paypal/create-order", optionalAuth, createPayPalOrder);
checkoutRouter.post( "/paypal/capture-order",optionalAuth, capturePayPalOrder);

// Order summary for confirmation page — public
checkoutRouter.get("/order/:id", getOrderSummary);
