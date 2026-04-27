import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveWithGemini } from "../lib/gemini.js";
import { HttpError } from "../middleware/error.js";

const router = Router();

router.get("/recent", async (_req, res) => {
  const resolutions = await prisma.oracleResolution.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { market: true, votes: { include: { agent: true } } },
  });
  res.json({ resolutions });
});

/**
 * Trigger an AI-Oracle resolution for a market. In production this would
 * be invoked by a scheduler when endsAt passes; the endpoint exists for
 * manual / admin use during testing.
 */
router.post("/resolve/:marketId", async (req, res) => {
  const { context } = z
    .object({ context: z.string().min(1).max(8000) })
    .parse(req.body);

  const market = await prisma.market.findUnique({ where: { id: req.params.marketId } });
  if (!market) throw new HttpError(404, "market_not_found");
  if (market.status === "resolved") throw new HttpError(400, "already_resolved");

  // Pick 5 live oracle agents (any agents marked live for this scaffold).
  const agents = await prisma.agent.findMany({
    where: { status: "live" },
    take: 5,
    orderBy: { aum: "desc" },
  });
  if (agents.length < 3) throw new HttpError(400, "insufficient_oracles");

  const personas = ["Sentiment", "Arbitrage", "MarketMaker", "NewsAlpha", "Momentum"];
  const verdicts = await Promise.all(
    agents.map((a, i) =>
      resolveWithGemini(market.question, context, personas[i % personas.length]).catch(() => ({
        outcome: "INVALID" as const,
        confidence: 0,
        reasoning: "agent_error",
      })),
    ),
  );

  const tally: Record<"YES" | "NO" | "INVALID", number> = { YES: 0, NO: 0, INVALID: 0 };
  for (const v of verdicts) tally[v.outcome] += 1;
  const outcome = (Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]) as
    | "YES" | "NO" | "INVALID";
  const consensus = tally[outcome];

  const result = await prisma.$transaction(async (tx) => {
    const resolution = await tx.oracleResolution.create({
      data: {
        marketId: market.id,
        outcome,
        consensus,
        totalVotes: verdicts.length,
        reasoning: verdicts.map((v) => `• ${v.reasoning}`).join("\n").slice(0, 4000),
        votes: {
          create: agents.map((a, i) => ({
            agentId: a.id,
            vote: verdicts[i].outcome,
            confidence: verdicts[i].confidence,
            evidence: verdicts[i].reasoning.slice(0, 1000),
          })),
        },
      },
      include: { votes: true },
    });
    await tx.market.update({
      where: { id: market.id },
      data: { status: "resolved", outcome, resolvedAt: new Date() },
    });
    return resolution;
  });

  res.json({ resolution: result });
});

export default router;
