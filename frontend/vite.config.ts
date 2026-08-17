// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      // Optimize chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Split vendor code for better caching
            if (id.includes("node_modules")) {
              // Core React and routing libraries - change rarely
              if (id.includes("react") || id.includes("react-dom")) {
                return "vendor-react";
              }
              if (id.includes("@tanstack/react-router") || id.includes("@tanstack/react-query")) {
                return "vendor-tanstack";
              }
              // UI components - Radix UI
              if (id.includes("@radix-ui")) {
                return "vendor-radix";
              }
              // Icons and notifications
              if (id.includes("lucide-react") || id.includes("sonner")) {
                return "vendor-ui";
              }
              // Charts library - often used on specific pages
              if (id.includes("recharts")) {
                return "vendor-charts";
              }
              // Payment gateways - lazy load these
              if (id.includes("@stripe") || id.includes("@paypal")) {
                return "vendor-payment";
              }
              // Other vendors
              return "vendor";
            }
          },
        },
      },
      // Minification uses default Vite minifier
      // Source maps for production debugging
      sourcemap: false, // Disable to reduce bundle size
      // Reduce chunk size warnings
      chunkSizeWarningLimit: 1000,
      // CSS code splitting
      cssCodeSplit: true,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
      exclude: ["@stripe/react-stripe-js", "@paypal/react-paypal-js"],
    },
    // Enable CSS optimization
    css: {
      devSourcemap: false,
    },
  },
});
