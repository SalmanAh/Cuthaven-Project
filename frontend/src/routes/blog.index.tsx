import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Tag, ArrowRight, BookOpen } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { getBlogPosts, getBlogCategories } from "@/lib/api-client";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — CutHaven" },
      { name: "description", content: "Tips, guides and tool advice from the CutHaven team." },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: catData } = useQuery({
    queryKey: ["blog-categories"],
    queryFn:  getBlogCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["blog-posts", activeCategory],
    queryFn:  () => getBlogPosts({
      category: activeCategory !== "All" ? activeCategory : undefined,
      limit: 20,
    }),
  });

  const posts    = data?.posts ?? [];
  const categories = ["All", ...(catData?.categories?.map((c) => c.name) ?? [])];

  return (
    <div>
      <PageHero
        title="The CutHaven Blog"
        subtitle="Tips, guides and tool advice from the field."
      />

      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary/10 text-foreground"
              }`}
            >
              {cat}
              {cat !== "All" && catData?.categories && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({catData.categories.find((c) => c.name === cat)?.count ?? 0})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-surface animate-pulse">
                <div className="h-48 bg-muted rounded-t-2xl" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center">
            <BookOpen className="h-14 w-14 text-text-secondary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold">No posts yet</h2>
            <p className="text-text-secondary mt-2">Check back soon — new content is on its way.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="group rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden bg-muted">
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <BookOpen className="h-10 w-10 text-text-secondary" />
                    </div>
                  )}
                  {/* Category badge */}
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 text-xs font-semibold text-primary">
                    <Tag className="h-3 w-3" />
                    {post.category}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h2 className="font-display font-bold text-lg leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  <p className="text-sm text-text-secondary mt-2 line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center gap-4 mt-4 text-xs text-text-secondary">
                    {post.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {post.readTime}
                    </span>
                  </div>

                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                    Read article <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
