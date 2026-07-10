import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartUIProvider } from "@/context/CartUIContext";
import { UIProvider, useUI } from "@/context/UIContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CookieConsent } from "@/components/layout/CookieConsent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary font-display">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-text-secondary">The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn-primary mt-6 inline-flex">Back to home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-text-secondary">Try refreshing or head back home.</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button onClick={() => { router.invalidate(); reset(); }} className="btn-primary">Try again</button>
          <a href="/" className="btn-outline-primary">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CutHaven — Premium Outdoor & Garden Tools" },
      { name: "description", content: "Quality outdoor, garden, hand, and power tools. Free shipping on orders over $350, 40-day easy returns." },
      { property: "og:title", content: "CutHaven — Premium Outdoor & Garden Tools" },
      { property: "og:description", content: "Quality outdoor, garden, hand, and power tools. Free shipping on orders over $350, 40-day easy returns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CutHaven — Premium Outdoor & Garden Tools" },
      { name: "twitter:description", content: "Quality outdoor, garden, hand, and power tools. Free shipping on orders over $350, 40-day easy returns." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider>
        <WishlistProvider>
          <CartProvider>
            <CartUIProvider>
              <AppLayout>
                <Outlet />
              </AppLayout>
              <CartDrawer />
              <CookieRoot />
              <Toaster position="top-right" richColors />
            </CartUIProvider>
          </CartProvider>
        </WishlistProvider>
      </UIProvider>
    </QueryClientProvider>
  );
}

function CookieRoot() {
  const { cookieOpenSignal } = useUI();
  return <CookieConsent openSignal={cookieOpenSignal} />;
}
