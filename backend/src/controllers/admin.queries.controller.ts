import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

// ─── Validation Schemas ────────────────────────────────────────────────────

const sendAdminMessageSchema = z.object({
  message: z.string().min(1).max(5000, "Message must be 5000 characters or less"),
});

// ─── GET All Conversations (Paginated) ────────────────────────────────────
// GET /api/admin/queries/conversations?limit=50&offset=0&search=query
export async function getConversations(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || "";

    // Get conversations
    let query = supabaseAdmin
      .from("customer_conversations")
      .select("*", { count: "exact" })
      .order("last_message_at", { ascending: false });

    // Apply search filter if provided
    if (search) {
      query = query.or(
        `guest_name.ilike.%${search}%,guest_email.ilike.%${search}%`
      );
    }

    const { data: conversations, error, count } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    // For each conversation, fetch customer details and last message
    const conversationsWithDetails = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        // Fetch customer details if customer_id exists
        let customerName = conv.guest_name;
        let customerEmail = conv.guest_email;

        if (conv.customer_id) {
          const { data: customer } = await supabaseAdmin
            .from("customers")
            .select("first_name, last_name, email")
            .eq("id", conv.customer_id)
            .maybeSingle();

          if (customer) {
            customerName = `${customer.first_name} ${customer.last_name}`.trim();
            customerEmail = customer.email;
          }
        }

        // Fetch last message
        const { data: lastMsg } = await supabaseAdmin
          .from("conversation_messages")
          .select("message")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...conv,
          customer_name: customerName || null,
          customer_email: customerEmail || null,
          last_message: lastMsg?.message || null,
          unread_count: conv.unread_by_admin || 0,
          status: "open", // Can be enhanced with actual status field
        };
      })
    );

    return res.json({
      conversations: conversationsWithDetails,
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (error) {
    next(error);
  }
}

// ─── GET Single Conversation Detail ───────────────────────────────────────
// GET /api/admin/queries/conversations/:id
export async function getConversationDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    // Get conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("customer_conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (convError) throw convError;
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    return res.json({
      conversation,
      messages: messages || [],
    });
  } catch (error) {
    next(error);
  }
}

// ─── SEND Admin Message (Reply) ────────────────────────────────────────────
// POST /api/admin/queries/conversations/:id/messages
// Body: { message: string }
export async function sendAdminMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const parsed = sendAdminMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ 
        error: "Invalid message", 
        details: parsed.error.errors 
      });
    }

    const { message } = parsed.data;

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

    // Get admin user ID from request (set by requireAuth middleware)
    const adminUserId = req.user?.id;

    // Insert admin message
    const { data: newMessage, error: insertError } = await supabaseAdmin
      .from("conversation_messages")
      .insert({
        conversation_id: id,
        message: message.trim(),
        is_admin: true,
        sender_id: adminUserId || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({ message: newMessage });
  } catch (error) {
    next(error);
  }
}

// ─── MARK Conversation as Read (Admin) ────────────────────────────────────
// PATCH /api/admin/queries/conversations/:id/read
export async function markAsReadByAdmin(
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
        unread_by_admin: 0,
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

// ─── GET Admin Unread Count ────────────────────────────────────────────────
// GET /api/admin/queries/unread-count
export async function getAdminUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("customer_conversations")
      .select("unread_by_admin");

    if (error) throw error;

    const total = (data || []).reduce((sum, conv) => sum + (conv.unread_by_admin || 0), 0);

    return res.json({ count: total });
  } catch (error) {
    next(error);
  }
}
