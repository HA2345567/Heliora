"""Trades + Portfolio routes."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from ..core import (
    db, new_id, now_iso, serialize, serialize_list,
    PlaceTradeBody,
)

router = APIRouter(tags=["trades"])


@router.post("/trades")
async def place_trade(body: PlaceTradeBody, x_wallet: Optional[str] = Header(None)):
    if not x_wallet:
        x_wallet = f"demo_{new_id()[:8]}.sol"
    market = await db.markets.find_one({"id": body.marketId})
    if not market:
        raise HTTPException(404, "Market not found")

    side = body.side.upper()
    price = market["yesPrice"] if side == "YES" else market["noPrice"]
    cost = round(body.shares * price, 2)
    fee = round(cost * 0.01, 4)

    trade = {
        "id": new_id(),
        "marketId": body.marketId,
        "userId": x_wallet,
        "wallet": x_wallet,
        "handle": None,
        "isAgent": False,
        "side": side,
        "kind": body.kind or "market",
        "shares": body.shares,
        "price": round(price, 4),
        "cost": cost,
        "fee": fee,
        "txSig": body.txSig or f"sig_{new_id()[:12]}",
        "createdAt": now_iso(),
    }
    await db.trades.insert_one(trade.copy())

    impact = min(0.05, body.shares / max(1, market["liquidity"]) * 0.5)
    new_yes_price = market["yesPrice"]
    new_yes_price = min(0.99, new_yes_price + impact) if side == "YES" else max(0.01, new_yes_price - impact)
    await db.markets.update_one({"id": body.marketId}, {
        "$set": {"yesPrice": round(new_yes_price, 4), "noPrice": round(1 - new_yes_price, 4)},
        "$inc": {"volume": cost, "participants": 1},
    })
    await db.price_points.insert_one({
        "id": new_id(), "marketId": body.marketId,
        "yesPrice": round(new_yes_price, 4), "noPrice": round(1 - new_yes_price, 4),
        "ts": now_iso(),
    })

    existing = await db.positions.find_one({"userId": x_wallet, "marketId": body.marketId})
    if existing:
        if side == "YES":
            shares = existing["yesShares"] + body.shares
            avg = (existing["avgYesCost"] * existing["yesShares"] + price * body.shares) / shares
            await db.positions.update_one({"id": existing["id"]}, {"$set": {"yesShares": shares, "avgYesCost": round(avg, 4)}})
        else:
            shares = existing["noShares"] + body.shares
            avg = (existing["avgNoCost"] * existing["noShares"] + price * body.shares) / shares
            await db.positions.update_one({"id": existing["id"]}, {"$set": {"noShares": shares, "avgNoCost": round(avg, 4)}})
    else:
        await db.positions.insert_one({
            "id": new_id(), "userId": x_wallet, "marketId": body.marketId,
            "yesShares": body.shares if side == "YES" else 0,
            "noShares": body.shares if side == "NO" else 0,
            "avgYesCost": round(price, 4) if side == "YES" else 0,
            "avgNoCost": round(price, 4) if side == "NO" else 0,
            "realizedPnl": 0.0, "createdAt": now_iso(),
        })

    return {"trade": serialize(trade)}


@router.get("/trades/recent/{market_id}")
async def recent_trades(market_id: str):
    trades = await db.trades.find({"marketId": market_id}).sort([("createdAt", -1)]).limit(30).to_list(30)
    return {"trades": serialize_list(trades)}


@router.get("/portfolio")
async def get_portfolio(x_wallet: Optional[str] = Header(None)):
    if not x_wallet:
        return {"summary": {"openValue": 0, "unrealized": 0, "realized": 0, "positions": 0}, "positions": [], "trades": []}
    positions = await db.positions.find({"userId": x_wallet}).to_list(100)
    trades = await db.trades.find({"userId": x_wallet}).sort([("createdAt", -1)]).limit(50).to_list(50)

    enriched_positions = []
    open_value = unrealized = realized = 0.0
    for pos in positions:
        market = await db.markets.find_one({"id": pos["marketId"]})
        if not market:
            continue
        p = serialize(pos)
        p["market"] = serialize(market)
        enriched_positions.append(p)
        if pos["yesShares"] > 0:
            v = pos["yesShares"] * market["yesPrice"]
            open_value += v
            unrealized += v - pos["yesShares"] * pos["avgYesCost"]
        if pos["noShares"] > 0:
            v = pos["noShares"] * market["noPrice"]
            open_value += v
            unrealized += v - pos["noShares"] * pos["avgNoCost"]
        realized += pos.get("realizedPnl", 0)

    enriched_trades = []
    for t in trades:
        market = await db.markets.find_one({"id": t["marketId"]})
        td = serialize(t)
        if market:
            td["market"] = {"question": market["question"], "category": market["category"]}
        enriched_trades.append(td)

    return {
        "summary": {
            "openValue": round(open_value, 2),
            "unrealized": round(unrealized, 2),
            "realized": round(realized, 2),
            "positions": len(enriched_positions),
        },
        "positions": enriched_positions,
        "trades": enriched_trades,
    }
