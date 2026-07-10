import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { blogPosts } from "@/data/blog-posts";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — CutHaven" },
      { name: "description", content: "Gardening tips, tool maintenance, and DIY project guides from the CutHaven team." },
      { property: "og:title", content: "CutHaven Blog" },
      { property: "og:description", content: "Guides, tips, and how-tos from our team." },
    ],
  }),
  component: BlogListPage,
});

const cats = ["All", "Gardening Tips", "Tool Maintenance", "DIY Projects", "Outdoor Living"];

function BlogListPage() {
  const [cat, setCat] = useState("All");
  const filtered = cat === "All" ? blogPosts : blogPosts.filter((p) => p.category === cat);
  return (
    <div>
      <PageHero title="Our Blog" subtitle="Tips, tricks, and stories from the workshop." crumbs={[{ label: "Blog" }]} />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${cat === c ? "bg-primary text-primary-foreground" : "bg-surface border border-border hover:border-primary"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((post) => (
            <Link key={post.id} to="/blog/$slug" params={{ slug: post.slug }} className="card-surface overflow-hidden group">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 text-xs text-text-secondary mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{post.category}</span>
                  <span>{post.date}</span>
                </div>
                <h3 className="font-display text-lg font-bold group-hover:text-primary line-clamp-2">{post.title}</h3>
                <p className="mt-2 text-sm text-text-secondary line-clamp-2">{post.excerpt}</p>
                <p className="mt-3 text-sm font-semibold text-primary">Read More →</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
