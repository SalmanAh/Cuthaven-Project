import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { products } from "@/data/products";
import { blogPosts } from "@/data/blog-posts";

const BASE_URL = "";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = [
          "/", "/shop", "/about-us", "/blog", "/contact-us", "/track-your-order",
          "/cart", "/checkout", "/account/login", "/account/register",
          "/privacy-policy", "/returns-refund-policy", "/shipping-policy",
          "/billing-terms-conditions", "/terms-of-service", "/order-cancellation-policy",
        ];
        const entries = [
          ...staticPaths.map((p) => ({ path: p })),
          ...products.map((p) => ({ path: `/product/${p.slug}` })),
          ...blogPosts.map((p) => ({ path: `/blog/${p.slug}` })),
        ];
        const urls = entries.map((e) => `  <url><loc>${BASE_URL}${e.path}</loc></url>`).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
