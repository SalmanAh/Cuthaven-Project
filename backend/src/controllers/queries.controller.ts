import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import {
  ConversationAccessError,
  hashGuestConversationToken,
  resolveConversationOwner,
  type CustomerConversationContext,
} from "../services/conversationAccess.service.js";

const createConversationSchema = z.object({
  guestName: z.string().trim().min(1).max(100).optional(),
  guestEmail: z.string().trim().email().max(254).optional(),
}).strict().refine(
  (value) => (!value.guestName && !value.guestEmail) || Boolean(value.guestName && value.guestEmail),
  { message: "Guest name and email must be provided together" },
);

const sendMessageSchema = z.object({
  message: z.string().trim().min(1).max(5000),
}).strict();

const conversationProjection =
  "id, last_message_at, unread_by_customer, created_at, updated_at";
const ownerProjection = "id, customer_id, guest_token_hash";

function guestTokenFromRequest(req: Request): string | undefined {
  const value = req.header("X-Guest-Conversation-Token");
  return value && value.length <= 256 ? value : undefined;
}

async function customerIdForAuth(authId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

function toOwnerContext(row: {
  id: string;
  customer_id: string | null;
  guest_token_hash: string | null;
} | null): CustomerConversationContext | null {
  return row ? {
    id: row.id,
    customerId: row.customer_id,
    guestTokenHash: row.guest_token_hash,
  } : null;
}

async function authorizeConversation(req: Request): Promise<CustomerConversationContext> {
  return resolveConversationOwner({
    authId: req.user?.id,
    role: req.user?.role,
    guestToken: guestTokenFromRequest(req),
  }, {
    findCustomerIdByAuthId: customerIdForAuth,
    findByCustomerId: async (customerId) => {
      const { data, error } = await supabaseAdmin
        .from("customer_conversations")
        .select(ownerProjection)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (error) throw error;
      return toOwnerContext(data);
    },
    findByGuestTokenHash: async (tokenHash) => {
      const now = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from("customer_conversations")
        .select(ownerProjection)
        .eq("guest_token_hash", tokenHash)
        .is("guest_token_revoked_at", null)
        .or(`guest_token_expires_at.is.null,guest_token_expires_at.gt.${now}`)
        .maybeSingle();
      if (error) throw error;
      return toOwnerContext(data);
    },
  });
}

function handleAccessError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof ConversationAccessError) {
    return res.status(error.status).json({ error: error.message });
  }
  return next(error);
}

async function loadMinimalConversation(conversationId: string) {
  const { data, error } = await supabaseAdmin
    .from("customer_conversations")
    .select(conversationProjection)
    .eq("id", conversationId)
    .single();
  if (error) throw error;
  return data;
}

// POST /api/queries/conversation
export async function getOrCreateConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createConversationSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid conversation request" });
    }

    if (req.user) {
      if (req.user.role !== "customer") {
        return res.status(403).json({ error: "Customer conversation access required" });
      }
      const customerId = await customerIdForAuth(req.user.id);
      if (!customerId) return res.status(403).json({ error: "Customer profile not found" });

      const { data: existing, error: findError } = await supabaseAdmin
        .from("customer_conversations")
        .select(conversationProjection)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (findError) throw findError;
      if (existing) return res.json({ conversation: existing });

      const { data, error } = await supabaseAdmin
        .from("customer_conversations")
        .insert({ customer_id: customerId })
        .select(conversationProjection)
        .single();
      if (error) {
        // A concurrent request may have won the unique customer insert.
        if (error.code === "23505") {
          const { data: raced, error: racedError } = await supabaseAdmin
            .from("customer_conversations")
            .select(conversationProjection)
            .eq("customer_id", customerId)
            .single();
          if (racedError) throw racedError;
          return res.json({ conversation: raced });
        }
        throw error;
      }
      return res.status(201).json({ conversation: data });
    }

    if (guestTokenFromRequest(req)) {
      const owner = await authorizeConversation(req);
      return res.json({ conversation: await loadMinimalConversation(owner.id) });
    }

    const { guestName, guestEmail } = parsed.data;
    if (!guestName || !guestEmail) {
      return res.status(400).json({ error: "Guest name and email are required" });
    }

    const guestToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("customer_conversations")
      .insert({
        customer_id: null,
        guest_email: guestEmail.toLowerCase(),
        guest_name: guestName,
        guest_token_hash: hashGuestConversationToken(guestToken),
        guest_token_expires_at: expiresAt,
      })
      .select(conversationProjection)
      .single();
    if (error) throw error;

    return res.status(201).json({ conversation: data, guestToken });
  } catch (error) {
    return handleAccessError(error, res, next);
  }
}

// GET /api/queries/conversation/messages
export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await authorizeConversation(req);
    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .select("id, is_admin, message, created_at")
      .eq("conversation_id", owner.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return res.json({ messages: data ?? [] });
  } catch (error) {
    return handleAccessError(error, res, next);
  }
}

// POST /api/queries/conversation/messages
export async function sendCustomerMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid message" });
    const owner = await authorizeConversation(req);

    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: owner.id,
        message: parsed.data.message,
        is_admin: false,
        sender_id: req.user?.id ?? null,
      })
      .select("id, is_admin, message, created_at")
      .single();
    if (error) throw error;
    return res.status(201).json({ message: data });
  } catch (error) {
    return handleAccessError(error, res, next);
  }
}

// GET /api/queries/conversation/unread-count
export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await authorizeConversation(req);
    const { data, error } = await supabaseAdmin
      .from("customer_conversations")
      .select("unread_by_customer")
      .eq("id", owner.id)
      .single();
    if (error) throw error;
    return res.json({ count: data.unread_by_customer ?? 0 });
  } catch (error) {
    return handleAccessError(error, res, next);
  }
}

// PATCH /api/queries/conversation/read
export async function markAsReadByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const owner = await authorizeConversation(req);
    const { data, error } = await supabaseAdmin
      .from("customer_conversations")
      .update({ unread_by_customer: 0, updated_at: new Date().toISOString() })
      .eq("id", owner.id)
      .select(conversationProjection)
      .single();
    if (error) throw error;
    return res.json({ conversation: data });
  } catch (error) {
    return handleAccessError(error, res, next);
  }
}
