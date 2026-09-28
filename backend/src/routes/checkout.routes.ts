import { Router } from "express";
import { createPaymentIntent, getOrderSummary, validateCoupon, confirmStripeOrder } from "../controllers/checkout.controller.js";
import { createPayPalOrder, capturePayPalOrder, getPayPalClientId } from "../controllers/paypal.controller.js";
import { getActiveGatewaysForCheckout } from "../controllers/payment-gateways.controller.js";
import { optionalAuth } from "../middleware/requireAuth.js";

export const checkoutRouter = Router();

// Get active payment gateways (public keys only) for checkout frontend
checkoutRouter.get("/active-gateways", getActiveGatewaysForCheckout);

// Coupon validation — public
checkoutRouter.post("/validate-coupon", validateCoupon);

// Stripe: persist pending order, then create/verify the provider payment.
checkoutRouter.post("/payment-intent",        optionalAuth, createPaymentIntent);
checkoutRouter.post("/confirm-stripe-order",  optionalAuth, confirmStripeOrder);

// PayPal: create PayPal order (no DB), capture after approval (creates DB order)
checkoutRouter.get(  "/paypal/client-id",    getPayPalClientId);
checkoutRouter.post( "/paypal/create-order", optionalAuth, createPayPalOrder);
checkoutRouter.post( "/paypal/capture-order",optionalAuth, capturePayPalOrder);

// Order status/summary requires customer ownership or the guest token.
checkoutRouter.get("/order/:id", optionalAuth, getOrderSummary);
