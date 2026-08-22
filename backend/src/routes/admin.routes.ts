import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { listAllOrders, getAdminOrderById, updateOrderStatus, updatePaymentStatus } from "../controllers/admin.orders.controller.js";
import { adminListProducts, createProduct, updateProduct, deleteProduct } from "../controllers/admin.products.controller.js";
import { listAllCustomers, getAdminCustomerById } from "../controllers/admin.customers.controller.js";
import { listStaff, createStaffMember, toggleStaffActive } from "../controllers/admin.staff.controller.js";
import { getAdminAnalytics, getAdminRevenueSeries } from "../controllers/admin.analytics.controller.js";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "../controllers/admin.coupons.controller.js";
import { listAdminReviews, moderateReview } from "../controllers/reviews.controller.js";
import { adminListPosts, adminCreatePost, adminUpdatePost, adminDeletePost } from "../controllers/blog.controller.js";
import * as adminQueriesController from "../controllers/admin.queries.controller.js";

export const adminRouter = Router();

// All admin routes require authentication
adminRouter.use(requireAuth);

// ── Orders (admin + store_manager + product_manager) ──────────────────────
adminRouter.get(
  "/orders",
  requireRole("admin", "store_manager", "product_manager"),
  listAllOrders,
);
adminRouter.get(
  "/orders/:id",
  requireRole("admin", "store_manager", "product_manager"),
  getAdminOrderById,
);
adminRouter.patch("/orders/:id/status",         requireRole("admin", "store_manager", "product_manager"), updateOrderStatus);
adminRouter.patch("/orders/:id/payment-status", requireRole("admin", "store_manager", "product_manager"), updatePaymentStatus);

// ── Products (admin + product_manager for full CRUD) ──────────────────────
adminRouter.get(
  "/products",
  requireRole("admin", "store_manager", "product_manager"),
  adminListProducts,
);
adminRouter.post(
  "/products",
  requireRole("admin", "product_manager"),
  createProduct,
);
adminRouter.put(
  "/products/:id",
  requireRole("admin", "product_manager"),
  updateProduct,
);
adminRouter.delete(
  "/products/:id",
  requireRole("admin", "product_manager"),
  deleteProduct,
);

// ── Customers (admin + store_manager) ─────────────────────────────────────
adminRouter.get(
  "/customers",
  requireRole("admin", "store_manager"),
  listAllCustomers,
);
adminRouter.get(
  "/customers/:id",
  requireRole("admin", "store_manager"),
  getAdminCustomerById,
);

// ── Staff management (admin only) ─────────────────────────────────────────
adminRouter.get(
  "/staff",
  requireRole("admin"),
  listStaff,
);
adminRouter.post(
  "/staff",
  requireRole("admin"),
  createStaffMember,
);
adminRouter.patch(
  "/staff/:id/toggle",
  requireRole("admin"),
  toggleStaffActive,
);

// ── Analytics (admin + store_manager + product_manager) ───────────────────
adminRouter.get("/analytics/summary", requireRole("admin", "store_manager", "product_manager"), getAdminAnalytics);
adminRouter.get("/analytics/series",  requireRole("admin", "store_manager", "product_manager"), getAdminRevenueSeries);

// ── Coupons (admin only) ───────────────────────────────────────────────────
adminRouter.get(    "/coupons",     requireRole("admin"), listCoupons);
adminRouter.post(   "/coupons",     requireRole("admin"), createCoupon);
adminRouter.patch(  "/coupons/:id", requireRole("admin"), updateCoupon);
adminRouter.delete( "/coupons/:id", requireRole("admin"), deleteCoupon);

// ── Reviews moderation (admin only) ──────────────────────────────────────
adminRouter.get(   "/reviews",     requireRole("admin"), listAdminReviews);
adminRouter.patch( "/reviews/:id", requireRole("admin"), moderateReview);

// ── Blog (admin only for writes) ──────────────────────────────────────────
adminRouter.get(    "/blog",     requireRole("admin", "store_manager"), adminListPosts);
adminRouter.post(   "/blog",     requireRole("admin"), adminCreatePost);
adminRouter.put(    "/blog/:id", requireRole("admin"), adminUpdatePost);
adminRouter.delete( "/blog/:id", requireRole("admin"), adminDeletePost);

// ── Customer Queries (admin + store_manager + product_manager) ────────────
adminRouter.get(
  "/queries/conversations",
  requireRole("admin", "store_manager", "product_manager"),
  adminQueriesController.getConversations
);
adminRouter.get(
  "/queries/conversations/:id",
  requireRole("admin", "store_manager", "product_manager"),
  adminQueriesController.getConversationDetail
);
adminRouter.post(
  "/queries/conversations/:id/messages",
  requireRole("admin", "store_manager", "product_manager"),
  adminQueriesController.sendAdminMessage
);
adminRouter.patch(
  "/queries/conversations/:id/read",
  requireRole("admin", "store_manager", "product_manager"),
  adminQueriesController.markAsReadByAdmin
);
adminRouter.get(
  "/queries/unread-count",
  requireRole("admin", "store_manager", "product_manager"),
  adminQueriesController.getAdminUnreadCount
);
