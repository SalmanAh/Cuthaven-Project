import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

// ── Auth rate limiter ──────────────────────────────────────────────────────
// Applied to all /api/auth/* routes.
// Allows 20 requests per 15-minute window per IP before locking out.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 200 : 20,    // Relaxed in dev to avoid blocking during testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again in 15 minutes." },
  skipSuccessfulRequests: true, // Only failed requests count toward the limit
});

// ── Strict limiter for password-sensitive endpoints ────────────────────────
// Applied to login, forgot-password, and reset-password specifically.
export const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,    // 100 in dev, 10 in production (up from 5 to avoid infinite loop lockout)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait 15 minutes before trying again." },
  skipSuccessfulRequests: true, // Successful logins do NOT count — only failed attempts
});

// ── General API limiter ────────────────────────────────────────────────────
// Broad protection for the whole /api surface.
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Creating a checkout reserves scarce stock and coupon capacity, so successful
// anonymous requests must count too.
export const checkoutCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please try again later." },
});

export const conversationCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat creation attempts. Please try again later." },
});

export const conversationMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat messages. Please slow down." },
});
