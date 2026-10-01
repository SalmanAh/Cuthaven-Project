import { Router } from "express";
import { createPaymentIntent, getOrderSummary, validateCoupon, confirmStripeOrder } from "../controllers/checkout.controller.js";
import { createPayPalOrder, capturePayPalOrder, getPayPalClientId } from "../controllers/paypal.controller.js";
import { getActiveGatewaysForCheckout } from "../controllers/payment-gateways.controller.js";
import { optionalAuth } from "../middleware/requireAuth.js";
import { checkoutCreateLimiter } from "../middleware/rateLimiter.js";

export const checkoutRouter = Router();

// Get active payment gateways (public keys only) for checkout frontend
checkoutRouter.get("/active-gateways", getActiveGatewaysForCheckout);

// Coupon validation — public
checkoutRouter.post("/validate-coupon", validateCoupon);

// Stripe: persist pending order, then create/verify the provider payment.
checkoutRouter.post("/payment-intent",        checkoutCreateLimiter, optionalAuth, createPaymentIntent);
checkoutRouter.post("/confirm-stripe-order",  optionalAuth, confirmStripeOrder);

// PayPal: reserve a trusted DB draft before provider approval, then capture it.
// The client-ID route remains as a compatibility alias; new clients use active-gateways.
checkoutRouter.get(  "/paypal/client-id",    getPayPalClientId);
checkoutRouter.post( "/paypal/create-order", checkoutCreateLimiter, optionalAuth, createPayPalOrder);
checkoutRouter.post( "/paypal/capture-order",optionalAuth, capturePayPalOrder);

// Order status/summary requires customer ownership or the guest token.
checkoutRouter.get("/order/:id", optionalAuth, getOrderSummary);
