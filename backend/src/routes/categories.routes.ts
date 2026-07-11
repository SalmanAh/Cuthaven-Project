import { Router } from "express";
import { listCategories } from "../controllers/categories.controller.js";

export const categoriesRouter = Router();

// Public — no auth required
categoriesRouter.get("/", listCategories);
