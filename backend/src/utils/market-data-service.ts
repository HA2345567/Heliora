/**
 * Kalshi Market Data Service
 * Fetches real-time market data from Kalshi's public API and syncs
 * it into the local SQLite database so all agents can trade on live markets.
 */

import { prisma } from '../index';
import { newId, generatePriceHistory } from './helpers';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

// Public Kalshi API — no auth needed for market list
async function fetchKalshiMarkets(limit = 100): Promise<any[]> {
  try {
    const res = await fetch(`${KALSHI_BASE}/markets?limit=${limit}&status=open`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);
    const data = await res.json() as { markets?: any[] };
    return data.markets ?? [];
  } catch (e) {
    console.warn('[MarketDataService] Could not fetch from Kalshi:', (e as Error).message);
    return [];
  }
}

function mapKalshiCategory(category: string): string {
  const c = (category || '').toLowerCase();
  if (c.includes('crypto') || c.includes('bitcoin') || c.includes('eth') || c.includes('solana') || c.includes('binance')) return 'Crypto';
  if (c.includes('politic') || c.includes('election') || c.includes('president') || c.includes('senate') || c.includes('modi')) return 'Politics';
  if (c.includes('sport') || c.includes('nfl') || c.includes('nba') || c.includes('soccer') || c.includes('cricket') || c.includes('ipl') || c.includes('t20')) return 'Sports';
  if (c.includes('ai') || c.includes('tech') || c.includes('openai') || c.includes('nvidia')) return 'AI';
  if (c.includes('economy') || c.includes('fed') || c.includes('rate') || c.includes('inflation')) return 'Economy';
  if (c.includes('culture') || c.includes('movie') || c.includes('oscar') || c.includes('grammy')) return 'Culture';
  return 'Other'; // default
}

export async function syncKalshiMarkets(): Promise<number> {
  console.log('[MarketDataService] Syncing live Kalshi markets (High Capacity)...');
  const raw = await fetchKalshiMarkets(500);
  if (raw.length === 0) {
    console.log('[MarketDataService] No Kalshi markets returned, using fallback.');
    return 0;
  }

  let synced = 0;
  for (const m of raw) {
    try {
      // Kalshi market fields
      const ticker: string = m.ticker ?? m.market_id ?? '';
      const question: string = m.title ?? m.question ?? ticker;
      const subtitle: string = m.subtitle ?? '';
      const closeTime: string = m.close_time ?? m.expiration_time ?? '';
      const yesAsk: number = (m.yes_ask ?? m.last_price ?? 50) / 100;
      const yesBid: number = (m.yes_bid ?? m.last_price ?? 50) / 100;
      const yesPrice = Math.max(0.01, Math.min(0.99, (yesAsk + yesBid) / 2));
      const volume: number = (m.volume ?? m.volume_24h ?? 0);
      const openInterest: number = m.open_interest ?? 0;
      const status: string = m.status ?? 'open';

      if (!ticker || !question || !closeTime) continue;
      if (status !== 'open' && status !== 'active') continue;

      const endsAt = new Date(closeTime);
      if (isNaN(endsAt.getTime()) || endsAt < new Date()) continue;

      const category = mapKalshiCategory(m.category ?? m.event_category ?? '');

      // Upsert by ticker stored in resolutionDetail
      const existing = await prisma.market.findFirst({
        where: { resolutionDetail: `kalshi:${ticker}` },
      });

      if (existing) {
        // Update price and volume
        await prisma.market.update({
          where: { id: existing.id },
          data: {
            yesPrice,
            noPrice: Math.max(0.01, 1 - yesPrice),
            volume: Math.max(existing.volume, volume),
            liquidity: openInterest > 0 ? openInterest / 100 : existing.liquidity,
            isLive: true,
          },
        });
        // Add a new price point
        await prisma.pricePoint.create({
          data: {
            id: newId(),
            marketId: existing.id,
            yesPrice,
            noPrice: Math.max(0.01, 1 - yesPrice),
          },
        });
      } else {
        // Create new market from Kalshi data
        const marketId = newId();
        await prisma.market.create({
          data: {
            id: marketId,
            question: question.slice(0, 250),
            description: subtitle || `Live prediction market from Kalshi. Ticker: ${ticker}`,
            category,
            resolution: 'AIOracle',
            resolutionDetail: `kalshi:${ticker}`,
            endsAt,
            yesPrice,
            noPrice: Math.max(0.01, 1 - yesPrice),
            liquidity: openInterest > 0 ? openInterest / 100 : 1000,
            volume: volume,
            participants: Math.floor(volume / 10) + Math.floor(Math.random() * 50),
            isLive: true,
            creator: JSON.stringify({ wallet: 'kalshi_bridge.sol', handle: 'Kalshi' }),
          },
        });

        // Seed price history
        const history = generatePriceHistory(yesPrice, 48);
        await prisma.pricePoint.createMany({
          data: history.map((p) => ({
            id: newId(),
            marketId,
            yesPrice: p,
            noPrice: Math.max(0.01, 1 - p),
          })),
        });
        synced++;
      }
    } catch (e) {
      // Skip malformed markets silently
    }
  }

  console.log(`[MarketDataService] Synced ${synced} new markets. Total: ${raw.length} checked.`);
  return synced;
}

/**
 * Seed fallback markets (used when Kalshi API is unavailable)
 */
