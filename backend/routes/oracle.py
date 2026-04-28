"""Oracle: 5-agent AI consensus resolution."""
import asyncio
import random
from fastapi import APIRouter, HTTPException
from ..core import (
    db, new_id, now_iso, serialize, serialize_list,
    ai_oracle_resolve, ResolveBody,
    CONSENSUS_THRESHOLD, ORACLE_QUORUM, MIN_AVG_CONFIDENCE,
)

router = APIRouter(prefix="/oracle", tags=["oracle"])


@router.get("/recent")
async def recent_resolutions():
    resolutions = await db.oracle_resolutions.find().sort([("createdAt", -1)]).limit(20).to_list(20)
    return {"resolutions": serialize_list(resolutions)}


@router.post("/resolve/{market_id}")
async def resolve_market(market_id: str, body: ResolveBody):
    market = await db.markets.find_one({"id": market_id})
    if not market:
        raise HTTPException(404, "Market not found")
    if market.get("status") == "resolved":
        raise HTTPException(400, "Market already resolved")

    all_agents = await db.agents.find({"status": "live"}).to_list(100)
    if len(all_agents) < ORACLE_QUORUM:
        all_agents = await db.agents.find().to_list(100)
    if not all_agents:
        raise HTTPException(400, "No oracle agents available")
    oracle_agents = random.sample(all_agents, min(ORACLE_QUORUM, len(all_agents)))

    coros = [ai_oracle_resolve(market["question"], market.get("resolutionDetail", ""), body.context or "") for _ in oracle_agents]
    results = await asyncio.gather(*coros, return_exceptions=True)

    votes = []
    for agent, result in zip(oracle_agents, results):
        if isinstance(result, Exception):
            result = {"outcome": "INVALID", "confidence": 0.3, "reasoning": f"Agent error: {type(result).__name__}"}
        votes.append({
            "id": new_id(),
            "vote": result["outcome"],
            "confidence": result["confidence"],
            "evidence": result["reasoning"],
            "agent": {k: v for k, v in serialize(agent).items() if k != "_id"},
        })

    tally_count = {"YES": 0, "NO": 0, "INVALID": 0}
    tally_conf = {"YES": 0.0, "NO": 0.0, "INVALID": 0.0}
    for v in votes:
        tally_count[v["vote"]] = tally_count.get(v["vote"], 0) + 1
        tally_conf[v["vote"]] = tally_conf.get(v["vote"], 0.0) + float(v["confidence"])

    outcome = max(tally_count, key=tally_count.get)
    consensus = tally_count[outcome]
    avg_conf = tally_conf[outcome] / consensus if consensus > 0 else 0.0
    overall_avg = sum(float(v["confidence"]) for v in votes) / max(1, len(votes))
    is_disputed = consensus < CONSENSUS_THRESHOLD or overall_avg < MIN_AVG_CONFIDENCE
    final_outcome = outcome if not is_disputed else "DISPUTED"
    final_status = "disputed" if is_disputed else "resolved"

    reasoning = (
        f"AI oracle consensus: {consensus}/{len(votes)} agents voted {outcome} "
        f"(avg confidence {avg_conf:.0%}, overall {overall_avg:.0%}). "
        f"{'Below threshold — flagged disputed.' if is_disputed else 'Resolved on-chain.'}"
    )

    resolution = {
        "id": new_id(),
        "marketId": market_id,
        "outcome": final_outcome,
        "consensus": consensus,
        "totalVotes": len(votes),
        "tally": tally_count,
        "weightedConfidence": {k: round(v, 3) for k, v in tally_conf.items()},
        "averageConfidence": round(overall_avg, 3),
        "consensusThreshold": CONSENSUS_THRESHOLD,
        "isDisputed": is_disputed,
        "reasoning": reasoning,
        "createdAt": now_iso(),
        "market": serialize(market),
        "votes": votes,
    }
    await db.oracle_resolutions.insert_one({k: v for k, v in resolution.items()})
    update = {"status": final_status}
    if not is_disputed:
        update["outcome"] = outcome
        update["resolvedAt"] = now_iso()
    await db.markets.update_one({"id": market_id}, {"$set": update})
    resolution.pop("_id", None)
    return {"resolution": resolution}
