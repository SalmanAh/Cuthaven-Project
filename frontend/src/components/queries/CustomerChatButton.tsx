import { useState, useEffect, lazy, Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { supabase, isRealtimeConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Lazy load the full chat widget (only loads when user clicks button)
const CustomerChatWidget = lazy(() => import("./CustomerChatWidget"));

/**
 * CustomerChatButton - Lightweight floating chat button
 * Always rendered, but full widget is lazy-loaded on click
 * Badge updates via WebSocket subscription
 */
export function CustomerChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Get user identifier (customer ID or guest email)
  const getUserIdentifier = () => {
    if (typeof window === "undefined") return null;
    
    // Check for logged-in user
    const token = localStorage.getItem("ch-access-token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return { type: "customer" as const, id: payload.sub };
      } catch {
        // Invalid token, treat as guest
      }
    }
    
    // Check for guest email in localStorage
    const guestEmail = localStorage.getItem("ch-guest-email");
    if (guestEmail) {
      return { type: "guest" as const, email: guestEmail };
    }
    
    return null;
  };

  // Subscribe to badge updates (new messages from admin)
  useEffect(() => {
    if (!isRealtimeConfigured()) {
      console.warn("Supabase Realtime not configured. Badge updates disabled.");
      return;
    }

    const userIdentifier = getUserIdentifier();
    if (!userIdentifier) {
      // No user identifier yet, skip subscription
      return;
    }

    // Subscribe to new admin messages for badge updates
    const badgeChannel = supabase
      .channel("customer_messages_badge")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: "is_admin=eq.true", // Only admin messages
        },
        (payload) => {
          // Check if message is for this user's conversation
          if (conversationId && payload.new.conversation_id === conversationId) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    setChannel(badgeChannel);

    return () => {
      if (badgeChannel) {
        supabase.removeChannel(badgeChannel);
      }
    };
  }, [conversationId]);

  // Clean up when user opens widget (unread count will be handled by widget)
  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Update conversation ID when widget provides it
  const handleConversationReady = (convId: string, unread: number) => {
    setConversationId(convId);
    setUnreadCount(unread);
  };

  return (
    <>
      {/* Floating Chat Button - Always Rendered (Lightweight) */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          aria-label="Open chat"
          title="Chat with us"
        >
          <MessageCircle className="h-6 w-6" />
          
          {/* Unread Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Full Chat Widget - Lazy Loaded */}
      {isOpen && (
        <Suspense
          fallback={
            <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] items-center justify-center rounded-lg bg-white shadow-2xl">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-text-secondary">Loading chat...</p>
              </div>
            </div>
          }
        >
          <CustomerChatWidget
            onClose={handleClose}
            onConversationReady={handleConversationReady}
            onUnreadCountChange={setUnreadCount}
          />
        </Suspense>
      )}
    </>
  );
}
