import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(
  cors({
    origin: env.FRONTEND_ORIGIN, // only the frontend's own dev/prod URL can call this API
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api", apiRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`cuthaven backend running on http://localhost:${env.PORT}`);
});
