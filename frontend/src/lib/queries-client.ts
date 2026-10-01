// Customer Queries API Client
// HTTP client for customer queries system - no Supabase direct access
import { getAccessToken } from "@/lib/auth-session";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const GUEST_TOKEN_KEY = "ch-guest-conversation-token";
const GUEST_CONVERSATION_ID_KEY = "ch-guest-conversation-id";

// ─── TypeScript Types ──────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  customer_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  last_message_at: string;
  unread_by_customer: number;
  unread_by_admin: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationWithParticipant extends Conversation {
  customer_name: string | null;
  customer_email: string | null;
  unread_count: number;
  last_message: string | null;
  status: "open" | "closed";
}

export interface Message {
  id: string;
  conversation_id: string;
  is_admin: boolean;
  sender_id: string | null;
  message: string;
  created_at: string;
}

export interface ConversationsResponse {
  conversations: ConversationWithParticipant[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ConversationDetailResponse {
  conversation: Conversation;
  messages: Message[];
}

// ─── Helper Functions ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    auth?: boolean;
    conversationAuth?: boolean;
  } = {},
): Promise<T> {
  const { method = "GET", body, auth = false, conversationAuth = false } = options;

  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (conversationAuth && typeof window !== "undefined") {
    const guestToken = localStorage.getItem(GUEST_TOKEN_KEY);
    if (guestToken) headers["X-Guest-Conversation-Token"] = guestToken;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : `Request failed with ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ─── Customer API Functions ────────────────────────────────────────────────

/**
 * Get or create a conversation for a customer or guest
 * Account identity comes from the verified session; guests provide profile fields once.
 */
export async function getOrCreateConversation(
  params: {
    guestName?: string;
    guestEmail?: string;
  } = {},
): Promise<{ conversation: Conversation; guestToken?: string }> {
  const response = await request<{ conversation: Conversation; guestToken?: string }>(
    "/queries/conversation",
    {
      method: "POST",
      body: params,
      auth: true,
      conversationAuth: true,
    },
  );
  return response;
}

export function storeGuestConversationAccess(conversationId: string, guestToken: string): void {
  localStorage.setItem(GUEST_CONVERSATION_ID_KEY, conversationId);
  localStorage.setItem(GUEST_TOKEN_KEY, guestToken);
}

export function clearGuestConversationAccess(): void {
  localStorage.removeItem(GUEST_CONVERSATION_ID_KEY);
  localStorage.removeItem(GUEST_TOKEN_KEY);
}

export function hasGuestConversationAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      localStorage.getItem(GUEST_CONVERSATION_ID_KEY) && localStorage.getItem(GUEST_TOKEN_KEY),
    )
  );
}

/**
 * Get all messages for a conversation
 */
export async function getConversationMessages(): Promise<Message[]> {
  const response = await request<{ messages: Message[] }>("/queries/conversation/messages", {
    auth: true,
    conversationAuth: true,
  });
  return response.messages;
}

/**
 * Send a customer message
 */
export async function sendMessage(message: string): Promise<Message> {
  const response = await request<{ message: Message }>("/queries/conversation/messages", {
    method: "POST",
    body: { message },
    auth: true,
    conversationAuth: true,
  });
  return response.message;
}

/**
 * Get unread count for customer (fallback - WebSocket is primary)
 */
export async function getUnreadCount(): Promise<number> {
  const response = await request<{ count: number }>("/queries/conversation/unread-count", {
    auth: true,
    conversationAuth: true,
  });
  return response.count;
}

/**
 * Mark conversation as read (customer side)
 */
export async function markConversationAsRead(): Promise<Conversation> {
  const response = await request<{ conversation: Conversation }>("/queries/conversation/read", {
    method: "PATCH",
    auth: true,
    conversationAuth: true,
  });
  return response.conversation;
}

// ─── Admin API Functions ───────────────────────────────────────────────────

/**
 * Get all conversations (admin, paginated with search)
 */
export async function adminGetConversations(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ConversationsResponse> {
  const { page = 1, limit = 50, search } = params || {};
  const offset = (page - 1) * limit;

  const queryParams = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (search) queryParams.set("search", search);

  return request<ConversationsResponse>(`/admin/queries/conversations?${queryParams.toString()}`, {
    auth: true,
  });
}

/**
 * Get conversation detail with messages (admin)
 */
export async function getAdminConversationDetail(
  conversationId: string,
): Promise<ConversationDetailResponse> {
  return request<ConversationDetailResponse>(`/admin/queries/conversations/${conversationId}`, {
    auth: true,
  });
}

/**
 * Send admin reply
 */
export async function sendAdminMessage(conversationId: string, message: string): Promise<Message> {
  const response = await request<{ message: Message }>(
    `/admin/queries/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: { message },
      auth: true,
    },
  );
  return response.message;
}

/**
 * Mark conversation as read (admin side)
 */
export async function markConversationAsReadByAdmin(conversationId: string): Promise<Conversation> {
  const response = await request<{ conversation: Conversation }>(
    `/admin/queries/conversations/${conversationId}/read`,
    {
      method: "PATCH",
      auth: true,
    },
  );
  return response.conversation;
}

/**
 * Get total unread count for admin
 */
export async function getAdminUnreadCount(): Promise<number> {
  const response = await request<{ count: number }>("/admin/queries/unread-count", { auth: true });
  return response.count;
}
