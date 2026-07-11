import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHero } from "@/components/ui/PageHero";
import { blogPosts, getPostBySlug } from "@/data/blog-posts";

export const Route = createFileRoute("/blog/$slug")({
  head: ({ params }) => {
    const p = getPostBySlug(params.slug);
    return {
      meta: [
        { title: p ? `${p.title} — CutHaven Blog` : "Blog Post" },
        { name: "description", content: p?.excerpt ?? "" },
        { property: "og:title", content: p?.title ?? "" },
        { property: "og:description", content: p?.excerpt ?? "" },
        ...(p?.image ? [{ property: "og:image", content: p.image }] : []),
      ],
    };
  },
  loader: ({ params }): { post: ReturnType<typeof getPostBySlug> & object } => {
    const post = getPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const related = blogPosts.filter((p) => p.id !== post.id).slice(0, 3);
  return (
    <div>
      <PageHero title={post.title} crumbs={[{ label: "Blog", to: "/blog" }, { label: post.category }]} />
      <article className="mx-auto max-w-3xl px-4 py-12">
        <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-8">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-text-secondary mb-6">
          <span>{post.date}</span>
          <span>·</span>
          <span className="text-primary font-semibold">{post.category}</span>
          <span>·</span>
          <span>{post.author}</span>
          <span>·</span>
          <span>{post.readTime}</span>
        </div>
        <div className="prose max-w-none">
          <p className="text-lg text-text-secondary leading-relaxed mb-6">{post.excerpt}</p>
          <p className="leading-relaxed mb-4">{post.content}</p>
          <h2 className="font-display text-2xl font-bold mt-8 mb-3">Getting started</h2>
          <p className="leading-relaxed mb-4">Every great project starts with the right foundation. Here are our recommended steps to get moving quickly and avoid the classic beginner traps.</p>
          <h2 className="font-display text-2xl font-bold mt-8 mb-3">Key takeaways</h2>
          <ul className="list-disc pl-6 space-y-1 text-text-secondary">
            <li>Invest in quality basics before specialty gear.</li>
            <li>Maintain what you own — it lasts longer.</li>
            <li>Ask questions before you buy. We're always happy to help.</li>
          </ul>
        </div>
      </article>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="font-display text-2xl font-bold mb-6">Related posts</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {related.map((p) => (
            <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="card-surface overflow-hidden group">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-5">
                <p className="text-xs text-primary font-semibold mb-1">{p.category}</p>
                <h3 className="font-display text-lg font-bold group-hover:text-primary line-clamp-2">{p.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
