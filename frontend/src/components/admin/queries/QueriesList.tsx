import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Search, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { DashCard } from "@/components/dashboard/DashboardShell";
import { adminGetConversations, type ConversationWithParticipant } from "@/lib/queries-client";

/**
 * QueriesList - Admin view of all customer conversations
 * 
 * Features:
 * - Paginated list (50 per page with Load More)
 * - Polling for new conversations (backend API only)
 * - Click to view conversation detail
 * - Unread message badges
 * - Search by customer name/email
 */

export function QueriesList({ onSelectConversation }: { onSelectConversation: (id: string) => void }) {
  const [conversations, setConversations] = useState<ConversationWithParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 50;

  // Load conversations with pagination
  const loadConversations = useCallback(async (pageNum: number, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const res = await adminGetConversations({
        page: pageNum,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
      });

      if (append) {
        setConversations((prev) => [...prev, ...res.conversations]);
      } else {
        setConversations(res.conversations);
      }

      setHasMore(res.conversations.length === PAGE_SIZE);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load conversations");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  // Initial load
  useEffect(() => {
    setPage(1);
    loadConversations(1, false);
  }, [loadConversations]);

  // Polling for new conversations (every 10 seconds when on this page)
  useEffect(() => {
    const interval = setInterval(() => {
      // Silently refresh first page to check for new conversations
      loadConversations(1, false);
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadConversations(nextPage, true);
  };

  const handleSearch = () => {
    setPage(1);
    loadConversations(1, false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
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

  return (
    <div className="space-y-4">
      <DashCard>
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by customer name or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Conversations List */}
        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-text-secondary mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary">No customer queries yet</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className="w-full p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-all text-left group"
                >
                  <div className="flex items-start gap-3">
                    {/* Customer Icon */}
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>

                    {/* Conversation Details */}
                    <div className="flex-1 min-w-0">
                      {/* Customer Name/Email + Unread Badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">
                          {conv.customer_name || conv.customer_email || "Guest"}
                        </h3>
                        {conv.unread_count > 0 && (
                          <span className="bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>

                      {/* Last Message Preview */}
                      <p className="text-sm text-text-secondary line-clamp-1">
                        {conv.last_message || "No messages yet"}
                      </p>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-2">
                        <Clock className="h-3 w-3 text-text-secondary" />
                        <span className="text-xs text-text-secondary">
                          {formatTimestamp(conv.updated_at)}
                        </span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    {conv.status === "open" && (
                      <div className="flex-shrink-0">
                        <span className="inline-block h-2 w-2 rounded-full bg-success" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}

            {/* Total Count */}
            <p className="text-xs text-text-secondary mt-4">
              Showing {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </DashCard>
    </div>
  );
}
