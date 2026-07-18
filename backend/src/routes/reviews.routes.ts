import { Router } from "express";
import { submitReview, getProductReviews, checkCanReview } from "../controllers/reviews.controller.js";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const reviewsRouter = Router();

// Public — get approved reviews for a product
reviewsRouter.get("/:productSlug", getProductReviews);

// Check if logged-in customer can review — requireAuth so we know who they are
reviewsRouter.get("/can-review/:productId", requireAuth, checkCanReview);

// Authenticated customers only
reviewsRouter.post("/", requireAuth, requireRole("customer"), submitReview);
