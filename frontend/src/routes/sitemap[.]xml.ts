import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Static paths that never change
const STATIC_PATHS = [
  { path: "/",                          changefreq: "daily",   priority: "1.0" },
  { path: "/shop",                      changefreq: "daily",   priority: "0.9" },
  { path: "/about-us",                  changefreq: "monthly", priority: "0.5" },
  { path: "/blog",                      changefreq: "weekly",  priority: "0.6" },
  { path: "/contact-us",                changefreq: "monthly", priority: "0.5" },
  { path: "/track-your-order",          changefreq: "monthly", priority: "0.4" },
  { path: "/privacy-policy",            changefreq: "yearly",  priority: "0.3" },
  { path: "/returns-refund-policy",     changefreq: "yearly",  priority: "0.4" },
  { path: "/shipping-policy",           changefreq: "yearly",  priority: "0.4" },
  { path: "/billing-terms-conditions",  changefreq: "yearly",  priority: "0.3" },
  { path: "/terms-of-service",          changefreq: "yearly",  priority: "0.3" },
  { path: "/order-cancellation-policy", changefreq: "yearly",  priority: "0.3" },
];

const API_URL = process.env["VITE_API_URL"] ?? "http://localhost:4000/api";
const STORE_URL = process.env["VITE_STORE_URL"] ?? "https://www.cuthaven.com";

function urlEntry(
  loc: string,
  opts: { changefreq?: string; priority?: string; lastmod?: string } = {},
): string {
  const lastmod = opts.lastmod
    ? `\n    <lastmod>${opts.lastmod}</lastmod>`
    : "";
  const changefreq = opts.changefreq
    ? `\n    <changefreq>${opts.changefreq}</changefreq>`
    : "";
  const priority = opts.priority
    ? `\n    <priority>${opts.priority}</priority>`
    : "";
  return `  <url>\n    <loc>${loc}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().slice(0, 10);

        // ── Fetch live product slugs ──────────────────────────────────────
        let productSlugs: string[] = [];
        try {
          const res = await fetch(`${API_URL}/products`);
          if (res.ok) {
            const data = (await res.json()) as {
              products: Array<{ slug: string }>;
            };
            productSlugs = (data.products ?? []).map((p) => p.slug);
          }
        } catch {
          // Backend unavailable during build — sitemap still generates with static paths
          console.warn("[sitemap] Could not fetch products from API — skipping dynamic product URLs");
        }

        // ── Fetch live category slugs ─────────────────────────────────────
        let categorySlugs: string[] = [];
        try {
          const res = await fetch(`${API_URL}/categories`);
          if (res.ok) {
            const data = (await res.json()) as {
              categories: Array<{ slug: string }>;
            };
            categorySlugs = (data.categories ?? []).map((c) => c.slug);
          }
        } catch {
          console.warn("[sitemap] Could not fetch categories from API — skipping dynamic category URLs");
        }

        // ── Build URL entries ─────────────────────────────────────────────
        const entries: string[] = [
          // Static pages
          ...STATIC_PATHS.map((p) =>
            urlEntry(`${STORE_URL}${p.path}`, {
              changefreq: p.changefreq,
              priority: p.priority,
              lastmod: today,
            }),
          ),

          // Dynamic product PDPs — high priority, weekly changefreq
          ...productSlugs.map((slug) =>
            urlEntry(`${STORE_URL}/product/${slug}`, {
              changefreq: "weekly",
              priority: "0.8",
              lastmod: today,
            }),
          ),

          // Category filtered shop pages (if you add /shop?category=slug later)
          // For now points to /shop — still signals the category exists
          ...categorySlugs.map((slug) =>
            urlEntry(`${STORE_URL}/shop?category=${slug}`, {
              changefreq: "daily",
              priority: "0.7",
              lastmod: today,
            }),
          ),
        ];

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset`,
          `  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`,
          `  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...entries,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
            "X-Sitemap-Products": String(productSlugs.length),
            "X-Sitemap-Categories": String(categorySlugs.length),
          },
        });
      },
    },
  },
});