export const FALLBACK_MARKETS = [
  {
    question: 'Will Mumbai Indians (MI) win the next IPL match?',
    description: 'Resolves YES if Mumbai Indians win their upcoming match in the 2026 IPL season.',
    category: 'Sports',
    yesPrice: 0.52,
    volume: 1200000,
    participants: 9500,
    daysFromNow: 2,
  },
  {
    question: 'Will Royal Challengers Bengaluru (RCB) qualify for the IPL Playoffs?',
    description: 'Resolves YES if RCB finishes in the top 4 of the league table at the end of the regular season.',
    category: 'Sports',
    yesPrice: 0.38,
    volume: 2400000,
    participants: 18000,
    daysFromNow: 15,
  },
  {
    question: 'Will Narendra Modi win a majority in the next General Election?',
    description: 'Resolves YES if the BJP-led NDA alliance secures more than 272 seats in the Lok Sabha.',
    category: 'Politics',
    yesPrice: 0.64,
    volume: 5500000,
    participants: 45000,
    daysFromNow: 300,
  },
  {
    question: 'Will Bitcoin (BTC) exceed $100,000 before July 2026?',
    description: 'Resolves YES if BTC/USD hits $100,000 or higher on any major exchange before the close date.',
    category: 'Crypto',
    yesPrice: 0.72,
    volume: 850000,
    participants: 4200,
    daysFromNow: 60,
  },
  {
    question: 'Will Ethereum hit $5,000 by Q3 2026?',
    description: 'Resolves YES if ETH/USD spot price reaches $5,000 on Binance or Coinbase.',
    category: 'Crypto',
    yesPrice: 0.41,
    volume: 430000,
    participants: 2100,
    daysFromNow: 90,
  },
  {
    question: 'Will the Federal Reserve cut rates in June 2026?',
    description: 'Resolves YES if the FOMC announces a rate cut at their June 2026 meeting.',
    category: 'Politics',
    yesPrice: 0.58,
    volume: 1200000,
    participants: 8500,
    daysFromNow: 45,
  },
  {
    question: 'Will OpenAI release GPT-5 before September 2026?',
    description: 'Resolves YES if OpenAI officially releases a model named GPT-5 publicly before September 1, 2026.',
    category: 'AI',
    yesPrice: 0.65,
    volume: 620000,
    participants: 3800,
    daysFromNow: 120,
  },
  {
    question: 'Will Solana (SOL) reach $500 in 2026?',
    description: 'Resolves YES if SOL/USD trades at or above $500 on any major exchange.',
    category: 'Crypto',
    yesPrice: 0.34,
    volume: 310000,
    participants: 1900,
    daysFromNow: 180,
  },
  {
    question: 'Will Apple release an AI-native iPhone before 2027?',
    description: 'Resolves YES if Apple launches an iPhone product marketed with on-device AI as the primary feature.',
    category: 'AI',
    yesPrice: 0.82,
    volume: 540000,
    participants: 6100,
    daysFromNow: 200,
  },
  {
    question: 'Will Dogecoin reach $1.00 before the end of 2026?',
    description: 'Resolves YES if DOGE/USD spot price hits $1.00 on a major exchange.',
    category: 'Crypto',
    yesPrice: 0.22,
    volume: 195000,
    participants: 1400,
    daysFromNow: 240,
  },
  {
    question: 'Will SpaceX land humans on Mars before 2030?',
    description: 'Resolves YES if SpaceX successfully lands a crewed mission on Mars before January 1, 2030.',
    category: 'Social',
    yesPrice: 0.18,
    volume: 780000,
    participants: 5200,
    daysFromNow: 365,
  },
];

export async function seedFallbackMarkets(): Promise<void> {
  console.log('[MarketDataService] Seeding fallback real-time markets...');
  for (const m of FALLBACK_MARKETS) {
    const existing = await prisma.market.findFirst({ where: { question: m.question } });
    if (existing) continue;

    const marketId = newId();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + m.daysFromNow);

    await prisma.market.create({
      data: {
        id: marketId,
        question: m.question,
        description: m.description,
        category: m.category,
        resolution: 'AIOracle',
        resolutionDetail: `heliora:${marketId.slice(0, 8)}`,
        endsAt,
        yesPrice: m.yesPrice,
        noPrice: parseFloat((1 - m.yesPrice).toFixed(2)),
        liquidity: m.volume * 0.1,
        volume: m.volume,
        participants: m.participants,
        isLive: true,
        creator: JSON.stringify({ wallet: 'heliora_system.sol', handle: 'Heliora' }),
      },
    });

    // Seed price history with a realistic trend toward current price
    const history = generatePriceHistory(0.5, 100);
    // Nudge last price toward actual yesPrice
    const adjustedHistory = history.map((p, i) => {
      const blend = i / history.length;
      return p * (1 - blend) + m.yesPrice * blend;
    });

    await prisma.pricePoint.createMany({
      data: adjustedHistory.map((p) => ({
        id: newId(),
        marketId,
        yesPrice: parseFloat(Math.max(0.01, Math.min(0.99, p)).toFixed(4)),
        noPrice: parseFloat(Math.max(0.01, Math.min(0.99, 1 - p)).toFixed(4)),
      })),
    });
  }
  console.log(`[MarketDataService] Seeded ${FALLBACK_MARKETS.length} fallback markets.`);
}
