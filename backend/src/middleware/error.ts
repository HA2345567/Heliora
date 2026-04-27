import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation_error", issues: err.flatten() });
  }
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status: number }).status) || 500;
    return res.status(status).json({ error: (err as { message?: string }).message ?? "error" });
  }
  logger.error({ err }, "unhandled");
  res.status(500).json({ error: "internal_server_error" });
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
