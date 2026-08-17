import { Router } from "express";
import { listProducts, getProductBySlug } from "../controllers/products.controller.js";
import { shortCache } from "../middleware/cacheControl.js";

export const productsRouter = Router();

// Product list updates frequently (new products, stock changes)
productsRouter.get("/", shortCache, listProducts);

// Individual products change less frequently
productsRouter.get("/:slug", shortCache, getProductBySlug);
