import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DashCard } from "@/components/dashboard/DashboardShell";
import {
  getAdminConversationDetail,
  sendAdminMessage,
  markConversationAsReadByAdmin,
  type Message,
  type Conversation,
} from "@/lib/queries-client";

/**
 * ConversationDetail - Admin view of a single conversation
 * 
 * Features:
 * - Display all messages in conversation
 * - Polling for new messages (backend API only)
 * - Send admin replies
 * - Mark conversation as read
 * - Auto-scroll to bottom on new messages
 */

export function ConversationDetail({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(Date.now());

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }
  }, []);

  // Load conversation and messages
  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminConversationDetail(conversationId);
      setConversation(res.conversation);
      setMessages(res.messages);
      
      // Mark as read by admin
      await markConversationAsReadByAdmin(conversationId);
      
      // Scroll to bottom after loading
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [conversationId, scrollToBottom]);

  // Initial load
  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Polling-only for new messages (backend API only)
  useEffect(() => {
    let mounted = true;

    const startPolling = () => {
      if (!mounted) return;

      pollingIntervalRef.current = setInterval(async () => {
        if (!mounted) return;
        
        try {
          const res = await getAdminConversationDetail(conversationId);
          
          // Find messages newer than last fetch
          const newMessages = res.messages.filter(m => 
            new Date(m.created_at).getTime() > lastFetchTimeRef.current
          );

          if (newMessages.length > 0) {
            lastFetchTimeRef.current = Date.now();
            
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
            setTimeout(scrollToBottom, 100);
          }
        } catch (err) {
          // Silently handle polling errors
        }
      }, 5000); // Poll every 5 seconds
    };

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    // Start polling immediately
    startPolling();

    // Cleanup on unmount or conversationId change
    return () => {
      mounted = false;
      stopPolling();
    };
  }, [conversationId, scrollToBottom]);

  // Send admin reply
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim()) return;
    
    try {
      setSending(true);
      
      // Optimistic update
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        is_admin: true,
        sender_id: null, // Admin doesn't have sender_id (handled by backend)
        message: messageText,
        created_at: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, tempMessage]);
      setMessageText("");
      
      // Send to backend
      const sentMessage = await sendAdminMessage(conversationId, messageText);
      
      // Replace optimistic message with real one
      setMessages((prev) => 
        prev.map((m) => (m.id === tempMessage.id ? sentMessage : m))
      );
      
      // Scroll to bottom
      setTimeout(scrollToBottom, 100);
      
      // Focus textarea
      textareaRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send message");
      
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <DashCard>
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </DashCard>
    );
  }

  if (!conversation) {
    return (
      <DashCard>
        <p className="text-center py-12 text-text-secondary">Conversation not found</p>
      </DashCard>
    );
  }

  const customerName =
    conversation.guest_name ||
    conversation.guest_email ||
    "Customer";

  return (
    <div className="space-y-4">
      {/* Header */}
      <DashCard>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-muted rounded-lg transition"
            aria-label="Back to list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg truncate">{customerName}</h2>
            {conversation.guest_email && (
              <p className="text-sm text-text-secondary truncate">
                {conversation.guest_email}
              </p>
            )}
          </div>
        </div>
      </DashCard>

      {/* Messages */}
      <DashCard>
        <div className="flex flex-col h-[500px]">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-text-secondary">
                No messages yet
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.is_admin
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.is_admin
                          ? "text-primary-foreground/70"
                          : "text-text-secondary"
                      }`}
                    >
                      {formatTime(msg.created_at)}
                      {msg.is_admin && " · You"}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder="Type your reply..."
              rows={2}
              disabled={sending}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </DashCard>
    </div>
  );
}
