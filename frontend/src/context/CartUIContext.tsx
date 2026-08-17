import { createContext, useContext, useState, type ReactNode } from "react";

interface CartUIContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const CartUIContext = createContext<CartUIContextValue | null>(null);

export function CartUIProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <CartUIContext.Provider value={{ open, setOpen }}>{children}</CartUIContext.Provider>;
}

export function useCartUI() {
  const ctx = useContext(CartUIContext);
  if (!ctx) throw new Error("useCartUI must be used inside CartUIProvider");
  return ctx;
}
