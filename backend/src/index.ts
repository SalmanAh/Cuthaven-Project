import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
// helmet sets ~15 HTTP headers that block common web vulnerabilities:
// X-Content-Type-Options, X-Frame-Options, HSTS, CSP (basic), etc.
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
// Only the configured frontend origin can call this API from a browser.
// In production FRONTEND_ORIGIN must be the exact deployed domain (no trailing slash).
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // we use Bearer tokens, not cookies
  }),
);

// ── Body parsing ───────────────────────────────────────────────────────────
// NOTE: /api/checkout/webhook needs raw body for Stripe signature verification.
// That route registers its own express.raw() parser BEFORE express.json() sees it.
app.use(express.json({ limit: "1mb" }));

// ── Health check ───────────────────────────────────────────────────────────
// Not rate-limited so uptime monitors never get blocked.
app.get("/health", (_req, res) => res.json({ status: "ok", env: env.NODE_ENV }));

// ── API routes (with general rate limiting) ────────────────────────────────
app.use("/api", apiLimiter, apiRouter);

// ── Global error handler ───────────────────────────────────────────────────
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`✅ CutHaven backend running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
