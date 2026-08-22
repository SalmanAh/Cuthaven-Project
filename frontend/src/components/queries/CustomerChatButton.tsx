import { useState, lazy, Suspense } from "react";
import { MessageCircle } from "lucide-react";

// Lazy load the full chat widget (only loads when user clicks button)
const CustomerChatWidget = lazy(() => import("./CustomerChatWidget"));

/**
 * CustomerChatButton - Lightweight floating chat button
 * Always rendered, but full widget is lazy-loaded on click
 * Badge updates via polling (no direct Supabase access)
 */
export function CustomerChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);

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
