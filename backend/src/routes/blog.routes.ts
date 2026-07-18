import { Router } from "express";
import { listPosts, listBlogCategories, getPostBySlug } from "../controllers/blog.controller.js";

export const blogRouter = Router();

// Public
blogRouter.get("/",            listPosts);
blogRouter.get("/categories",  listBlogCategories);
blogRouter.get("/:slug",       getPostBySlug);
