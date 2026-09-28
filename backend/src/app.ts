import express, { type RequestHandler, type Router } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { stripeWebhook } from "./controllers/checkout.controller.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";

interface AppDependencies {
  webhookHandler?: RequestHandler;
  mountedApiRouter?: Router;
}

/**
 * Creates the Express application without opening a network port.
 * Optional dependencies are used by integration tests to observe middleware
 * behavior without calling Stripe, Supabase, or other external services.
 */
export function createApp({
  webhookHandler = stripeWebhook,
  mountedApiRouter = apiRouter,
}: AppDependencies = {}) {
  const app = express();

  // Behind a single reverse proxy (for example Nginx), trust X-Forwarded-*.
  app.set("trust proxy", 1);

  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers["x-no-compression"]) return false;
        return compression.filter(req, res);
      },
    }),
  );

  app.use(helmet());

  const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((origin) => origin.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients such as Stripe, mobile apps, curl, and monitors
        // do not send an Origin header.
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );

  // Stripe verifies a signature over the exact request bytes. This route must
  // be registered before express.json(), otherwise JSON parsing destroys the
  // original byte sequence and valid webhook signatures fail verification.
  app.post(
    "/api/checkout/webhook",
    apiLimiter,
    express.raw({ type: "application/json", limit: "1mb" }),
    webhookHandler,
  );

  // All non-webhook JSON endpoints use the normal parsed-body middleware.
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", env: env.NODE_ENV }));
  app.use("/api", apiLimiter, mountedApiRouter);
  app.use(errorHandler);

  return app;
}
