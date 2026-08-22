import { Router } from "express";
import * as queriesController from "../controllers/queries.controller.js";

export const queriesRouter = Router();

// ─── Public Customer Queries Routes ────────────────────────────────────────
// These endpoints are accessible without authentication (for guest users)
// RLS policies handle security at the database level

// Get or create conversation
queriesRouter.post(
  "/conversations",
  queriesController.getOrCreateConversation
);

// Get messages for a conversation
queriesRouter.get(
  "/conversations/:id/messages",
  queriesController.getMessages
);

// Send customer message
queriesRouter.post(
  "/conversations/:id/messages",
  queriesController.sendCustomerMessage
);

// Get unread count (fallback - WebSocket is primary)
queriesRouter.get(
  "/unread-count",
  queriesController.getUnreadCount
);

// Mark conversation as read (customer)
queriesRouter.patch(
  "/conversations/:id/read",
  queriesController.markAsReadByCustomer
);
