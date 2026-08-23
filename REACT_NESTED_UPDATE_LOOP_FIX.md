# React Nested Update Loop - Critical Bug Fix

## 🔴 CRITICAL ISSUE FOUND

**Error Message:**
```
Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.
```

**Impact:** Can crash the entire application by causing infinite re-renders

---

## 📍 ROOT CAUSE IDENTIFIED

**File:** `frontend/src/components/queries/CustomerChatWidget.tsx`

**Problem Location:** Line 76-128 (useEffect initialization)

### The Issue:

The `CustomerChatWidget` component has a **useEffect with EMPTY dependency array** `[]` that runs on mount, BUT the cleanup function calls `stopPolling()` which triggers on EVERY re-render due to how React handles effects.

**Critical Code:**
```typescript
// Initialize conversation and start polling
useEffect(() => {
  let mounted = true;

  const initChat = async () => {
    // ... initialization code ...
    
    // This starts a 5-second polling interval
    startPolling(conv.id);
    
    setIsLoading(false);  // ⚠️ This triggers re-render
  };

  initChat();

  return () => {
    mounted = false;
    stopPolling();  // ⚠️ PROBLEM: This cleanup runs on EVERY re-render
  };
}, []); // Empty dependency array - should run once, but cleanup causes loop
```

### Why This Causes Infinite Loop:

1. **Component mounts** → `useEffect` runs → `initChat()` called
2. **`setIsLoading(false)`** called → Component re-renders
3. **Cleanup function runs** → `stopPolling()` clears interval
4. **`setMessages()` called** (from polling or state updates) → Component re-renders again
5. **Cleanup runs again** → `stopPolling()` called again
6. **Multiple state updates** (`setConversation`, `setMessages`, `setIsLoading`) chain together
7. **React detects nested updates exceeding limit** → Shows error

### Additional Contributing Factors:

**Polling Function (Line 136-174):**
```typescript
const startPolling = (conversationId: string) => {
  if (pollingIntervalRef.current) return; // Already polling

  pollingIntervalRef.current = setInterval(async () => {
    try {
      const msgs = await getConversationMessages(conversationId);
      
      // This setState inside interval can trigger re-renders
      setMessages((prev) => {
        const combined = [...prev];
        newMessages.forEach(newMsg => {
          if (!combined.some(m => m.id === newMsg.id)) {
            combined.push(newMsg);
          }
        });
        return combined.sort(...);  // ⚠️ Creates new array every time
      });
      
      // Another setState
      await markConversationAsRead(conversationId);
      onUnreadCountChange(0);  // ⚠️ Calls parent setState
      
    } catch (err) {
      // Silently handle
    }
  }, 5000); // Runs every 5 seconds
};
```

**Problems:**
- Every 5 seconds, polling triggers `setMessages()` → re-render
- `onUnreadCountChange(0)` calls parent component setState → re-render cascade
- Multiple async operations racing with state updates
- Array sorting creates new reference even if content identical → unnecessary re-renders

---

## 🔧 THE FIX

### Solution 1: Prevent Cleanup from Running on Every Render (RECOMMENDED)

**File to Fix:** `frontend/src/components/queries/CustomerChatWidget.tsx`

**Change the useEffect initialization (Lines 76-128):**

```typescript
// Initialize conversation and start polling
useEffect(() => {
  let mounted = true;
  let localPollingRef: NodeJS.Timeout | null = null;

  const initChat = async () => {
    if (!mounted) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const userIdentifier = getUserIdentifier();

      if (!userIdentifier) {
        setIsGuestFormVisible(true);
        setIsLoading(false);
        return;
      }

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

      const msgs = await getConversationMessages(conv.id);
      
      if (!mounted) return;
      
      setMessages(msgs);

      if (conv.unread_by_customer > 0) {
        await markConversationAsRead(conv.id);
        onUnreadCountChange(0);
      }

      // Start polling with local ref (prevents race conditions)
      localPollingRef = setInterval(async () => {
        if (!mounted) return;
        
        try {
          const msgs = await getConversationMessages(conv.id);
          const newMessages = msgs.filter(m => 
            new Date(m.created_at).getTime() > lastFetchTimeRef.current
          );

          if (newMessages.length > 0 && mounted) {
            lastFetchTimeRef.current = Date.now();
            
            setMessages((prev) => {
              const existingIds = new Set(prev.map(m => m.id));
              const toAdd = newMessages.filter(m => !existingIds.has(m.id));
              
              if (toAdd.length === 0) return prev; // ⭐ Prevent unnecessary re-render
              
              return [...prev, ...toAdd].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });

            if (newMessages.some(m => m.is_admin)) {
              await markConversationAsRead(conv.id);
              onUnreadCountChange(0);
            }
          }
        } catch (err) {
          // Silently handle polling errors
        }
      }, 5000);

      pollingIntervalRef.current = localPollingRef;
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

  // Cleanup only runs on unmount
  return () => {
    mounted = false;
    if (localPollingRef) {
      clearInterval(localPollingRef);
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
}, []); // Empty array is fine now - cleanup won't cause loop
```

