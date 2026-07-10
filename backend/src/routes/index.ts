import { Router } from "express";
import { productsRouter } from "./products.routes.js";

export const apiRouter = Router();

apiRouter.use("/products", productsRouter);

// Next up as the backend grows (see backend/README.md for the full list):
// apiRouter.use("/categories", categoriesRouter);
// apiRouter.use("/orders", ordersRouter);
// apiRouter.use("/auth", authRouter);
// apiRouter.use("/checkout", checkoutRouter);
