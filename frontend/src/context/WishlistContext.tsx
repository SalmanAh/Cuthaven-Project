import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface WishlistContextValue {
  ids: string[];
  count: number;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("ch-wishlist") : null;
      if (stored) setIds(JSON.parse(stored));
    } catch {}
  }, []);
  useEffect(() => {
    try { if (typeof window !== "undefined") localStorage.setItem("ch-wishlist", JSON.stringify(ids)); } catch {}
  }, [ids]);

  const toggle = (id: string) => setIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  const has = (id: string) => ids.includes(id);

  return (
    <WishlistContext.Provider value={{ ids, count: ids.length, toggle, has }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
