import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { attachUser, requireUser, type AuthedRequest } from "../lib/auth.js";

const router = Router();

router.get("/", attachUser, requireUser, async (req: AuthedRequest, res) => {
  const positions = await prisma.position.findMany({
    where: { userId: req.user!.id },
    include: { market: true },
    orderBy: { updatedAt: "desc" },
  });
  const trades = await prisma.trade.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { market: { select: { question: true, category: true } } },
  });

  let openValue = 0;
  let unrealized = 0;
  for (const p of positions) {
    const yesVal = p.yesShares * p.market.yesPrice;
    const noVal = p.noShares * p.market.noPrice;
    openValue += yesVal + noVal;
    unrealized +=
      yesVal - p.yesShares * p.avgYesCost + (noVal - p.noShares * p.avgNoCost);
  }
  res.json({
    summary: {
      openValue,
      unrealized,
      realized: positions.reduce((s, p) => s + p.realizedPnl, 0),
      positions: positions.length,
    },
    positions,
    trades,
  });
});

export default router;
