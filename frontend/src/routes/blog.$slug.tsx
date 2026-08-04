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
      <div className="mx-auto max-w-3xl px-3 sm:px-4 py-12 sm:py-16 space-y-3 sm:space-y-4 animate-pulse">
        <div className="h-6 sm:h-8 bg-muted rounded w-3/4" />
        <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
        <div className="h-48 sm:h-64 bg-muted rounded-xl sm:rounded-2xl" />
        {[1,2,3,4].map((i) => <div key={i} className="h-3 sm:h-4 bg-muted rounded" />)}
      </div>
    );
  }

  if (isError || !data?.post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 sm:gap-4 px-3 sm:px-4 text-center">
        <BookOpen className="h-12 w-12 sm:h-14 sm:w-14 text-text-secondary" />
        <h1 className="font-display text-xl sm:text-2xl font-bold">Post not found</h1>
        <p className="text-text-secondary text-sm sm:text-base">This article doesn't exist or has been removed.</p>
        <Link to="/blog" className="btn-primary text-sm sm:text-base min-h-[44px] inline-flex items-center">Back to Blog</Link>
      </div>
    );
  }

  const post = data.post;
  const related = (relatedData?.posts ?? []).filter((p) => p.slug !== slug).slice(0, 3);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mx-auto max-w-3xl px-3 sm:px-4 pt-6 sm:pt-8">
        <PageBreadcrumb items={[{ label: "Blog", to: "/blog" }, { label: post.title }]} />
      </div>

      {/* Hero image */}
      {post.imageUrl && (
        <div className="mx-auto max-w-3xl px-3 sm:px-4 mt-4 sm:mt-6">
          <img
            src={post.imageUrl}
            alt={post.title}
            className="w-full h-48 sm:h-64 md:h-80 object-cover rounded-xl sm:rounded-2xl"
          />
        </div>
      )}

      {/* Article */}
      <article className="mx-auto max-w-3xl px-3 sm:px-4 py-6 sm:py-8">
        {/* Category + meta */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-semibold">
            <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {post.category}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1 text-[10px] sm:text-xs text-text-secondary">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] sm:text-xs text-text-secondary">
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {post.readTime}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{post.title}</h1>

        {/* Author */}
        <p className="text-xs sm:text-sm text-text-secondary mt-2">By {post.author}</p>

        {/* Content */}
        <div className="mt-6 sm:mt-8 prose prose-lg max-w-none text-foreground leading-relaxed">
          {post.content.split("\n\n").map((para, i) => (
            <p key={i} className="mb-4 sm:mb-5 text-sm sm:text-base leading-relaxed text-foreground">
              {para.trim()}
            </p>
          ))}
        </div>

        {/* Back link */}
        <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-border">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-primary hover:text-accent transition min-h-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Back to Blog
          </Link>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="bg-muted/30 border-t border-border mt-6 sm:mt-8 py-8 sm:py-10 md:py-12">
          <div className="mx-auto max-w-7xl px-3 sm:px-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold mb-4 sm:mb-6">More from CutHaven</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="group rounded-xl sm:rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-md transition"
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-32 sm:h-40 object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <div className="p-3 sm:p-4">
                    <span className="text-[10px] sm:text-xs text-primary font-semibold">{p.category}</span>
                    <h3 className="font-semibold text-sm sm:text-base mt-1 line-clamp-2 group-hover:text-primary transition">{p.title}</h3>
                    <p className="text-[10px] sm:text-xs text-text-secondary mt-1 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> {p.readTime}
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
