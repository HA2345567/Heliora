import express, { Request, Response } from 'express';
import { prisma } from '../index';
import { newId } from '../utils/helpers';

const router = express.Router();

interface PlaceTradeBody {
  marketId: string;
  side: 'YES' | 'NO';
  shares: number;
  kind?: 'market' | 'limit';
  txSig?: string;
}

// Place a trade (buy YES/NO shares and update prices)
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as PlaceTradeBody;
    const xWallet = (req.headers['x-wallet'] as string) || `demo_${newId().slice(0, 8)}.sol`;

    const market = await prisma.market.findUnique({
      where: { id: body.marketId },
    });

    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }

    if (!body.shares || body.shares <= 0) {
      res.status(400).json({ error: 'shares must be greater than 0' });
      return;
    }

    if (!['YES', 'NO'].includes(body.side.toUpperCase())) {
      res.status(400).json({ error: 'side must be YES or NO' });
      return;
    }

    const side = body.side.toUpperCase();
    const price = side === 'YES' ? market.yesPrice : market.noPrice;
    const cost = parseFloat((body.shares * price).toFixed(2));
    const fee = parseFloat((cost * 0.01).toFixed(4));

    // Create trade record
    const trade = await prisma.trade.create({
      data: {
        id: newId(),
        marketId: body.marketId,
        userId: xWallet,
        wallet: xWallet,
        isAgent: false,
        side,
        kind: body.kind || 'market',
        shares: body.shares,
        price: parseFloat(price.toFixed(4)),
        cost,
        fee,
        txSig: body.txSig || `sig_${newId().slice(0, 12)}`,
      },
    });

    // Calculate price impact
    const impact = Math.min(0.05, (body.shares / Math.max(1, market.liquidity)) * 0.5);
    let newYesPrice = market.yesPrice;
    if (side === 'YES') {
      newYesPrice = Math.min(0.99, newYesPrice + impact);
    } else {
      newYesPrice = Math.max(0.01, newYesPrice - impact);
    }
    const newNoPrice = 1 - newYesPrice;

    // Update market prices and stats
    await prisma.market.update({
      where: { id: body.marketId },
      data: {
        yesPrice: parseFloat(newYesPrice.toFixed(4)),
        noPrice: parseFloat(newNoPrice.toFixed(4)),
        volume: market.volume + cost,
        participants: market.participants + 1,
      },
    });

    // Record price point
    await prisma.pricePoint.create({
      data: {
        id: newId(),
        marketId: body.marketId,
        yesPrice: parseFloat(newYesPrice.toFixed(4)),
        noPrice: parseFloat(newNoPrice.toFixed(4)),
      },
    });

    // Update or create position
    const existingPosition = await prisma.position.findUnique({
      where: {
        marketId_userId: {
          marketId: body.marketId,
          userId: xWallet,
        },
      },
    });

    if (existingPosition) {
      if (side === 'YES') {
        const newShares = existingPosition.yesShares + body.shares;
        const avgCost = parseFloat(
          (
            (existingPosition.avgYesCost * existingPosition.yesShares + price * body.shares) /
            newShares
          ).toFixed(4)
        );
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            yesShares: newShares,
            avgYesCost: avgCost,
          },
        });
      } else {
        const newShares = existingPosition.noShares + body.shares;
        const avgCost = parseFloat(
          (
            (existingPosition.avgNoCost * existingPosition.noShares + price * body.shares) /
            newShares
          ).toFixed(4)
        );
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            noShares: newShares,
            avgNoCost: avgCost,
          },
        });
      }
    } else {
      await prisma.position.create({
        data: {
          id: newId(),
          marketId: body.marketId,
          userId: xWallet,
          yesShares: side === 'YES' ? body.shares : 0,
          noShares: side === 'NO' ? body.shares : 0,
          avgYesCost: side === 'YES' ? parseFloat(price.toFixed(4)) : 0,
          avgNoCost: side === 'NO' ? parseFloat(price.toFixed(4)) : 0,
        },
      });
    }

    res.status(201).json({ trade });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to place trade' });
    return;
  }
});

// Get recent trades for a market
router.get('/market/:marketId', async (req: Request, res: Response) => {
  try {
    const trades = await prisma.trade.findMany({
      where: { marketId: req.params.marketId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    res.json({ trades });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

// Get portfolio for user
router.get('/portfolio', async (req: Request, res: Response): Promise<void> => {
  try {
    const xWallet = (req.headers['x-wallet'] as string) || `demo_${newId().slice(0, 8)}.sol`;

    if (!xWallet || xWallet.startsWith('demo_')) {
      res.json({
        summary: { openValue: 0, unrealized: 0, realized: 0, positions: 0 },
        positions: [],
        trades: [],
      });
      return;
    }

    const positions = await prisma.position.findMany({
      where: { userId: xWallet },
      include: { market: true },
    });

    const trades = await prisma.trade.findMany({
      where: { userId: xWallet },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let openValue = 0;
    let unrealized = 0;
    const realized = positions.reduce((sum, p) => sum + p.realizedPnl, 0);

    const enrichedPositions = positions.map((pos) => {
      if (pos.yesShares > 0) {
        const v = pos.yesShares * pos.market.yesPrice;
        openValue += v;
        unrealized += v - pos.yesShares * pos.avgYesCost;
      }
      if (pos.noShares > 0) {
        const v = pos.noShares * pos.market.noPrice;
        openValue += v;
        unrealized += v - pos.noShares * pos.avgNoCost;
      }
      return {
        ...pos,
        market: {
          question: pos.market.question,
          category: pos.market.category,
        },
      };
    });

    const enrichedTrades = trades.map((t) => ({
      ...t,
      market: { question: 'N/A', category: 'N/A' },
    }));

    res.json({
      summary: {
        openValue: parseFloat(openValue.toFixed(2)),
        unrealized: parseFloat(unrealized.toFixed(2)),
        realized: parseFloat(realized.toFixed(2)),
        positions: enrichedPositions.length,
      },
      positions: enrichedPositions,
      trades: enrichedTrades,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
    return;
  }
});

export default router;