### Solution 2: Remove Separate startPolling/stopPolling Functions

**Delete these functions (Lines 136-184):**
```typescript
// ❌ DELETE - No longer needed
const startPolling = (conversationId: string) => { ... }
const stopPolling = () => { ... }
```

The polling logic is now directly in the useEffect, preventing the cleanup race condition.

### Solution 3: Optimize setState Calls

**In handleSendMessage (Lines 221-261), prevent double updates:**

```typescript
const handleSendMessage = async (e: FormEvent) => {
  e.preventDefault();
  if (!newMessage.trim() || !conversation || isSending) return;

  const messageText = newMessage.trim();
  setNewMessage("");
  setIsSending(true);

  const tempId = `temp-${Date.now()}`;
  const optimisticMessage: Message = {
    id: tempId,
    conversation_id: conversation.id,
    is_admin: false,
    sender_id: null,
    message: messageText,
    created_at: new Date().toISOString(),
  };
  
  // Use functional update to prevent race condition
  setMessages((prev) => [...prev, optimisticMessage]);

  try {
    const userIdentifier = getUserIdentifier();
    const senderId = userIdentifier?.type === "customer" ? userIdentifier.id : undefined;

    const sentMessage = await sendMessage(conversation.id, messageText, senderId);
    
    // Replace optimistic with real message
    setMessages((prev) => {
      const filtered = prev.filter((m) => m.id !== tempId);
      return [...filtered, sentMessage].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
    
    setIsSending(false);
  } catch (err) {
    console.error("Failed to send message:", err);
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
    setError("Failed to send message. Please try again.");
    setNewMessage(messageText);
    setIsSending(false);
  }
};
```

---

## 🎯 SUMMARY

### What Was Wrong:
1. **useEffect cleanup function** running on every re-render instead of just unmount
2. **Polling interval** triggering setState every 5 seconds → cascading re-renders
3. **Multiple async state updates** racing with each other
4. **Array creation** on every setState call even when no changes

### What Needs to Be Fixed:
1. ✅ Move polling logic inside useEffect to prevent cleanup race
2. ✅ Use local polling ref to prevent external function interference
3. ✅ Add early return in setState if no actual changes (prevents unnecessary re-renders)
4. ✅ Remove separate `startPolling`/`stopPolling` functions

### Files to Modify:
- **`frontend/src/components/queries/CustomerChatWidget.tsx`** (Lines 76-184)

### Expected Result After Fix:
- ✅ No more "Maximum update depth exceeded" error
- ✅ Chat widget works without infinite loops
- ✅ Polling continues every 5 seconds without causing re-render storms
- ✅ Application stability restored

---

## 📊 OTHER CONSOLE ERRORS (Lower Priority)

### 1. Service Worker 500 Error
**Status:** Medium Priority
**Cause:** Service worker registration failing (likely PWA-related)
**Fix:** Check `/public/sw.js` or disable service worker registration

### 2. Invalid dangerouslySetInnerHTML
**Status:** Low Priority (False alarm - code is correct)
**Files:** Already checked, usage is valid:
- `frontend/src/components/ui/chart.tsx` (Line 73)
- `frontend/src/routes/shop.tsx` (Line 142)
- `frontend/src/routes/index.tsx` (Lines 143, 147)
- `frontend/src/routes/product.$slug.tsx` (Lines 214, 218)

All instances are for JSON-LD structured data, which is correct usage.

### 3. Missing Key Props
**Status:** Low Priority
**Cause:** Lists without unique keys in map functions
**Impact:** Minor performance issues, not causing crashes
**Fix:** Add unique `key={item.id}` to all `.map()` returns

---

## ⚠️ RECOMMENDATION

**Fix the CustomerChatWidget infinite loop FIRST** - this is the critical bug causing app instability. The other errors are cosmetic or low-impact.

Once this is fixed, the React nested update error should disappear completely.
