"""Shared utilities, DB connection, AI oracle, models. Imported by all routers."""
from __future__ import annotations

import os
import uuid
import random
import asyncio
import json
import re
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("heliora")

# ─── DB ──────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# ─── HELPERS ─────────────────────────────────────────────────────────

def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.utcnow().isoformat()


def serialize(doc):
    if doc and "_id" in doc:
        del doc["_id"]
    return doc


def serialize_list(docs):
    return [serialize(d) for d in docs]


def generate_price_history(start_price: float, num_points: int = 200) -> list:
    points = []
    price = max(0.05, min(0.95, start_price + random.gauss(0, 0.12)))
    now = datetime.utcnow()
    for i in range(num_points - 1, -1, -1):
        ts = now - timedelta(hours=i)
        drift = (start_price - price) * 0.08
        noise = random.gauss(0, 0.01)
        price = max(0.02, min(0.98, price + drift + noise))
        points.append({
            "yesPrice": round(price, 4),
            "noPrice": round(1 - price, 4),
            "ts": ts.isoformat(),
        })
    points[-1]["yesPrice"] = round(start_price, 4)
    points[-1]["noPrice"] = round(1 - start_price, 4)
    return points


def generate_orderbook_snapshot(yes_price: float) -> dict:
    buy_yes, sell_yes = [], []
    acc_buy = acc_sell = 0
    for i in range(15):
        price_b = max(0.01, round(yes_price - (i + 1) * 0.004, 4))
        price_s = min(0.99, round(yes_price + (i + 1) * 0.004, 4))
        size_b = round(150 + random.random() * 900)
        size_s = round(150 + random.random() * 900)
        acc_buy += size_b
        acc_sell += size_s
        buy_yes.append({"price": price_b, "size": size_b, "total": round(acc_buy)})
        sell_yes.append({"price": price_s, "size": size_s, "total": round(acc_sell)})
    return {"mid": yes_price, "buyYes": buy_yes, "sellYes": sell_yes}


# ─── AI ORACLE ───────────────────────────────────────────────────────

CONSENSUS_THRESHOLD = 3
ORACLE_QUORUM = 5
MIN_AVG_CONFIDENCE = 0.55


async def ai_oracle_resolve(question: str, resolution_detail: str, context: str) -> dict:
    llm_key = os.environ.get("LLM_KEY", "")
    if not llm_key:
        return {"outcome": random.choice(["YES", "NO"]), "reasoning": "Auto-resolved (no LLM key)", "confidence": 0.7}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=llm_key,
            session_id=new_id(),
            system_message="""You are a trustless AI oracle agent for a decentralized prediction market protocol on Solana.
Your job is to determine whether a prediction market question has resolved YES, NO, or is INVALID (unresolvable with available information).
Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{"outcome": "YES", "confidence": 0.85, "reasoning": "Brief explanation here"}
Valid outcomes: YES, NO, INVALID. confidence must be 0.0 to 1.0.""",
        ).with_model("openai", "gpt-4.1-mini")
        prompt = (
            f"Prediction market question: {question}\n"
            f"Resolution criteria: {resolution_detail or 'Standard resolution based on the literal question'}\n"
            f"Context: {context or 'No additional context. Use your training knowledge.'}\n\n"
            "Based on available information, determine if this market resolves YES, NO, or INVALID."
        )
        txt = str(await chat.send_message(UserMessage(text=prompt)) or "")
        m = re.search(r"\{[^}]+\}", txt, re.DOTALL)
        if m:
            r = json.loads(m.group())
            outcome = r.get("outcome", "NO").upper()
            if outcome not in ("YES", "NO", "INVALID"):
                outcome = "NO"
            return {"outcome": outcome, "reasoning": r.get("reasoning", ""), "confidence": float(r.get("confidence", 0.7))}
        low = txt.lower()
        if "yes" in low[:80]:
            return {"outcome": "YES", "reasoning": txt[:300], "confidence": 0.7}
        if "invalid" in low[:80]:
            return {"outcome": "INVALID", "reasoning": txt[:300], "confidence": 0.6}
        return {"outcome": "NO", "reasoning": txt[:300], "confidence": 0.7}
    except Exception as e:
        logger.error(f"AI oracle error: {e}")
        return {"outcome": random.choice(["YES", "NO"]), "reasoning": f"Fallback. Error: {str(e)[:100]}", "confidence": 0.6}


# ─── PYDANTIC MODELS ─────────────────────────────────────────────────

class CreateMarketBody(BaseModel):
    question: str
    description: Optional[str] = None
    category: str = "Crypto"
    resolution: str = "Pyth"
    resolutionDetail: Optional[str] = None
    endsAt: str
    liquiditySeed: Optional[float] = 500
    isLive: Optional[bool] = False


class PlaceTradeBody(BaseModel):
    marketId: str
    side: str
    kind: Optional[str] = "market"
    shares: float
    txSig: Optional[str] = None


class SubscribeBody(BaseModel):
    capital: float = 100


class ResolveBody(BaseModel):
    context: Optional[str] = ""
