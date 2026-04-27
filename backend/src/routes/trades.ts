import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { attachUser, requireUser, type AuthedRequest } from "../lib/auth.js";
import { applyTrade, avgFillPrice, priceYes } from "../lib/lmsr.js";
import { HttpError } from "../middleware/error.js";

const router = Router();

router.post("/", attachUser, requireUser, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      marketId: z.string(),
      side: z.enum(["YES", "NO"]),
      kind: z.enum(["market", "limit", "stop"]).default("market"),
      shares: z.number().positive().max(1_000_000),
      txSig: z.string().optional(),
    })
    .parse(req.body);

  const trade = await prisma.$transaction(async (tx) => {
    const market = await tx.market.findUnique({ where: { id: body.marketId } });
    if (!market) throw new HttpError(404, "market_not_found");
    if (market.status !== "open") throw new HttpError(400, "market_closed");

    const b = Math.max(50, market.liquidity / 4);
    const state = { qYes: 0, qNo: 0, b }; // demo state; in prod reconstruct from trades
    const fill = avgFillPrice(state, body.side, body.shares);
    const cost = fill * body.shares;
    const next = applyTrade(state, body.side, body.shares);
    const newYesPrice = priceYes(next);

    const created = await tx.trade.create({
      data: {
        marketId: market.id,
        userId: req.user!.id,
        side: body.side,
        kind: body.kind,
        shares: body.shares,
        price: fill,
        cost,
        txSig: body.txSig,
      },
    });

    await tx.market.update({
      where: { id: market.id },
      data: {
        yesPrice: newYesPrice,
        noPrice: 1 - newYesPrice,
        volume: { increment: cost },
      },
    });

    await tx.pricePoint.create({
      data: { marketId: market.id, yesPrice: newYesPrice, noPrice: 1 - newYesPrice },
    });

    await tx.position.upsert({
      where: { marketId_userId: { marketId: market.id, userId: req.user!.id } },
      create: {
        marketId: market.id,
        userId: req.user!.id,
        yesShares: body.side === "YES" ? body.shares : 0,
        noShares: body.side === "NO" ? body.shares : 0,
        avgYesCost: body.side === "YES" ? fill : 0,
        avgNoCost: body.side === "NO" ? fill : 0,
      },
      update: {
        ...(body.side === "YES"
          ? { yesShares: { increment: body.shares } }
          : { noShares: { increment: body.shares } }),
      },
    });

    return created;
  });

  res.status(201).json({ trade });
});

router.get("/recent/:marketId", async (req, res) => {
  const trades = await prisma.trade.findMany({
    where: { marketId: req.params.marketId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { wallet: true, handle: true } } },
  });
  res.json({ trades });
});

export default router;
