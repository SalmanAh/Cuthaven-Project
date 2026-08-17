import { createContext, useContext, useState, type ReactNode } from "react";

interface UIContextValue {
  cookieOpenSignal: number;
  openCookiePrefs: () => void;
}
const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [cookieOpenSignal, setSignal] = useState(0);
  return (
    <UIContext.Provider
      value={{ cookieOpenSignal, openCookiePrefs: () => setSignal((n) => n + 1) }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
