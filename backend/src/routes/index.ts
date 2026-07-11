import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { productsRouter } from "./products.routes.js";
import { categoriesRouter } from "./categories.routes.js";
import { ordersRouter } from "./orders.routes.js";
import { customersRouter } from "./customers.routes.js";
import { checkoutRouter } from "./checkout.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/customers", customersRouter);
apiRouter.use("/checkout", checkoutRouter);
