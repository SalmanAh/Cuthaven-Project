import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "@/data/products";

export interface CartItem { product: Product; quantity: number; }

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
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("ch-cart") : null;
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);
  useEffect(() => {
    try { if (typeof window !== "undefined") localStorage.setItem("ch-cart", JSON.stringify(items)); } catch {}
  }, [items]);

  const addItem = (product: Product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + qty } : i);
      return [...prev, { product, quantity: qty }];
    });
  };
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.product.id !== id));
  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeItem(id);
    setItems((prev) => prev.map((i) => i.product.id === id ? { ...i, quantity: qty } : i));
  };
  const clear = () => setItems([]);

  const count = items.reduce((a, i) => a + i.quantity, 0);
  const subtotal = items.reduce((a, i) => a + (i.product.salePrice ?? i.product.price) * i.quantity, 0);

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
