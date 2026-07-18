import { Router } from "express";
import { getProductFeed, getFeedStatus } from "../controllers/feed.controller.js";

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

// Feed sync log — last 20 entries. Used by admin dashboard in Milestone 5.
// No auth guard for now (non-sensitive operational data); add requireRole("admin")
// in M5 when admin endpoints are built.
feedRouter.get("/status", getFeedStatus);
