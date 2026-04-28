"""Markets routes: create, list, get, orderbook."""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from ..core import (
    db, new_id, now_iso, serialize, serialize_list,
    generate_price_history, generate_orderbook_snapshot,
    CreateMarketBody,
)

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("")
async def list_markets(
    category: Optional[str] = None,
    live: Optional[bool] = None,
    sort: str = "volume",
    search: Optional[str] = None,
    take: int = 60,
):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if live is not None:
        query["isLive"] = live
    if search:
        query["question"] = {"$regex": search, "$options": "i"}
    sort_field = {
        "volume": [("volume", -1)],
        "ending": [("endsAt", 1)],
        "trending": [("participants", -1)],
        "newest": [("createdAt", -1)],
    }.get(sort, [("volume", -1)])
    markets = await db.markets.find(query).sort(sort_field).limit(take).to_list(take)
    return {"markets": serialize_list(markets)}


@router.post("")
async def create_market(body: CreateMarketBody, x_wallet: Optional[str] = Header(None)):
    if not x_wallet:
        x_wallet = f"demo_{new_id()[:8]}.sol"
    market_id = new_id()
    doc = {
        "id": market_id,
        "onchainId": f"heliora_{market_id[:8]}",
        "question": body.question,
        "description": body.description or "",
        "category": body.category,
        "resolution": body.resolution,
        "resolutionDetail": body.resolutionDetail or "",
        "endsAt": body.endsAt,
        "createdAt": now_iso(),
        "resolvedAt": None,
        "status": "open",
        "outcome": None,
        "yesPrice": 0.5,
        "noPrice": 0.5,
        "liquidity": body.liquiditySeed or 500,
        "volume": 0.0,
        "participants": 0,
        "isLive": body.isLive or False,
        "creator": {"wallet": x_wallet, "handle": None},
    }
    await db.markets.insert_one(doc.copy())
    pp = generate_price_history(0.5, num_points=48)
    await db.price_points.insert_many([{"id": new_id(), "marketId": market_id, **pt} for pt in pp])
    return {"market": serialize(doc)}


@router.get("/{market_id}")
async def get_market(market_id: str):
    market = await db.markets.find_one({"id": market_id})
    if not market:
        raise HTTPException(404, f"Market {market_id} not found")
    price_points = await db.price_points.find({"marketId": market_id}).sort([("ts", 1)]).to_list(300)
    recent_trades = await db.trades.find({"marketId": market_id}).sort([("createdAt", -1)]).limit(20).to_list(20)
    oracle_res = await db.oracle_resolutions.find_one({"marketId": market_id})
    mkt = serialize(market)
    mkt["pricePoints"] = serialize_list(price_points)
    mkt["oracleResolution"] = serialize(oracle_res) if oracle_res else None
    return {"market": mkt, "recentTrades": serialize_list(recent_trades)}


@router.get("/{market_id}/orderbook")
async def get_orderbook(market_id: str):
    market = await db.markets.find_one({"id": market_id})
    if not market:
        raise HTTPException(404, "Market not found")
    return generate_orderbook_snapshot(market["yesPrice"])
