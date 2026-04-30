import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from '../index';
import { newId } from '../utils/helpers';

const MAX_CONNECTIONS_PER_MARKET = 50;
const PRICE_PERSIST_EVERY_N_TICKS = 4; // ~6s instead of 1.5s
const TICK_SLEEP_SEC = 1500; // milliseconds

const activeConnections: Map<string, WebSocket[]> = new Map();
const priceTrackers: Map<string, number> = new Map();

export function initializeWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req) => {
    const url = req.url || '';
    const marketIdMatch = url.match(/\/ws\/([^/?]+)/);

    if (!marketIdMatch) {
      ws.close(1008, 'Market ID required');
      return;
    }

    const marketId = marketIdMatch[1];
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      ws.close(1008, 'Market not found');
      return;
    }

    // Check connection cap
    const conns = activeConnections.get(marketId) || [];
    if (conns.length >= MAX_CONNECTIONS_PER_MARKET) {
      ws.close(1013, 'Connection cap exceeded');
      return;
    }

    conns.push(ws);
    activeConnections.set(marketId, conns);

    console.log(`✓ WebSocket connected for market ${marketId} (total ${conns.length})`);

    let currentPrice = market.yesPrice;
    let tick = 0;

    const priceUpdateInterval = setInterval(async () => {
      try {
        // Generate realistic price movement
        const drift = (Math.random() - 0.5) * 0.012;
        currentPrice = Math.max(0.02, Math.min(0.98, currentPrice + drift));
        const rounded = parseFloat(currentPrice.toFixed(4));

        tick++;

        // Update market document
        await prisma.market.update({
          where: { id: marketId },
          data: {
            yesPrice: rounded,
            noPrice: parseFloat((1 - rounded).toFixed(4)),
          },
        });

        // Persist price points periodically
        if (tick % PRICE_PERSIST_EVERY_N_TICKS === 0) {
          await prisma.pricePoint.create({
            data: {
              id: newId(),
              marketId,
              yesPrice: rounded,
              noPrice: parseFloat((1 - rounded).toFixed(4)),
            },
          });
        }

        // Generate orderbook snapshot
        const buyYes = [];
        const sellYes = [];
        for (let i = 1; i <= 15; i++) {
          buyYes.push({
            price: parseFloat(Math.max(0.01, rounded - (i * 0.004)).toFixed(4)),
            size: Math.round(150 + Math.random() * 900)
          });
          sellYes.push({
            price: parseFloat(Math.min(0.99, rounded + (i * 0.004)).toFixed(4)),
            size: Math.round(150 + Math.random() * 900)
          });
        }
        const orderbook = { buyYes, sellYes };

        // Broadcast to all connected clients
        const connsForMarket = activeConnections.get(marketId) || [];
        const message = JSON.stringify({
          type: 'price',
          yesPrice: rounded,
          noPrice: parseFloat((1 - rounded).toFixed(4)),
          orderbook,
          ts: new Date().toISOString(),
        });

        connsForMarket.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        });
      } catch (error) {
        console.error(`WebSocket error for market ${marketId}:`, error);
      }
    }, TICK_SLEEP_SEC);

    ws.on('close', () => {
      clearInterval(priceUpdateInterval);
      const conns = activeConnections.get(marketId) || [];
      const index = conns.indexOf(ws);
      if (index > -1) {
        conns.splice(index, 1);
      }
      if (conns.length === 0) {
        activeConnections.delete(marketId);
        priceTrackers.delete(marketId);
      }
      console.log(`✗ WebSocket disconnected for market ${marketId}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error}`);
      clearInterval(priceUpdateInterval);
    });
  });
}

export { activeConnections };
