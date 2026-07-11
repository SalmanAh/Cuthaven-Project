import Stripe from "stripe";
import { env } from "./env.js";

// Single shared Stripe instance — never instantiate elsewhere
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
});
