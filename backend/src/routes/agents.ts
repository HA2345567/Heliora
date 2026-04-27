import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { attachUser, requireUser, type AuthedRequest } from "../lib/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const agents = await prisma.agent.findMany({
    orderBy: { aum: "desc" },
    include: { _count: { select: { subscriptions: true } } },
  });
  res.json({ agents });
});

router.get("/:id", async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { subscriptions: true, oracleVotes: true } } },
  });
  if (!agent) return res.status(404).json({ error: "not_found" });
  res.json({ agent });
});

router.post("/:id/subscribe", attachUser, requireUser, async (req: AuthedRequest, res) => {
  const { capital } = z.object({ capital: z.number().positive() }).parse(req.body);
  const sub = await prisma.agentSubscription.upsert({
    where: { userId_agentId: { userId: req.user!.id, agentId: req.params.id } },
    create: { userId: req.user!.id, agentId: req.params.id, capital },
    update: { capital },
  });
  res.json({ subscription: sub });
});

export default router;
