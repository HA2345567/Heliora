import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifySolanaSignature } from "../lib/auth.js";
import { HttpError } from "../middleware/error.js";

const router = Router();

router.post("/nonce", async (req, res) => {
  const { wallet } = z.object({ wallet: z.string().min(32) }).parse(req.body);
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // In production, persist nonce w/ TTL (Redis). For scaffold: stateless echo.
  const message = `Heliora login: ${wallet}:${nonce}`;
  res.json({ message, nonce });
});

router.post("/verify", async (req, res) => {
  const { wallet, message, signature } = z
    .object({
      wallet: z.string().min(32),
      message: z.string().min(8),
      signature: z.string().min(8),
    })
    .parse(req.body);
  if (!message.startsWith(`Heliora login: ${wallet}:`)) {
    throw new HttpError(400, "bad_message");
  }
  if (!verifySolanaSignature(wallet, message, signature)) {
    throw new HttpError(401, "bad_signature");
  }
  const user = await prisma.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet },
  });
  res.json({ user });
});

router.post("/handle", async (req, res) => {
  const { wallet, handle } = z
    .object({ wallet: z.string().min(32), handle: z.string().min(2).max(32) })
    .parse(req.body);
  const user = await prisma.user.update({ where: { wallet }, data: { handle } });
  res.json({ user });
});

export default router;
