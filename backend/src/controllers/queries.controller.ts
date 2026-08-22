import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

// ─── Validation Schemas ────────────────────────────────────────────────────

const getOrCreateConversationSchema = z.object({
  customer_id: z.string().uuid().optional(),
  guest_email: z.string().email().optional(),
  guest_name: z.string().min(1).optional(),
}).refine(
  (data) => (data.customer_id && !data.guest_email && !data.guest_name) || 
            (!data.customer_id && data.guest_email && data.guest_name),
  { message: "Either customer_id or (guest_email + guest_name) must be provided" }
);

const sendMessageSchema = z.object({
  message: z.string().min(1).max(5000, "Message must be 5000 characters or less"),
  sender_id: z.string().uuid().optional(),
});

// ─── GET or CREATE Conversation ────────────────────────────────────────────
// POST /api/queries/conversations
// Body: { customer_id?: uuid, guest_email?: string, guest_name?: string }
export async function getOrCreateConversation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = getOrCreateConversationSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: parsed.error.errors 
      });
    }

    const { customer_id, guest_email, guest_name } = parsed.data;

    // Try to find existing conversation
    let query = supabaseAdmin
      .from("customer_conversations")
      .select("*");

    if (customer_id) {
      query = query.eq("customer_id", customer_id);
    } else if (guest_email) {
      query = query.eq("guest_email", guest_email);
    }

    const { data: existing, error: findError } = await query.maybeSingle();

    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    // If conversation exists, return it
    if (existing) {
      return res.json({ conversation: existing });
    }

    // Create new conversation
    const { data: newConversation, error: createError } = await supabaseAdmin
      .from("customer_conversations")
      .insert({
        customer_id: customer_id || null,
        guest_email: guest_email || null,
        guest_name: guest_name || null,
      })
      .select()
      .single();

    if (createError) throw createError;

    return res.status(201).json({ conversation: newConversation });
  } catch (error) {
    next(error);
  }
}

// ─── GET Messages for Conversation ─────────────────────────────────────────
// GET /api/queries/conversations/:id/messages
export async function getMessages(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return res.json({ messages: data || [] });
  } catch (error) {
    next(error);
  }
}

// ─── SEND Customer Message ─────────────────────────────────────────────────
// POST /api/queries/conversations/:id/messages
// Body: { message: string, sender_id?: uuid }
export async function sendCustomerMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const parsed = sendMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid message", 
        details: parsed.error.errors 
      });
    }

    const { message, sender_id } = parsed.data;

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("customer_conversations")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (convError) throw convError;
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Insert message
    const { data: newMessage, error: insertError } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: id,
        message: message.trim(),
        is_admin: false,
        sender_id: sender_id || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({ message: newMessage });
  } catch (error) {
    next(error);
  }
}

// ─── GET Unread Count (Fallback) ──────────────────────────────────────────
// GET /api/queries/unread-count?customer_id=xxx OR ?guest_email=xxx
// NOTE: This is a fallback; primary updates come via WebSocket
export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { customer_id, guest_email } = req.query;

    if (!customer_id && !guest_email) {
      return res.status(400).json({ 
        error: "Either customer_id or guest_email is required" 
      });
    }

    let query = supabaseAdmin
      .from("customer_conversations")
      .select("unread_by_customer");

    if (customer_id) {
      query = query.eq("customer_id", customer_id as string);
    } else if (guest_email) {
      query = query.eq("guest_email", guest_email as string);
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    const count = data?.unread_by_customer || 0;

    return res.json({ count });
  } catch (error) {
    next(error);
  }
}

// ─── MARK Conversation as Read (Customer) ─────────────────────────────────
// PATCH /api/queries/conversations/:id/read
export async function markAsReadByCustomer(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("customer_conversations")
      .update({ 
        unread_by_customer: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ conversation: data });
  } catch (error) {
    next(error);
  }
}
