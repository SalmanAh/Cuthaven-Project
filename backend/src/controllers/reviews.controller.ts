import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

const reviewSchema = z.object({
  productId:           z.string().uuid(),
  rating:              z.number().int().min(1).max(5),
  reviewText:          z.string().min(1).max(2000).optional(),
  disclosedIncentive:  z.boolean().default(false),
  insiderRelationship: z.string().max(50).nullable().optional(),
});

// ─── GET /api/reviews/can-review/:productId ───────────────────────────────
// Authenticated customers only. Checks if the customer can review this product.
// Returns: { canReview, reason }
// reason: "not_logged_in" | "not_purchased" | "not_delivered" | "already_reviewed" | "ok"
export async function checkCanReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params;

    // Must be logged in
    if (!req.user) {
      return res.json({ canReview: false, reason: "not_logged_in" });
    }

    // Resolve customer
    const { data: customer } = await supabaseAdmin
      .from("customers").select("id").eq("auth_id", req.user.id).maybeSingle();
    if (!customer) {
      return res.json({ canReview: false, reason: "not_logged_in" });
    }

    // Check for duplicate review
    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("product_id", productId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existing) {
      return res.json({ canReview: false, reason: "already_reviewed" });
    }

    // Check if they ordered this product at all (any status)
    const { data: anyOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", customer.id)
      .in("status", ["confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);

    const anyOrderIds = (anyOrders ?? []).map((o: { id: string }) => o.id);
    let orderedAtAll = false;
    if (anyOrderIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId)
        .in("order_id", anyOrderIds);
      orderedAtAll = (count ?? 0) > 0;
    }

    if (!orderedAtAll) {
      return res.json({ canReview: false, reason: "not_purchased" });
    }

    // Check if they have a DELIVERED order for this product
    const { data: deliveredOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "delivered");

    const deliveredIds = (deliveredOrders ?? []).map((o: { id: string }) => o.id);
    let hasDelivered = false;
    if (deliveredIds.length > 0) {
      const { count } = await supabaseAdmin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId)
        .in("order_id", deliveredIds);
      hasDelivered = (count ?? 0) > 0;
    }

    if (!hasDelivered) {
      return res.json({ canReview: false, reason: "not_delivered" });
    }

    return res.json({ canReview: true, reason: "ok" });
  } catch (err) { next(err); }
}

// ─── POST /api/reviews ─────────────────────────────────────────────────────
// Authenticated customers only. Validates they purchased the product.
export async function submitReview(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const { productId, rating, reviewText, disclosedIncentive, insiderRelationship } = parsed.data;

    // Resolve customer row
    const { data: customer } = await supabaseAdmin
      .from("customers").select("id").eq("auth_id", req.user!.id).maybeSingle();
    if (!customer) return res.status(403).json({ error: "Customer account not found" });

    // Check they actually purchased this product — do a simple join via two queries
    const { data: customerOrders } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("status", "delivered"); // ONLY delivered orders qualify

    const orderIds = (customerOrders ?? []).map((o: { id: string }) => o.id);
    let isVerifiedPurchase = false;
    if (orderIds.length > 0) {
      const { count: purchaseCount } = await supabaseAdmin
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", productId)
        .in("order_id", orderIds);
      isVerifiedPurchase = (purchaseCount ?? 0) > 0;
    }

    // Reject if order not delivered
    if (!isVerifiedPurchase) {
      // Check if they ordered but not delivered yet
      const { data: anyOrders } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("customer_id", customer.id)
        .in("status", ["confirmed", "processing", "shipped"]);
      const anyIds = (anyOrders ?? []).map((o: { id: string }) => o.id);
      let orderedNotDelivered = false;
      if (anyIds.length > 0) {
        const { count } = await supabaseAdmin
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .eq("product_id", productId)
          .in("order_id", anyIds);
        orderedNotDelivered = (count ?? 0) > 0;
      }
      if (orderedNotDelivered) {
        return res.status(403).json({ error: "You haven't received this item yet. Reviews can only be submitted after your order has been delivered." });
      }
      return res.status(403).json({ error: "Only customers who have purchased and received this item can leave a review." });
    }

    // Prevent duplicate reviews
    const { data: existing } = await supabaseAdmin
      .from("reviews")
      .select("id")
      .eq("product_id", productId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: "You have already reviewed this product" });

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .insert({
        product_id:           productId,
        customer_id:          customer.id,
        rating,
        review_text:          reviewText ?? null,
        is_verified_purchase: isVerifiedPurchase,
        is_approved:          false, // requires admin moderation before appearing
        disclosed_incentive:  disclosedIncentive,
        insider_relationship: insiderRelationship ?? null,
        created_at:           now,
        updated_at:           now,
      })
      .select("id")
      .single();

    if (error) throw error;
    return res.status(201).json({ reviewId: data.id, message: "Review submitted and awaiting approval." });
  } catch (err) { next(err); }
}

// ─── GET /api/reviews/:productSlug ────────────────────────────────────────
// Public — returns approved reviews only.
export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { productSlug } = req.params;

    // Resolve product by slug
    const { data: product } = await supabaseAdmin
      .from("products").select("id, name").eq("slug", productSlug).maybeSingle();
    if (!product) return res.status(404).json({ error: "Product not found" });

    const { data: reviews, error } = await supabaseAdmin
      .from("reviews")
      .select(`
        id, rating, review_text, is_verified_purchase,
        disclosed_incentive, insider_relationship,
        created_at,
        customers ( first_name, last_name )
      `)
      .eq("product_id", product.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const mapped = (reviews ?? []).map((r: any) => ({
      id:                 r.id,
      rating:             r.rating,
      reviewText:         r.review_text,
      isVerifiedPurchase: r.is_verified_purchase,
      disclosedIncentive: r.disclosed_incentive,
      insiderRelationship:r.insider_relationship,
      createdAt:          r.created_at,
      reviewerName:       r.customers
        ? `${r.customers.first_name} ${r.customers.last_name[0]}.`
        : "Anonymous",
    }));

    // Aggregate stats
    const avg = mapped.length > 0
      ? mapped.reduce((s: number, r: any) => s + r.rating, 0) / mapped.length
      : 0;

    return res.json({
      reviews: mapped,
      count:   mapped.length,
      avgRating: Math.round(avg * 10) / 10,
    });
  } catch (err) { next(err); }
}

// ─── PATCH /api/admin/reviews/:id ─────────────────────────────────────────
// Admin moderation — approve or reject.
export async function moderateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isApproved } = req.body as { isApproved: boolean };
    if (typeof isApproved !== "boolean") {
      return res.status(400).json({ error: "isApproved (boolean) is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("reviews")
      .update({ is_approved: isApproved, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, is_approved")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Review not found" });
    return res.json({ review: data });
  } catch (err) { next(err); }
}

// ─── GET /api/admin/reviews ────────────────────────────────────────────────
// Admin — list all reviews pending moderation.
export async function listAdminReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { approved } = req.query as { approved?: string };
    let query = supabaseAdmin
      .from("reviews")
      .select(`
        id, rating, review_text, is_verified_purchase, is_approved,
        disclosed_incentive, insider_relationship, created_at,
        products ( name, slug ),
        customers ( first_name, last_name, email )
      `)
      .order("created_at", { ascending: false });

    if (approved !== undefined) query = query.eq("is_approved", approved === "true");

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ reviews: data ?? [] });
  } catch (err) { next(err); }
}
