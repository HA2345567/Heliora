import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/protocol", async (_req, res) => {
  const [marketCount, openMarkets, agentCount, totalVolumeAgg, userCount] =
    await Promise.all([
      prisma.market.count(),
      prisma.market.count({ where: { status: "open" } }),
      prisma.agent.count(),
      prisma.market.aggregate({ _sum: { volume: true, liquidity: true } }),
      prisma.user.count(),
    ]);
  res.json({
    markets: marketCount,
    openMarkets,
    agents: agentCount,
    users: userCount,
    totalVolume: totalVolumeAgg._sum.volume ?? 0,
    totalLiquidity: totalVolumeAgg._sum.liquidity ?? 0,
  });
});

router.get("/leaderboard", async (_req, res) => {
  // Top users by realized + unrealized over open positions (rough)
  const users = await prisma.user.findMany({
    take: 20,
    include: { positions: { include: { market: true } } },
  });
  const ranked = users
    .map((u) => {
      const pnl = u.positions.reduce(
        (s, p) =>
          s +
          (p.yesShares * p.market.yesPrice - p.yesShares * p.avgYesCost) +
          (p.noShares * p.market.noPrice - p.noShares * p.avgNoCost) +
          p.realizedPnl,
        0,
      );
      return { wallet: u.wallet, handle: u.handle, pnl, positions: u.positions.length };
    })
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 20);
  res.json({ leaderboard: ranked });
});

export default router;
