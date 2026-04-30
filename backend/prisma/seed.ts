import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create test agents
  const agent1 = await prisma.agent.create({
    data: {
      id: uuidv4(),
      name: 'Momentum Master',
      handle: 'momentum_bot',
      wallet: 'momentum_bot.sol',
      type: 'Momentum',
      description: 'High-frequency momentum trader focusing on crypto narrative shifts and trend breakouts.',
      status: 'live',
      aum: 125400,
      pnl30d: 15.5,
      winRate: 68,
      sharpe: 2.1,
      maxDrawdown: 12.4,
      performanceFee: 15,
      uptime: 99.9,
      marketsTraded: 420,
    },
  });

  const agent2 = await prisma.agent.create({
    data: {
      id: uuidv4(),
      name: 'Arb Sniper',
      handle: 'arbitrage_pro',
      wallet: 'arbitrage_pro.sol',
      type: 'Arbitrage',
      description: 'Cross-exchange arbitrage bot capturing price discrepancies between Kalshi and on-chain markets.',
      status: 'live',
      aum: 450000,
      pnl30d: 8.2,
      winRate: 94,
      sharpe: 4.5,
      maxDrawdown: 2.1,
      performanceFee: 20,
      uptime: 100,
      marketsTraded: 1540,
    },
  });

  const agent3 = await prisma.agent.create({
    data: {
      id: uuidv4(),
      name: 'Sentiment Signal',
      handle: 'sentiment_ai',
      wallet: 'sentiment_ai.sol',
      type: 'Sentiment',
      description: 'Scans social media and news feeds to predict market outcomes based on public sentiment shifts.',
      status: 'live',
      aum: 85000,
      pnl30d: 22.3,
      winRate: 62,
      sharpe: 1.8,
      maxDrawdown: 18.5,
      performanceFee: 10,
      uptime: 98.5,
      marketsTraded: 87,
    },
  });

  const agent4 = await prisma.agent.create({
    data: {
      id: uuidv4(),
      name: 'Liquid Maker',
      handle: 'market_maker_v2',
      wallet: 'mm_v2.sol',
      type: 'MarketMaker',
      description: 'Provides deep liquidity to new markets, earning from spreads and liquidity incentives.',
      status: 'live',
      aum: 1200000,
      pnl30d: 4.5,
      winRate: 100,
      sharpe: 5.2,
      maxDrawdown: 0.5,
      performanceFee: 5,
      uptime: 100,
      marketsTraded: 5430,
    },
  });

  console.log('✓ Created agents:', [agent1.handle, agent2.handle, agent3.handle, agent4.handle]);

  // Create test users
  const user1 = await prisma.user.create({
    data: {
      id: uuidv4(),
      wallet: 'user_wallet_1.sol',
      handle: 'trader_alice',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: uuidv4(),
      wallet: 'user_wallet_2.sol',
      handle: 'trader_bob',
    },
  });

  console.log('✓ Created users:', [user1.handle, user2.handle]);

  // Create prediction markets
  const market1 = await prisma.market.create({
    data: {
      id: uuidv4(),
      question: 'Will Bitcoin reach $100,000 by end of 2024?',
      description: 'This market resolves YES if BTC reaches $100k',
      category: 'Crypto',
      resolution: 'price_feed',
      resolutionDetail: 'BTC/USD closing price on 2024-12-31',
      endsAt: new Date('2024-12-31'),
      liquidity: 5000,
      yesPrice: 0.65,
      noPrice: 0.35,
      volume: 125000,
      participants: 342,
      isLive: true,
      creator: JSON.stringify({
        wallet: 'oracle_creator.sol',
        handle: 'market_maker',
      }),
    },
  });

  const market2 = await prisma.market.create({
    data: {
      id: uuidv4(),
      question: 'Will the S&P 500 close above 5000?',
      description: 'Market resolves YES if SPX closes above 5000 on market end date',
      category: 'Stock Market',
      resolution: 'price_feed',
      resolutionDetail: 'SPX closing price',
      endsAt: new Date('2024-06-30'),
      liquidity: 8000,
      yesPrice: 0.72,
      noPrice: 0.28,
      volume: 250000,
      participants: 456,
      isLive: true,
      creator: JSON.stringify({
        wallet: 'oracle_creator.sol',
        handle: 'market_maker',
      }),
    },
  });

  console.log('✓ Created markets:', [market1.question.slice(0, 30), market2.question.slice(0, 30)]);

  // Create sample trades
  const trade1 = await prisma.trade.create({
    data: {
      id: uuidv4(),
      marketId: market1.id,
      userId: user1.id,
      wallet: user1.wallet,
      handle: user1.handle,
      isAgent: false,
      side: 'YES',
      kind: 'market',
      shares: 100,
      price: 0.65,
      cost: 65,
      fee: 0.65,
      txSig: 'txsig_abc123',
    },
  });

  const trade2 = await prisma.trade.create({
    data: {
      id: uuidv4(),
      marketId: market2.id,
      userId: user2.id,
      wallet: user2.wallet,
      handle: user2.handle,
      isAgent: false,
      side: 'NO',
      kind: 'market',
      shares: 50,
      price: 0.28,
      cost: 14,
      fee: 0.14,
      txSig: 'txsig_def456',
    },
  });

  console.log('✓ Created sample trades');

  // Create user positions
  const position1 = await prisma.position.create({
    data: {
      id: uuidv4(),
      marketId: market1.id,
      userId: user1.id,
      yesShares: 100,
      noShares: 0,
      avgYesCost: 0.65,
      avgNoCost: 0,
      realizedPnl: 0,
    },
  });

  const position2 = await prisma.position.create({
    data: {
      id: uuidv4(),
      marketId: market2.id,
      userId: user2.id,
      yesShares: 0,
      noShares: 50,
      avgYesCost: 0,
      avgNoCost: 0.28,
      realizedPnl: 0,
    },
  });

  console.log('✓ Created user positions');

  // Create subscriptions
  await prisma.subscription.create({
    data: {
      id: uuidv4(),
      agentId: agent1.id,
      userId: user1.id,
      capital: 50000,
    },
  });

  await prisma.subscription.create({
    data: {
      id: uuidv4(),
      agentId: agent2.id,
      userId: user2.id,
      capital: 100000,
    },
  });

  console.log('✓ Created subscriptions');

  // Create oracle resolution
  await prisma.oracleResolution.create({
    data: {
      id: uuidv4(),
      marketId: market1.id,
      outcome: 'YES',
      consensus: 4,
      totalVotes: 5,
      tally: JSON.stringify({ YES: 4, NO: 1, INVALID: 0 }),
      weightedConfidence: JSON.stringify({ YES: 3.8, NO: 0.9, INVALID: 0 }),
      averageConfidence: 0.82,
      isDisputed: false,
      reasoning: 'Strong consensus from AI agents based on recent BTC price trends',
      votes: JSON.stringify([
        {
          vote: 'YES',
          confidence: 0.95,
          evidence: 'BTC showing strong upward momentum',
          agent: { id: agent1.id, handle: agent1.handle, wallet: agent1.wallet },
        },
      ]),
    },
  });

  console.log('✓ Seeded database successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
