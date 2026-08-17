import { Router } from "express";
import { listCategories } from "../controllers/categories.controller.js";
import { mediumCache } from "../middleware/cacheControl.js";

export const categoriesRouter = Router();

// Public — no auth required
// Categories change rarely, can cache for longer
categoriesRouter.get("/", mediumCache, listCategories);

