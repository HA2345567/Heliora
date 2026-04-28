"""Agents routes."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from ..core import db, new_id, now_iso, serialize, serialize_list, SubscribeBody

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
async def list_agents():
    agents = await db.agents.find().to_list(100)
    for a in agents:
        count = await db.positions.count_documents({"userId": a["id"]})
        a["_count"] = {"subscriptions": count + a.get("subscriptionCount", 0)}
    return {"agents": serialize_list(agents)}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    agent = await db.agents.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(404, "Agent not found")
    count = await db.positions.count_documents({"userId": agent_id})
    agent["_count"] = {"subscriptions": count + agent.get("subscriptionCount", 0)}
    return {"agent": serialize(agent)}


@router.post("/{agent_id}/subscribe")
async def subscribe_agent(agent_id: str, body: SubscribeBody, x_wallet: Optional[str] = Header(None)):
    agent = await db.agents.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(404, "Agent not found")
    if not x_wallet:
        x_wallet = f"demo_{new_id()[:8]}.sol"
    sub = {"id": new_id(), "agentId": agent_id, "userId": x_wallet, "capital": body.capital, "createdAt": now_iso()}
    await db.subscriptions.insert_one(sub.copy())
    await db.agents.update_one({"id": agent_id}, {"$inc": {"subscriptionCount": 1}})
    return {"subscription": serialize(sub)}
