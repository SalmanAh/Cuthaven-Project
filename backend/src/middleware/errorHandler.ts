import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.too.large"
  ) {
    console.warn("[REQUEST_REJECTED]", req.method, req.path, "payload_too_large");
    return res.status(413).json({ error: "Request payload too large" });
  }

  console.error("[ERROR]", req.method, req.path, err);
  const message = err instanceof Error ? err.message : "Unexpected server error";
  // In development, return the real error message so it's visible in the browser too
  res.status(500).json({
    error: env.NODE_ENV === "development" ? message : "Unexpected server error",
    ...(env.NODE_ENV === "development" && err instanceof Error ? { stack: err.stack } : {}),
  });
}
