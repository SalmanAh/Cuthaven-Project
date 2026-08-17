import { Router } from "express";
import { listPosts, listBlogCategories, getPostBySlug } from "../controllers/blog.controller.js";
import { mediumCache } from "../middleware/cacheControl.js";

export const blogRouter = Router();

// Public - blog content changes occasionally
blogRouter.get("/",            mediumCache, listPosts);
blogRouter.get("/categories",  mediumCache, listBlogCategories);
blogRouter.get("/:slug",       mediumCache, getPostBySlug);

