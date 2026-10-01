import { Router } from "express";
import * as queriesController from "../controllers/queries.controller.js";
import { optionalAuth } from "../middleware/requireAuth.js";
import {
  conversationCreateLimiter,
  conversationMessageLimiter,
} from "../middleware/rateLimiter.js";

export const queriesRouter = Router();

queriesRouter.use(optionalAuth);
queriesRouter.post(
  "/conversation",
  conversationCreateLimiter,
  queriesController.getOrCreateConversation,
);
queriesRouter.get("/conversation/messages", queriesController.getMessages);
queriesRouter.post(
  "/conversation/messages",
  conversationMessageLimiter,
  queriesController.sendCustomerMessage,
);
queriesRouter.get("/conversation/unread-count", queriesController.getUnreadCount);
queriesRouter.patch("/conversation/read", queriesController.markAsReadByCustomer);
