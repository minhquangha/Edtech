import dotenv from "dotenv";
dotenv.config();

import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import router from "@/routes/index.js";
import testDB from "@/helpers/test-db.js";
import errorHandler from "@/middlewares/errorHandler.js";
import { NotFoundError } from "@/utils/errors.js";

const app: Express = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Health check
app.get("/health", testDB);

// API router mounted at both / and /api for full compatibility with proxies and direct calls
app.use("/api", router);
app.use("/", router);

// 404 handler for unmatched routes
app.use((req: Request, _res: Response, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
});

// Centralized error handler (must be last)
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
