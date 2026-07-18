import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  imageUrl: string | null;
  readTime: string;
  isPublished: boolean;
  publishedAt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPublicPost(row: Record<string, unknown>): BlogPost {
  return {
    id:              row.id as string,
    slug:            row.slug as string,
    title:           row.title as string,
    excerpt:         row.excerpt as string,
    content:         row.content as string,
    category:        row.category as string,
    author:          row.author as string,
    imageUrl:        (row.image_url as string | null) ?? null,
    readTime:        (row.read_time as string) ?? "5 min read",
    isPublished:     row.is_published as boolean,
    publishedAt:     (row.published_at as string | null) ?? null,
    metaTitle:       (row.meta_title as string | null) ?? null,
    metaDescription: (row.meta_description as string | null) ?? null,
    createdAt:       row.created_at as string,
    updatedAt:       row.updated_at as string,
  };
}

const blogWriteSchema = z.object({
  slug:            z.string().min(2).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens"),
  title:           z.string().min(1),
  excerpt:         z.string().min(1).max(500),
  content:         z.string().min(1),
  category:        z.string().min(1).default("General"),
  author:          z.string().min(1).default("CutHaven Team"),
  imageUrl:        z.string().url().nullable().optional(),
  readTime:        z.string().default("5 min read"),
  isPublished:     z.boolean().default(false),
  publishedAt:     z.string().datetime().nullable().optional(),
  metaTitle:       z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
});

// ─── GET /api/blog ─────────────────────────────────────────────────────────
// Public — published posts only, newest first.
export async function listPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, limit = "20", page = "1" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("blog_posts")
      .select("id, slug, title, excerpt, category, author, image_url, read_time, published_at, created_at, updated_at", { count: "exact" })
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (category) query = query.eq("category", category);

    const { data, error, count } = await query;
    if (error) throw error;

    // Return posts without full content on the list view (saves bandwidth)
    const posts = (data ?? []).map((p) => toPublicPost({ ...p as Record<string, unknown>, content: "", is_published: true }));
    return res.json({ posts, total: count ?? posts.length, page: pageNum, limit: limitNum });
  } catch (err) { next(err); }
}

// ─── GET /api/blog/categories ─────────────────────────────────────────────
// Public — distinct categories with post counts.
export async function listBlogCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("category")
      .eq("is_published", true);

    if (error) throw error;

    const counts: Record<string, number> = {};
    (data ?? []).forEach((p: { category: string }) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });

    const categories = Object.entries(counts).map(([name, count]) => ({ name, count }));
    return res.json({ categories });
  } catch (err) { next(err); }
}

// ─── GET /api/blog/:slug ──────────────────────────────────────────────────
// Public — single post with full content.
export async function getPostBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Post not found" });

    return res.json({ post: toPublicPost(data as Record<string, unknown>) });
  } catch (err) { next(err); }
}

// ─── GET /api/admin/blog ──────────────────────────────────────────────────
// Admin — all posts including drafts.
export async function adminListPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json({ posts: (data ?? []).map((p) => toPublicPost(p as Record<string, unknown>)) });
  } catch (err) { next(err); }
}

// ─── POST /api/admin/blog ─────────────────────────────────────────────────
export async function adminCreatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = blogWriteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const d = parsed.data;

    const { data: existing } = await supabaseAdmin
      .from("blog_posts").select("id").eq("slug", d.slug).maybeSingle();
    if (existing) return res.status(409).json({ error: "A post with this slug already exists" });

    const now = new Date().toISOString();
    const publishedAt = d.isPublished
      ? (d.publishedAt ?? now)
      : null;

    const { data, error } = await supabaseAdmin
      .from("blog_posts")
      .insert({
        slug: d.slug, title: d.title, excerpt: d.excerpt, content: d.content,
        category: d.category, author: d.author, image_url: d.imageUrl ?? null,
        read_time: d.readTime, is_published: d.isPublished, published_at: publishedAt,
        meta_title: d.metaTitle ?? null, meta_description: d.metaDescription ?? null,
        created_at: now, updated_at: now,
      })
      .select("*").single();

    if (error) throw error;
    return res.status(201).json({ post: toPublicPost(data as Record<string, unknown>) });
  } catch (err) { next(err); }
}

// ─── PUT /api/admin/blog/:id ──────────────────────────────────────────────
export async function adminUpdatePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = blogWriteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    const d = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (d.slug !== undefined)            patch.slug = d.slug;
    if (d.title !== undefined)           patch.title = d.title;
    if (d.excerpt !== undefined)         patch.excerpt = d.excerpt;
    if (d.content !== undefined)         patch.content = d.content;
    if (d.category !== undefined)        patch.category = d.category;
    if (d.author !== undefined)          patch.author = d.author;
    if (d.imageUrl !== undefined)        patch.image_url = d.imageUrl;
    if (d.readTime !== undefined)        patch.read_time = d.readTime;
    if (d.metaTitle !== undefined)       patch.meta_title = d.metaTitle;
    if (d.metaDescription !== undefined) patch.meta_description = d.metaDescription;
    if (d.isPublished !== undefined) {
      patch.is_published = d.isPublished;
      if (d.isPublished && !d.publishedAt) patch.published_at = new Date().toISOString();
    }
    if (d.publishedAt !== undefined)     patch.published_at = d.publishedAt;

    const { data, error } = await supabaseAdmin
      .from("blog_posts").update(patch).eq("id", id).select("*").maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Post not found" });
    return res.json({ post: toPublicPost(data as Record<string, unknown>) });
  } catch (err) { next(err); }
}

// ─── DELETE /api/admin/blog/:id ───────────────────────────────────────────
export async function adminDeletePost(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    return res.json({ message: "Post deleted" });
  } catch (err) { next(err); }
}
