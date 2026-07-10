import { Router } from "express";
import { listProducts, getProductBySlug } from "../controllers/products.controller.js";

export const productsRouter = Router();

productsRouter.get("/", listProducts);
productsRouter.get("/:slug", getProductBySlug);
