import { Router } from "express";
import { getProductFeed, getFeedStatus } from "../controllers/feed.controller.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const feedRouter = Router();

// ─── Public ─────────────────────────────────────────────────────────────────

// The feed URL to register in Google Merchant Center:
//   https://www.cuthaven.com/api/feed/products.xml
//
// In GMC:  Products → Feeds → Add feed
//          → Scheduled fetch  → enter the URL above
//          → Fetch frequency: Daily
//          → Country: United States
//          → Language: English
//
// GMC will crawl this URL on your chosen schedule.
// The endpoint caches the XML for 30 minutes to avoid repeated DB hits.
feedRouter.get("/products.xml", getProductFeed);

// Feed sync log — operational details restricted to administrators.
feedRouter.get("/status", requireAuth, requireRole("admin"), getFeedStatus);
