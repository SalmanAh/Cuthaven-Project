import { useState, useEffect, useRef, FormEvent } from "react";
import { Send, X } from "lucide-react";
import { supabase, isRealtimeConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  getOrCreateConversation,
  getConversationMessages,
  sendMessage,
  markConversationAsRead,
  type Message,
  type Conversation,
} from "@/lib/queries-client";

interface CustomerChatWidgetProps {
  onClose: () => void;
  onConversationReady: (conversationId: string, unreadCount: number) => void;
  onUnreadCountChange: (count: number) => void;
}

export default function CustomerChatWidget({
  onClose,
  onConversationReady,
  onUnreadCountChange,
}: CustomerChatWidgetProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [isGuestFormVisible, setIsGuestFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user identifier
  const getUserIdentifier = () => {
    if (typeof window === "undefined") return null;

    // Check for logged-in user
    const token = localStorage.getItem("ch-access-token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return { type: "customer" as const, id: payload.sub };
      } catch {
        // Invalid token
      }
    }

    // Check for guest email
    const storedEmail = localStorage.getItem("ch-guest-email");
    const storedName = localStorage.getItem("ch-guest-name");
    if (storedEmail && storedName) {
      return { type: "guest" as const, email: storedEmail, name: storedName };
    }

    return null;
  };

  // Initialize conversation and WebSocket
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let mounted = true; // Prevent double initialization

    const initChat = async () => {
      if (!mounted) return;
      
      try {
        setIsLoading(true);
        setError(null);

        const userIdentifier = getUserIdentifier();

        // If no identifier and no guest info entered, show guest form
        if (!userIdentifier) {
          setIsGuestFormVisible(true);
          setIsLoading(false);
          return;
        }

        // Get or create conversation
        let conv: Conversation;
        if (userIdentifier.type === "customer") {
          conv = await getOrCreateConversation({ customer_id: userIdentifier.id });
        } else {
          conv = await getOrCreateConversation({
            guest_email: userIdentifier.email,
            guest_name: userIdentifier.name,
          });
        }

        if (!mounted) return;

        setConversation(conv);
        onConversationReady(conv.id, conv.unread_by_customer);

        // Fetch existing messages
        const msgs = await getConversationMessages(conv.id);
        
        if (!mounted) return;
        
        setMessages(msgs);

        // Mark as read
        if (conv.unread_by_customer > 0) {
          await markConversationAsRead(conv.id);
          onUnreadCountChange(0);
        }

        // Subscribe to new messages if Realtime is configured
        if (isRealtimeConfigured() && mounted) {
          cleanup = subscribeToMessages(conv.id);
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize chat:", err);
        if (mounted) {
          setError("Failed to load chat. Please try again.");
          setIsLoading(false);
        }
      }
    };

    initChat();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (cleanup) cleanup();
      unsubscribeFromMessages();
    };
  }, []); // Empty dependency array - only run once

  // Subscribe to new messages (conversation-specific) with polling fallback
  const subscribeToMessages = (conversationId: string): (() => void) => {
    let channel: RealtimeChannel | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let lastFetchTime: number = Date.now();
    let usePolling = false;

    // Polling fallback function
    const startPolling = () => {
      usePolling = true;
      console.log("[CustomerChat] ⏰ Starting polling (5s interval)");
      
      pollingInterval = setInterval(async () => {
        try {
          const msgs = await getConversationMessages(conversationId);
          console.log(`[CustomerChat] 📡 Polling check - Total messages: ${msgs.length}, LastFetchTime: ${new Date(lastFetchTime).toISOString()}`);
          
          // Find new messages since last check
          const newMessages = msgs.filter(m => 
            new Date(m.created_at).getTime() > lastFetchTime
          );

          if (newMessages.length > 0) {
            console.log(`[CustomerChat] ✅ Found ${newMessages.length} new message(s)`);
            lastFetchTime = Date.now();
            
            setMessages((prev) => {
              const combined = [...prev];
              newMessages.forEach(newMsg => {
                if (!combined.some(m => m.id === newMsg.id)) {
                  combined.push(newMsg);
                }
              });
              return combined.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });

            // Mark admin messages as read
            if (newMessages.some(m => m.is_admin)) {
              await markConversationAsRead(conversationId);
              onUnreadCountChange(0);
            }
          } else {
            console.log(`[CustomerChat] 📭 No new messages`);
          }
        } catch (err) {
          console.error("[CustomerChat] ❌ Polling error:", err);
        }
      }, 5000);
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const subscribe = () => {
      // Guard against duplicate subscriptions
      if (channel) {
        return;
      }

      channel = supabase
        .channel(`conversation_${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                return prev;
              }
              return [...prev, newMsg];
            });

            if (newMsg.is_admin) {
              markConversationAsRead(conversationId).catch(() => {});
              onUnreadCountChange(0);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[CustomerChat] 🔌 WebSocket status: ${status}`);
          
          // If WebSocket fails, switch to polling
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn("[CustomerChat] ⚠️ WebSocket failed, switching to polling");
            unsubscribe();
            startPolling();
          } else if (status === 'SUBSCRIBED') {
            console.log("[CustomerChat] ✅ WebSocket connected successfully");
            stopPolling();
          }
        });

      channelRef.current = channel;

      // Fallback: If not subscribed within 5 seconds, use polling
      setTimeout(() => {
        if (channel && !usePolling) {
          console.warn("[CustomerChat] ⏱️ WebSocket timeout (5s), switching to polling");
          startPolling();
        }
      }, 5000);
    };

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
        channelRef.current = null;
      }
      stopPolling();
    };

    // Initial subscription attempt
    subscribe();

    // Blur/focus management
    const handleVisibilityChange = () => {
      if (document.hidden) {
        unsubscribe();
      } else {
        subscribe();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Return cleanup function
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  };

  const unsubscribeFromMessages = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  // Handle guest form submission
  const handleGuestFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestEmail.trim()) return;

    // Store guest info
    localStorage.setItem("ch-guest-email", guestEmail);
    localStorage.setItem("ch-guest-name", guestName);

    setIsGuestFormVisible(false);
    
    // Reinitialize chat with guest info
    try {
      setIsLoading(true);
      const conv = await getOrCreateConversation({
        guest_email: guestEmail,
        guest_name: guestName,
      });

      setConversation(conv);
      onConversationReady(conv.id, conv.unread_by_customer);

      const msgs = await getConversationMessages(conv.id);
      setMessages(msgs);

      if (isRealtimeConfigured()) {
        subscribeToMessages(conv.id);
      }

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to create guest conversation:", err);
      setError("Failed to start chat. Please try again.");
      setIsLoading(false);
    }
  };

  // Handle sending message
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversation || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    // Optimistic update with temp ID
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversation.id,
      is_admin: false,
      sender_id: null,
      message: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const userIdentifier = getUserIdentifier();
      const senderId = userIdentifier?.type === "customer" ? userIdentifier.id : undefined;

      const sentMessage = await sendMessage(conversation.id, messageText, senderId);
      
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? sentMessage : m))
      );
      
      setIsSending(false);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Failed to send message. Please try again.");
      setNewMessage(messageText); // Restore message text
      setIsSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-lg bg-white shadow-2xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg bg-primary px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="font-semibold">Chat with CutHaven</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition-colors"
          aria-label="Close chat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Guest Form */}
      {isGuestFormVisible && (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Welcome!</h4>
          <p className="text-sm text-gray-600 text-center mb-6">
            Please enter your name and email to start chatting
          </p>
          <form onSubmit={handleGuestFormSubmit} className="w-full space-y-4">
            <input
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="email"
              placeholder="Your email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              Start Chat
            </button>
          </form>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !isGuestFormVisible && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-gray-600">Loading chat...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Messages */}
      {!isLoading && !isGuestFormVisible && conversation && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-gray-600">
                  Start a conversation! We're here to help.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_admin ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-2 ${
                    msg.is_admin
                      ? "bg-gray-100 text-gray-900"
                      : "bg-primary text-white"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p
                    className={`mt-1 text-xs ${
                      msg.is_admin ? "text-gray-500" : "text-white/70"
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-gray-200 p-4 flex gap-2"
          >
            <input
              type="text"
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
