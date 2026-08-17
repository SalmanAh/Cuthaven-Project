import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "@/data/products";
import { useAuth } from "./AuthContext";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  // Cart key is user-specific for logged-in customers, shared for guests
  const cartKey = user ? `ch-cart-${user.id}` : "ch-cart-guest";

  // Load cart from localStorage on mount AND when user changes (login/logout)
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(cartKey) : null;
      if (stored) {
        setItems(JSON.parse(stored));
      } else {
        setItems([]); // Clear cart when switching to a user with no cart
      }
    } catch {
      setItems([]);
    }
  }, [cartKey]); // Re-run when cartKey changes (user logs in/out)

  // Save cart to localStorage whenever items change
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(cartKey, JSON.stringify(items));
      }
    } catch {}
  }, [items, cartKey]);

  const addItem = (product: Product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const max = product.stockQuantity > 0 ? product.stockQuantity : 999;
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, max);
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: newQty } : i));
      }
      return [...prev, { product, quantity: Math.min(qty, max) }];
    });
  };
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.product.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeItem(id);
    setItems((prev) => prev.map((i) => (i.product.id === id ? { ...i, quantity: qty } : i)));
  };
  const clear = () => setItems([]);

  const count = items.reduce((a, i) => a + i.quantity, 0);
  const subtotal = items.reduce(
    (a, i) => a + (i.product.salePrice ?? i.product.price) * i.quantity,
    0,
  );

  return (
    <CartContext.Provider value={{ items, count, subtotal, addItem, removeItem, updateQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
