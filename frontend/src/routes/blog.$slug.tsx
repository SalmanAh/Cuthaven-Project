import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Tag, ArrowLeft, BookOpen } from "lucide-react";
import { PageBreadcrumb } from "@/components/ui/PageBreadcrumb";
import { getBlogPostBySlug, getBlogPosts } from "@/lib/api-client";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — CutHaven Blog` },
      { name: "description", content: "CutHaven blog post." },
    ],
  }),
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn:  () => getBlogPostBySlug(slug),
  });

  const { data: relatedData } = useQuery({
    queryKey: ["blog-posts-related", data?.post?.category],
    queryFn:  () => getBlogPosts({ category: data?.post?.category, limit: 3 }),
    enabled:  !!data?.post?.category,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
        <div className="h-64 bg-muted rounded-2xl" />
        {[1,2,3,4].map((i) => <div key={i} className="h-4 bg-muted rounded" />)}
      </div>
    );
  }

  if (isError || !data?.post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <BookOpen className="h-14 w-14 text-text-secondary" />
        <h1 className="font-display text-2xl font-bold">Post not found</h1>
        <p className="text-text-secondary">This article doesn't exist or has been removed.</p>
        <Link to="/blog" className="btn-primary">Back to Blog</Link>
      </div>
    );
  }

  const post = data.post;
  const related = (relatedData?.posts ?? []).filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <PageBreadcrumb items={[{ label: "Blog", to: "/blog" }, { label: post.title }]} />
      </div>

      {/* Hero image */}
      {post.imageUrl && (
        <div className="mx-auto max-w-3xl px-4 mt-6">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-64 md:h-80 object-cover rounded-2xl"
          />
        </div>
      )}

      {/* Article */}
      <article className="mx-auto max-w-3xl px-4 py-8">
        {/* Category + meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Tag className="h-3 w-3" />
            {post.category}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1 text-xs text-text-secondary">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-text-secondary">
            <Clock className="h-3.5 w-3.5" />
            {post.readTime}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>

        {/* Author */}
        <p className="text-sm text-text-secondary mt-2">By {post.author}</p>

        {/* Content */}
        <div className="mt-8 prose prose-lg max-w-none text-foreground leading-relaxed">
          {post.content.split("\n\n").map((para, i) => (
            <p key={i} className="mb-5 text-base leading-relaxed text-foreground">
              {para.trim()}
            </p>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-12 pt-8 border-t border-border">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-accent transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="bg-muted/30 border-t border-border mt-8 py-12">
          <div className="mx-auto max-w-7xl px-4">
            <h2 className="font-display text-2xl font-bold mb-6">More from CutHaven</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="group rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-md transition"
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="p-4">
                    <span className="text-xs text-primary font-semibold">{p.category}</span>
                    <h3 className="font-semibold mt-1 line-clamp-2 group-hover:text-primary transition">{p.title}</h3>
                    <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {p.readTime}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
