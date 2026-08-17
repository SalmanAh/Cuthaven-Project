import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

const app = express();

// ── Trust proxy ────────────────────────────────────────────────────────────
// Behind Nginx reverse proxy, trust X-Forwarded-* headers for rate limiting
app.set("trust proxy", 1);

// ── Compression ────────────────────────────────────────────────────────────
// Enable gzip/deflate compression for all responses
// This significantly reduces bandwidth and improves load times
app.use(compression({
  level: 6, // Balance between compression ratio and CPU usage
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
}));

// ── Security headers ───────────────────────────────────────────────────────
// helmet sets ~15 HTTP headers that block common web vulnerabilities:
// X-Content-Type-Options, X-Frame-Options, HSTS, CSP (basic), etc.
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
// Support multiple frontend origins (e.g., with and without www)
// FRONTEND_ORIGIN can be a single origin or comma-separated list
const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
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
