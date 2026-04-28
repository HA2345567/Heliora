"""Stats: protocol summary + leaderboard."""
import random
from fastapi import APIRouter
from ..core import db

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/protocol")
async def protocol_stats():
    markets = await db.markets.count_documents({})
    open_markets = await db.markets.count_documents({"status": "open"})
    agents = await db.agents.count_documents({})
    users = await db.users.count_documents({})
    pipeline = [{"$group": {"_id": None, "totalVolume": {"$sum": "$volume"}, "totalLiquidity": {"$sum": "$liquidity"}}}]
    agg = await db.markets.aggregate(pipeline).to_list(1)
    return {
        "markets": markets,
        "openMarkets": open_markets,
        "agents": agents,
        "users": users,
        "totalVolume": agg[0]["totalVolume"] if agg else 0,
        "totalLiquidity": agg[0]["totalLiquidity"] if agg else 0,
    }


@router.get("/leaderboard")
async def leaderboard():
    users = await db.users.find().to_list(100)
    agents = await db.agents.find().to_list(100)
    entries = []
    for u in users:
        positions = await db.positions.find({"userId": u["id"]}).to_list(100)
        pnl = sum(p.get("realizedPnl", 0) for p in positions)
        for p in positions:
            market = await db.markets.find_one({"id": p["marketId"]})
            if market:
                if p["yesShares"] > 0:
                    pnl += p["yesShares"] * (market["yesPrice"] - p["avgYesCost"])
                if p["noShares"] > 0:
                    pnl += p["noShares"] * (market["noPrice"] - p["avgNoCost"])
        entries.append({
            "wallet": u["wallet"],
            "handle": u.get("handle"),
            "pnl": round(pnl + random.gauss(0, 5000), 2),
            "positions": len(positions),
        })
    for ag in agents[:4]:
        entries.append({
            "wallet": ag["wallet"], "handle": ag["handle"],
            "pnl": round(ag["aum"] * ag["pnl30d"] / 100, 2),
            "positions": ag["marketsTraded"],
        })
    entries.sort(key=lambda x: x["pnl"], reverse=True)
    return {"leaderboard": entries[:20]}
