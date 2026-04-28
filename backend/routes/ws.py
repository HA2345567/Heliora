"""WebSocket: live price + orderbook stream with rate-limit + connection cap."""
import asyncio
import random
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..core import (
    db, new_id, now_iso, generate_orderbook_snapshot, logger,
)

router = APIRouter()

# limits
MAX_CONNECTIONS_PER_MARKET = 50
PRICE_PERSIST_EVERY_N_TICKS = 4   # only persist every 4th tick → ~6s instead of 1.5s
TICK_SLEEP_SEC = 1.5

active_connections: dict[str, list[WebSocket]] = {}


@router.websocket("/ws/{market_id}")
async def ws_market(websocket: WebSocket, market_id: str):
    await websocket.accept()
    conns = active_connections.setdefault(market_id, [])
    if len(conns) >= MAX_CONNECTIONS_PER_MARKET:
        await websocket.close(code=1013, reason="Connection cap exceeded")
        return
    conns.append(websocket)
    logger.info(f"WebSocket connected for market {market_id} (total {len(conns)})")
    try:
        market = await db.markets.find_one({"id": market_id})
        if not market:
            await websocket.close(code=1008, reason="Market not found")
            return
        current_price = market["yesPrice"]
        tick = 0
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
            except Exception:
                break

            drift = random.gauss(0, 0.006)
            current_price = max(0.02, min(0.98, current_price + drift))
            rounded = round(current_price, 4)
            tick += 1

            # Always update market doc (cheap).
            await db.markets.update_one({"id": market_id}, {
                "$set": {"yesPrice": rounded, "noPrice": round(1 - rounded, 4)},
            })
            # Throttle expensive price_points inserts.
            if tick % PRICE_PERSIST_EVERY_N_TICKS == 0:
                await db.price_points.insert_one({
                    "id": new_id(), "marketId": market_id,
                    "yesPrice": rounded, "noPrice": round(1 - rounded, 4),
                    "ts": now_iso(),
                })

            ob = generate_orderbook_snapshot(rounded)
            await websocket.send_json({
                "type": "price",
                "yesPrice": rounded,
                "noPrice": round(1 - rounded, 4),
                "orderbook": ob,
                "ts": now_iso(),
            })
            await asyncio.sleep(TICK_SLEEP_SEC)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for market {market_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if market_id in active_connections and websocket in active_connections[market_id]:
            active_connections[market_id].remove(websocket)
