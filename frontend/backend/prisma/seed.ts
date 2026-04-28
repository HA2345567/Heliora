import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedUser = await prisma.user.upsert({
    where: { wallet: "HelioraSeedWalletPubkey1111111111111111111" },
    update: {},
    create: {
      wallet: "HelioraSeedWalletPubkey1111111111111111111",
      handle: "heliora",
    },
  });

  const agentSeed = [
    { name: "Pulse", handle: "pulse.agent.sol", type: "Sentiment", desc: "Monitors X, Farcaster and Reddit firehoses." },
    { name: "Arc", handle: "arc.agent.sol", type: "Arbitrage", desc: "Cross-venue spread capture across prediction venues." },
    { name: "Anchor", handle: "anchor.agent.sol", type: "MarketMaker", desc: "Provides two-sided liquidity to thin markets." },
    { name: "Wire", handle: "wire.agent.sol", type: "NewsAlpha", desc: "Web search + reasoning loop." },
    { name: "Drift", handle: "drift.agent.sol", type: "Momentum", desc: "Identifies markets with rapidly shifting odds." },
  ] as const;

  for (const [i, a] of agentSeed.entries()) {
    await prisma.agent.upsert({
      where: { handle: a.handle },
      update: {},
      create: {
        name: a.name,
        handle: a.handle,
        wallet: `Agent${i}1111111111111111111111111111111111111`,
        type: a.type as never,
        description: a.desc,
        pnl30d: 12 + i * 8,
        winRate: 50 + i * 4,
        sharpe: 1.5 + i * 0.4,
        maxDrawdown: -(2 + i * 2),
        aum: 500_000 + i * 800_000,
        performanceFee: 10 + i * 2,
        uptime: 99.7 + i * 0.05,
        marketsTraded: 200 + i * 600,
      },
    });
  }

  const markets = [
    { q: "Will BTC close above $145,000 by end of May 2026?", c: "Crypto", r: "Pyth", days: 12 },
    { q: "Will SOL flip ETH in 24h DEX volume this week?", c: "DeFi", r: "Switchboard", days: 5 },
    { q: "Next BONK candle: will it close green in 15 min?", c: "Memes", r: "Pyth", days: 0, live: true },
    { q: "Will Mad Lads floor exceed 60 SOL by Friday?", c: "NFTs", r: "AIOracle", days: 6 },
    { q: "Will any new pump.fun token reach $50M MC this week?", c: "Memes", r: "AIOracle", days: 7 },
    { q: "Will Jupiter daily volume exceed $1B by Sunday?", c: "DeFi", r: "Switchboard", days: 4 },
    { q: "Will the next Fed meeting cut rates by 25bps?", c: "Politics", r: "AIOracle", days: 30 },
    { q: "Will GPT-6 be announced before July 1, 2026?", c: "AI", r: "AIOracle", days: 60 },
  ] as const;

  for (const m of markets) {
    await prisma.market.create({
      data: {
        question: m.q,
        category: m.c as never,
        resolution: m.r as never,
        endsAt: new Date(Date.now() + m.days * 86400_000 + 3600_000),
        liquidity: 100_000 + Math.random() * 800_000,
        volume: 50_000 + Math.random() * 4_000_000,
        yesPrice: 0.3 + Math.random() * 0.5,
        noPrice: 0,
        participants: Math.floor(100 + Math.random() * 2000),
        isLive: ("live" in m && m.live) || false,
        creatorId: seedUser.id,
      },
    });
  }

  // Normalize noPrice = 1 - yesPrice
  const all = await prisma.market.findMany();
  for (const mk of all) {
    await prisma.market.update({
      where: { id: mk.id },
      data: { noPrice: 1 - mk.yesPrice },
    });
  }

  console.log("Seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
