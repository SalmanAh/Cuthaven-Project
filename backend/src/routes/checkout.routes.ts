import { Router } from "express";
import express from "express";
import { createPaymentIntent, stripeWebhook, getOrderSummary } from "../controllers/checkout.controller.js";
import { optionalAuth } from "../middleware/requireAuth.js";

export const checkoutRouter = Router();

// Stripe webhook — raw body required for signature verification
checkoutRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

// Payment intent — optionalAuth so logged-in users get order linked to account,
// guests still work (req.user will be undefined)
checkoutRouter.post("/payment-intent", optionalAuth, createPaymentIntent);

// Order summary for confirmation page — public
checkoutRouter.get("/order/:id", getOrderSummary);
