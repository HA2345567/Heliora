import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { attachUser, requireUser, type AuthedRequest } from "../lib/auth.js";
import { priceYes } from "../lib/lmsr.js";
import { HttpError } from "../middleware/error.js";

const router = Router();

const CategoryEnum = z.enum([
  "Crypto", "Politics", "Sports", "Memes", "NFTs", "DeFi", "Social", "AI",
]);
const ResolutionEnum = z.enum(["Pyth", "Switchboard", "AIOracle", "DAOVote"]);

router.get("/", async (req, res) => {
  const q = z
    .object({
      category: CategoryEnum.optional(),
      status: z.enum(["open", "resolving", "resolved", "disputed"]).optional(),
      live: z.coerce.boolean().optional(),
      sort: z.enum(["volume", "ending", "trending", "newest"]).default("volume"),
      search: z.string().optional(),
      take: z.coerce.number().min(1).max(100).default(48),
    })
    .parse(req.query);

  const orderBy =
    q.sort === "volume"
      ? { volume: "desc" as const }
      : q.sort === "ending"
        ? { endsAt: "asc" as const }
        : q.sort === "newest"
          ? { createdAt: "desc" as const }
          : { volume: "desc" as const };

  const markets = await prisma.market.findMany({
    where: {
      ...(q.category && { category: q.category }),
      ...(q.status && { status: q.status }),
      ...(q.live && { isLive: true }),
      ...(q.search && { question: { contains: q.search, mode: "insensitive" } }),
    },
    orderBy,
    take: q.take,
    include: { creator: { select: { wallet: true, handle: true } } },
  });
  res.json({ markets });
});

router.get("/:id", async (req, res) => {
  const market = await prisma.market.findUnique({
    where: { id: req.params.id },
    include: {
      creator: { select: { wallet: true, handle: true } },
      pricePoints: { orderBy: { ts: "asc" }, take: 240 },
      oracleResolution: { include: { votes: { include: { agent: true } } } },
    },
  });
  if (!market) throw new HttpError(404, "market_not_found");
  const recentTrades = await prisma.trade.findMany({
    where: { marketId: market.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { wallet: true, handle: true } } },
  });
  res.json({ market, recentTrades });
});

router.post("/", attachUser, requireUser, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      question: z.string().min(8).max(280),
      description: z.string().max(2000).optional(),
      category: CategoryEnum,
      resolution: ResolutionEnum,
      resolutionDetail: z.string().max(500).optional(),
      endsAt: z.string().datetime(),
      liquiditySeed: z.number().min(10).max(1_000_000).default(500),
      isLive: z.boolean().default(false),
    })
    .parse(req.body);

  const market = await prisma.market.create({
    data: {
      question: body.question,
      description: body.description,
      category: body.category,
      resolution: body.resolution,
      resolutionDetail: body.resolutionDetail,
      endsAt: new Date(body.endsAt),
      isLive: body.isLive,
      liquidity: body.liquiditySeed,
      yesPrice: 0.5,
      noPrice: 0.5,
      creatorId: req.user!.id,
    },
  });
  await prisma.pricePoint.create({
    data: { marketId: market.id, yesPrice: 0.5, noPrice: 0.5 },
  });
  res.status(201).json({ market });
});

router.get("/:id/orderbook", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) throw new HttpError(404, "market_not_found");

  // Synthesize a depth ladder around the AMM mid using LMSR liquidity b.
  const b = Math.max(50, market.liquidity / 4);
  const state = { qYes: 0, qNo: 0, b };
  const mid = priceYes(state); // 0.5 baseline; real impl reconstructs from trades
  const levels = 10;
  const buyYes = Array.from({ length: levels }, (_, i) => ({
    price: Math.max(0.01, mid - (i + 1) * 0.005),
    size: Math.round(40 + Math.random() * 200),
  }));
  const sellYes = Array.from({ length: levels }, (_, i) => ({
    price: Math.min(0.99, mid + (i + 1) * 0.005),
    size: Math.round(40 + Math.random() * 200),
  }));
  res.json({ mid, buyYes, sellYes });
});

export default router;
