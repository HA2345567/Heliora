import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/error.js";
import marketsRouter from "./routes/markets.js";
import tradesRouter from "./routes/trades.js";
import portfolioRouter from "./routes/portfolio.js";
import agentsRouter from "./routes/agents.js";
import oracleRouter from "./routes/oracle.js";
import statsRouter from "./routes/stats.js";
import authRouter from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

const origins = (process.env.CORS_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim());

app.use(helmet());
app.use(
  cors({
    origin: origins.includes("*") ? true : origins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/markets", marketsRouter);
app.use("/api/trades", tradesRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/oracle", oracleRouter);
app.use("/api/stats", statsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Heliora API listening on :${PORT}`);
});
