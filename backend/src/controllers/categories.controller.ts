import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { toPublicCategory, type Category } from "../types/category.js";

// GET /api/categories
// Returns all active categories with a live product count each.
export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    // Fetch all active categories
    const { data: cats, error: catsError } = await supabaseAdmin
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (catsError) throw catsError;
    if (!cats || cats.length === 0) return res.json({ categories: [] });

    // Count active products per category in one query
    const { data: counts, error: countError } = await supabaseAdmin
      .from("products")
      .select("category_id")
      .eq("is_active", true);

    if (countError) throw countError;

    const countMap: Record<string, number> = {};
    (counts ?? []).forEach((p: { category_id: string | null }) => {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] ?? 0) + 1;
      }
    });

    const categories = (cats as Category[]).map((c) =>
      toPublicCategory(c, countMap[c.id] ?? 0),
    );

    return res.json({ categories });
  } catch (err) {
    next(err);
  }
}
