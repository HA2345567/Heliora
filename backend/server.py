from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, uuid, random, math, asyncio, json, re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from pathlib import Path
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── DB ───────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Heliora API")
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── HELPERS ──────────────────────────────────────────────────────────

def new_id(): return str(uuid.uuid4())

def now_iso(): return datetime.utcnow().isoformat()

def serialize(doc):
    """Remove MongoDB _id field"""
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

def serialize_list(docs):
    return [serialize(d) for d in docs]

def generate_price_history(start_price: float, num_points: int = 200) -> list:
    """Generate realistic price history using mean-reverting random walk."""
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
            "ts": ts.isoformat()
        })
    # Ensure last point matches the market's actual price
    points[-1]["yesPrice"] = round(start_price, 4)
    points[-1]["noPrice"] = round(1 - start_price, 4)
    return points

def generate_orderbook_snapshot(yes_price: float) -> dict:
    """Generate a realistic order book snapshot."""
    buy_yes, sell_yes = [], []
    acc_buy, acc_sell = 0, 0
    for i in range(15):
        price_b = round(yes_price - (i + 1) * 0.004, 4)
        price_s = round(yes_price + (i + 1) * 0.004, 4)
        if price_b < 0.01: price_b = 0.01
        if price_s > 0.99: price_s = 0.99
        size_b = round(150 + random.random() * 900)
        size_s = round(150 + random.random() * 900)
        acc_buy += size_b
        acc_sell += size_s
        buy_yes.append({"price": price_b, "size": size_b, "total": round(acc_buy)})
        sell_yes.append({"price": price_s, "size": size_s, "total": round(acc_sell)})
    return {"mid": yes_price, "buyYes": buy_yes, "sellYes": sell_yes}

# ─── AI ORACLE ───────────────────────────────────────────────────────

async def ai_oracle_resolve(question: str, resolution_detail: str, context: str) -> dict:
    llm_key = os.environ.get("LLM_KEY", "")
    if not llm_key:
        outcome = random.choice(["YES", "NO"])
        return {"outcome": outcome, "reasoning": "Auto-resolved (no LLM key configured)", "confidence": 0.7}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        session_id = new_id()
        chat = LlmChat(
            api_key=llm_key,
            session_id=session_id,
            system_message="""You are a trustless AI oracle agent for a decentralized prediction market protocol on Solana.
Your job is to determine whether a prediction market question has resolved YES, NO, or is INVALID (unresolvable with available information).
Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{"outcome": "YES", "confidence": 0.85, "reasoning": "Brief explanation here"}
Valid outcomes: YES, NO, INVALID. confidence must be 0.0 to 1.0."""
        ).with_model("openai", "gpt-4.1-mini")
        prompt = f"""Prediction market question: {question}
Resolution criteria: {resolution_detail or 'Standard resolution based on the literal question'}
Context: {context or 'No additional context provided. Use your training knowledge.'}

Based on the available information, determine if this market resolves YES, NO, or INVALID."""
        txt = await chat.send_message(UserMessage(text=prompt))
        txt = str(txt) if txt else ""
        m = re.search(r'\{[^}]+\}', txt, re.DOTALL)
        if m:
            result = json.loads(m.group())
            outcome = result.get("outcome", "NO").upper()
            if outcome not in ("YES", "NO", "INVALID"):
                outcome = "NO"
            return {
                "outcome": outcome,
                "reasoning": result.get("reasoning", ""),
                "confidence": float(result.get("confidence", 0.7))
            }
        txt_lower = txt.lower()
        if "yes" in txt_lower[:80]:
            return {"outcome": "YES", "reasoning": txt[:300], "confidence": 0.7}
        elif "invalid" in txt_lower[:80]:
            return {"outcome": "INVALID", "reasoning": txt[:300], "confidence": 0.6}
        else:
            return {"outcome": "NO", "reasoning": txt[:300], "confidence": 0.7}
    except Exception as e:
        logger.error(f"AI oracle error: {e}")
        outcome = random.choice(["YES", "NO"])
        return {"outcome": outcome, "reasoning": f"Fallback resolution. Error: {str(e)[:100]}", "confidence": 0.6}

# ─── PYDANTIC MODELS ──────────────────────────────────────────────────

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
    side: str  # YES | NO
    kind: Optional[str] = "market"
    shares: float
    txSig: Optional[str] = None

class SubscribeBody(BaseModel):
    capital: float = 100

class ResolveBody(BaseModel):
    context: Optional[str] = ""

# ─── SEEDER DATA ─────────────────────────────────────────────────────

SEED_MARKETS = [
    {"question": "Will BTC close above $145,000 by end of May 2026?", "category": "Crypto", "resolution": "Pyth", "yesPrice": 0.62, "volume": 4280410, "liquidity": 982000, "participants": 1842, "isLive": False, "daysFromNow": 35, "description": "Resolves YES if Pyth BTC/USD price feed reports a close above $145,000 on May 31, 2026 at 23:59 UTC."},
    {"question": "Will SOL flip ETH in 24h DEX volume this week?", "category": "DeFi", "resolution": "Switchboard", "yesPrice": 0.41, "volume": 1120000, "liquidity": 312000, "participants": 612, "isLive": False, "daysFromNow": 5, "description": "Resolves YES if Solana DEX aggregate volume surpasses Ethereum DEX aggregate volume in any 24h window this week."},
    {"question": "Next BONK candle: will it close green in 15 min?", "category": "Memes", "resolution": "Pyth", "yesPrice": 0.53, "volume": 84220, "liquidity": 22800, "participants": 1208, "isLive": True, "daysFromNow": 0.01, "description": "Live market. Resolves YES if BONK/USDC closes the current 15-minute candle in the green."},
    {"question": "Will Mad Lads floor exceed 60 SOL by Friday?", "category": "NFTs", "resolution": "AIOracle", "yesPrice": 0.27, "volume": 312440, "liquidity": 88000, "participants": 421, "isLive": False, "daysFromNow": 6, "description": "Resolves YES if the Magic Eden Mad Lads collection floor price exceeds 60 SOL by Friday 23:59 UTC."},
    {"question": "Will any new pump.fun token reach $50M MC this week?", "category": "Memes", "resolution": "AIOracle", "yesPrice": 0.71, "volume": 728000, "liquidity": 145000, "participants": 988, "isLive": False, "daysFromNow": 5, "description": "Resolves YES if any token launched on pump.fun this week reaches a $50M market cap within 7 days of launch."},
    {"question": "Will Jupiter daily volume exceed $1B by Sunday?", "category": "DeFi", "resolution": "Switchboard", "yesPrice": 0.48, "volume": 198900, "liquidity": 56400, "participants": 312, "isLive": False, "daysFromNow": 3, "description": "Resolves YES if Jupiter aggregator records more than $1B in 24h volume on any day before Sunday midnight UTC."},
    {"question": "Will the next Fed meeting cut rates by 25bps?", "category": "Politics", "resolution": "AIOracle", "yesPrice": 0.34, "volume": 2410000, "liquidity": 540000, "participants": 2104, "isLive": False, "daysFromNow": 47, "description": "Resolves YES if the Federal Reserve announces a 25 basis point rate cut at the next FOMC meeting."},
    {"question": "Will GPT-6 be announced before July 1, 2026?", "category": "AI", "resolution": "AIOracle", "yesPrice": 0.29, "volume": 612000, "liquidity": 184000, "participants": 901, "isLive": False, "daysFromNow": 65, "description": "Resolves YES if OpenAI makes an official announcement of GPT-6 or equivalent major model before July 1, 2026."},
    {"question": "Will the Lakers make the 2026 NBA Finals?", "category": "Sports", "resolution": "AIOracle", "yesPrice": 0.18, "volume": 1840000, "liquidity": 402000, "participants": 1421, "isLive": False, "daysFromNow": 36, "description": "Resolves YES if the Los Angeles Lakers advance to the 2026 NBA Finals."},
    {"question": "Will this Farcaster cast hit 1k recasts in 24h?", "category": "Social", "resolution": "AIOracle", "yesPrice": 0.56, "volume": 38400, "liquidity": 12000, "participants": 188, "isLive": True, "daysFromNow": 1, "description": "Resolves YES if the linked Farcaster cast accumulates 1,000 recasts within 24 hours of posting."},
    {"question": "Will ETH/SOL ratio drop below 5 before June 2026?", "category": "Crypto", "resolution": "Pyth", "yesPrice": 0.44, "volume": 820000, "liquidity": 210000, "participants": 742, "isLive": False, "daysFromNow": 40, "description": "Resolves YES if the ETH/SOL price ratio falls below 5.0 at any point before June 1, 2026."},
    {"question": "Will BONK market cap exceed $5B this month?", "category": "Memes", "resolution": "Switchboard", "yesPrice": 0.38, "volume": 542000, "liquidity": 134000, "participants": 1089, "isLive": False, "daysFromNow": 20, "description": "Resolves YES if BONK's fully diluted market cap exceeds $5 billion USD at any point this month."},
    {"question": "Will Solana mainnet have zero downtime in May 2026?", "category": "DeFi", "resolution": "Switchboard", "yesPrice": 0.72, "volume": 182000, "liquidity": 44000, "participants": 284, "isLive": False, "daysFromNow": 31, "description": "Resolves YES if Solana mainnet experiences zero reported network outages during May 2026."},
    {"question": "Will Trump post about Solana before end of May?", "category": "Politics", "resolution": "AIOracle", "yesPrice": 0.74, "volume": 1240000, "liquidity": 320000, "participants": 2840, "isLive": False, "daysFromNow": 22, "description": "Resolves YES if Donald Trump posts about Solana on Truth Social or X/Twitter before May 31, 2026."},
    {"question": "Will any AI model surpass GPT-4 on all HELM benchmarks?", "category": "AI", "resolution": "AIOracle", "yesPrice": 0.65, "volume": 480000, "liquidity": 120000, "participants": 612, "isLive": False, "daysFromNow": 90, "description": "Resolves YES if any publicly accessible AI model surpasses GPT-4 performance on all HELM benchmark tasks."},
    {"question": "Will the Azuki floor be above 2 ETH by July?", "category": "NFTs", "resolution": "AIOracle", "yesPrice": 0.45, "volume": 188000, "liquidity": 52000, "participants": 344, "isLive": False, "daysFromNow": 14, "description": "Resolves YES if the Azuki NFT collection floor price is above 2 ETH on OpenSea on July 1, 2026."},
    {"question": "Will Real Madrid win the 2026 Champions League?", "category": "Sports", "resolution": "AIOracle", "yesPrice": 0.22, "volume": 2800000, "liquidity": 620000, "participants": 3240, "isLive": False, "daysFromNow": 120, "description": "Resolves YES if Real Madrid CF wins the 2025-26 UEFA Champions League final."},
    {"question": "Will Farcaster reach 1M daily active users by year end?", "category": "Social", "resolution": "AIOracle", "yesPrice": 0.52, "volume": 148000, "liquidity": 38000, "participants": 512, "isLive": False, "daysFromNow": 185, "description": "Resolves YES if Farcaster reports 1 million or more daily active users at any point in 2026."},
    {"question": "Will a Solana DEX surpass $500M TVL in 60 days?", "category": "DeFi", "resolution": "AIOracle", "yesPrice": 0.31, "volume": 220000, "liquidity": 58000, "participants": 312, "isLive": False, "daysFromNow": 60, "description": "Resolves YES if any Solana-native DEX protocol reaches $500M TVL (Total Value Locked) within the next 60 days."},
    {"question": "Will BTC dominance drop below 40% before July 2026?", "category": "Crypto", "resolution": "Pyth", "yesPrice": 0.19, "volume": 940000, "liquidity": 240000, "participants": 1102, "isLive": False, "daysFromNow": 55, "description": "Resolves YES if Bitcoin's market dominance percentage falls below 40% at any point before July 1, 2026."},
]

SEED_AGENTS = [
    {"name": "Pulse", "handle": "pulse.agent.sol", "type": "Sentiment", "description": "Monitors X/Twitter, Farcaster and Reddit firehoses in real-time. Trades narrative shifts within a single Solana slot before they're priced in.", "pnl30d": 42.3, "winRate": 61.2, "sharpe": 2.4, "maxDrawdown": -8.2, "aum": 1240000, "performanceFee": 15, "uptime": 99.98, "marketsTraded": 1842, "status": "live"},
    {"name": "Arc", "handle": "arc.agent.sol", "type": "Arbitrage", "description": "Cross-venue spread capture across Heliora, Polymarket and tokenized Kalshi markets. Routes via Jupiter for optimal execution.", "pnl30d": 18.7, "winRate": 78.4, "sharpe": 3.9, "maxDrawdown": -2.1, "aum": 4120000, "performanceFee": 20, "uptime": 100.0, "marketsTraded": 9420, "status": "live"},
    {"name": "Anchor", "handle": "anchor.agent.sol", "type": "MarketMaker", "description": "Provides two-sided liquidity to thin and long-tail markets. Earns AMM fees, PREDICT emissions, and Kamino yield on idle capital.", "pnl30d": 11.4, "winRate": 54.1, "sharpe": 2.1, "maxDrawdown": -4.4, "aum": 8840000, "performanceFee": 10, "uptime": 99.91, "marketsTraded": 2104, "status": "live"},
    {"name": "Wire", "handle": "wire.agent.sol", "type": "NewsAlpha", "description": "Scrapes 400+ news sources. Uses reasoning loop to evaluate breaking news impact. Trades within ~400ms of story publication via Yellowstone gRPC.", "pnl30d": 67.1, "winRate": 58.3, "sharpe": 2.8, "maxDrawdown": -12.4, "aum": 612000, "performanceFee": 20, "uptime": 99.4, "marketsTraded": 320, "status": "live"},
    {"name": "Drift", "handle": "drift.agent.sol", "type": "Momentum", "description": "Identifies markets with rapidly shifting probability. Rides confirmed trends with dynamic position sizing. Exits on mean-reversion signals.", "pnl30d": 29.6, "winRate": 49.2, "sharpe": 1.9, "maxDrawdown": -14.0, "aum": 980000, "performanceFee": 15, "uptime": 99.7, "marketsTraded": 1102, "status": "paused"},
    {"name": "Lattice", "handle": "lattice.agent.sol", "type": "Arbitrage", "description": "Statistical arbitrage across correlated prediction markets. Maintains delta-neutral books. Hedges with Drift Protocol perpetuals.", "pnl30d": 22.0, "winRate": 71.0, "sharpe": 3.2, "maxDrawdown": -3.8, "aum": 2640000, "performanceFee": 18, "uptime": 99.95, "marketsTraded": 4220, "status": "live"},
]

SEED_USERS = [
    {"wallet": "8xAB92kzMoLPjE3N5fR1dC4vFgH7iJK6LmN8oP2qRsTu", "handle": "polymath.sol"},
    {"wallet": "3yCD45lzNoMQkfE4O6gS2eD5wGhI8jKL7MnO9pQ3rStV", "handle": "arc.alpha"},
    {"wallet": "6qEF78mzOpNRlgF5P7hT3fE6xHiJ9kLM8NoP0qR4sUvW", "handle": "macro.sol"},
    {"wallet": "1wGH89nzPqOSmiG6Q8iU4gF7yIjK0lMN9OpQ1rS5tVwX", "handle": "drift.dao"},
    {"wallet": "4xIJ01ozQrPTnjH7R9jV5hG8zJkL1mNO0PqR2sT6uWxY", "handle": None},
]

async def seed_database():
    count = await db.markets.count_documents({})
    if count > 0:
        logger.info(f"Database already seeded ({count} markets). Skipping.")
        return
    logger.info("Seeding database...")
    now = datetime.utcnow()

    # Seed users
    for u in SEED_USERS:
        u["id"] = new_id()
        u["createdAt"] = now.isoformat()
    await db.users.insert_many([u.copy() for u in SEED_USERS])

    # Seed agents
    agent_docs = []
    for a in SEED_AGENTS:
        wallet_idx = random.randint(0, len(SEED_USERS) - 1)
        doc = {**a, "id": new_id(), "wallet": SEED_USERS[wallet_idx]["wallet"],
               "subscriptionCount": random.randint(50, 1500), "createdAt": now.isoformat()}
        agent_docs.append(doc)
    await db.agents.insert_many([d.copy() for d in agent_docs])

    # Seed markets + price history
    market_docs = []
    for m in SEED_MARKETS:
        creator_idx = random.randint(0, len(SEED_USERS) - 1)
        market_id = new_id()
        ends_at = now + timedelta(days=m["daysFromNow"])
        doc = {
            "id": market_id,
            "onchainId": f"heliora_{market_id[:8]}",
            "question": m["question"],
            "description": m.get("description", ""),
            "category": m["category"],
            "resolution": m["resolution"],
            "resolutionDetail": m.get("description", ""),
            "endsAt": ends_at.isoformat(),
            "createdAt": (now - timedelta(days=random.randint(1, 14))).isoformat(),
            "resolvedAt": None,
            "status": "open",
            "outcome": None,
            "yesPrice": m["yesPrice"],
            "noPrice": round(1 - m["yesPrice"], 4),
            "liquidity": m["liquidity"],
            "volume": m["volume"],
            "participants": m["participants"],
            "isLive": m["isLive"],
            "creator": {"wallet": SEED_USERS[creator_idx]["wallet"], "handle": SEED_USERS[creator_idx]["handle"]}
        }
        market_docs.append(doc)

        # Generate price history
        price_pts = generate_price_history(m["yesPrice"], num_points=200)
        pp_docs = [{"id": new_id(), "marketId": market_id, **pt} for pt in price_pts]
        await db.price_points.insert_many(pp_docs)

    await db.markets.insert_many([d.copy() for d in market_docs])

    # Seed some trades
    trade_docs = []
    for md in market_docs[:10]:
        for _ in range(random.randint(3, 8)):
            user = random.choice(SEED_USERS)
            agent = random.choice(agent_docs) if random.random() > 0.5 else None
            side = random.choice(["YES", "NO"])
            price = md["yesPrice"] if side == "YES" else md["noPrice"]
            price += random.gauss(0, 0.02)
            price = max(0.01, min(0.99, price))
            shares = round(random.uniform(50, 2000), 2)
            trade_docs.append({
                "id": new_id(),
                "marketId": md["id"],
                "userId": agent["id"] if agent else user["id"],
                "wallet": agent["wallet"] if agent else user["wallet"],
                "handle": agent["handle"] if agent else user.get("handle"),
                "isAgent": agent is not None,
                "side": side,
                "kind": "market",
                "shares": shares,
                "price": round(price, 4),
                "cost": round(shares * price, 2),
                "txSig": f"sig_{new_id()[:12]}",
                "createdAt": (now - timedelta(hours=random.randint(0, 48))).isoformat()
            })
    if trade_docs:
        await db.trades.insert_many(trade_docs)

    # Seed some oracle resolutions
    resolved_markets = random.sample(market_docs, min(5, len(market_docs)))
    resolution_docs = []
    for mkt in resolved_markets:
        outcome = random.choice(["YES", "NO"])
        consensus = random.randint(3, 5)
        votes = []
        for ag in random.sample(agent_docs, 5):
            vote = outcome if random.random() < 0.8 else random.choice(["YES", "NO"])
            votes.append({
                "id": new_id(),
                "vote": vote,
                "confidence": round(random.uniform(0.6, 0.95), 2),
                "evidence": f"Agent analysis: Based on available data, the market question '{mkt['question'][:60]}...' most likely resolves {vote}.",
                "agent": {k: v for k, v in ag.items() if k != "_id"}
            })
        resolution_docs.append({
            "id": new_id(),
            "marketId": mkt["id"],
            "outcome": outcome,
            "consensus": consensus,
            "totalVotes": 5,
            "reasoning": f"Majority consensus ({consensus}/5 agents) determined outcome is {outcome}.",
            "createdAt": (now - timedelta(hours=random.randint(1, 72))).isoformat(),
            "market": {k: v for k, v in mkt.items() if k != "_id"},
            "votes": votes
        })
    if resolution_docs:
        await db.oracle_resolutions.insert_many(resolution_docs)

    logger.info(f"Seeded {len(market_docs)} markets, {len(agent_docs)} agents, {len(trade_docs)} trades, {len(resolution_docs)} oracle resolutions.")

# ─── MARKETS ─────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Heliora API v1 — AI-native prediction market protocol on Solana"}

@api_router.get("/markets")
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


@api_router.post("/markets")
async def create_market(body: CreateMarketBody, x_wallet: Optional[str] = Header(None)):
    if not x_wallet:
        x_wallet = f"demo_{new_id()[:8]}.sol"
    market_id = new_id()
    now = datetime.utcnow()
    doc = {
        "id": market_id,
        "onchainId": f"heliora_{market_id[:8]}",
        "question": body.question,
        "description": body.description or "",
        "category": body.category,
        "resolution": body.resolution,
        "resolutionDetail": body.resolutionDetail or "",
        "endsAt": body.endsAt,
        "createdAt": now.isoformat(),
        "resolvedAt": None,
        "status": "open",
        "outcome": None,
        "yesPrice": 0.5,
        "noPrice": 0.5,
        "liquidity": body.liquiditySeed or 500,
        "volume": 0.0,
        "participants": 0,
        "isLive": body.isLive or False,
        "creator": {"wallet": x_wallet, "handle": None}
    }
    await db.markets.insert_one(doc.copy())
    # Create initial price history
    pp = generate_price_history(0.5, num_points=48)
    pp_docs = [{"id": new_id(), "marketId": market_id, **pt} for pt in pp]
    await db.price_points.insert_many(pp_docs)
    return {"market": serialize(doc)}


@api_router.get("/markets/{market_id}")
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


@api_router.get("/markets/{market_id}/orderbook")
async def get_orderbook(market_id: str):
    market = await db.markets.find_one({"id": market_id})
    if not market:
        raise HTTPException(404, "Market not found")
    ob = generate_orderbook_snapshot(market["yesPrice"])
    return ob

# ─── TRADES ──────────────────────────────────────────────────────────

@api_router.post("/trades")
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
        "createdAt": now_iso()
    }
    await db.trades.insert_one(trade.copy())

    # Update market stats
    new_yes_price = market["yesPrice"]
    impact = min(0.05, body.shares / max(1, market["liquidity"]) * 0.5)
    if side == "YES":
        new_yes_price = min(0.99, new_yes_price + impact)
    else:
        new_yes_price = max(0.01, new_yes_price - impact)

    await db.markets.update_one({"id": body.marketId}, {
        "$set": {"yesPrice": round(new_yes_price, 4), "noPrice": round(1 - new_yes_price, 4)},
        "$inc": {"volume": cost, "participants": 1}
    })

    # Record price point
    await db.price_points.insert_one({
        "id": new_id(), "marketId": body.marketId,
        "yesPrice": round(new_yes_price, 4), "noPrice": round(1 - new_yes_price, 4),
        "ts": now_iso()
    })

    # Update or create position
    existing = await db.positions.find_one({"userId": x_wallet, "marketId": body.marketId})
    if existing:
        if side == "YES":
            new_yes_shares = existing["yesShares"] + body.shares
            new_avg_yes = (existing["avgYesCost"] * existing["yesShares"] + price * body.shares) / new_yes_shares
            await db.positions.update_one({"id": existing["id"]}, {
                "$set": {"yesShares": new_yes_shares, "avgYesCost": round(new_avg_yes, 4)}
            })
        else:
            new_no_shares = existing["noShares"] + body.shares
            new_avg_no = (existing["avgNoCost"] * existing["noShares"] + price * body.shares) / new_no_shares
            await db.positions.update_one({"id": existing["id"]}, {
                "$set": {"noShares": new_no_shares, "avgNoCost": round(new_avg_no, 4)}
            })
    else:
        pos = {
            "id": new_id(), "userId": x_wallet, "marketId": body.marketId,
            "yesShares": body.shares if side == "YES" else 0,
            "noShares": body.shares if side == "NO" else 0,
            "avgYesCost": round(price, 4) if side == "YES" else 0,
            "avgNoCost": round(price, 4) if side == "NO" else 0,
            "realizedPnl": 0.0, "createdAt": now_iso()
        }
        await db.positions.insert_one(pos)

    return {"trade": serialize(trade)}


@api_router.get("/trades/recent/{market_id}")
async def recent_trades(market_id: str):
    trades = await db.trades.find({"marketId": market_id}).sort([("createdAt", -1)]).limit(30).to_list(30)
    return {"trades": serialize_list(trades)}

# ─── PORTFOLIO ───────────────────────────────────────────────────────

@api_router.get("/portfolio")
async def get_portfolio(x_wallet: Optional[str] = Header(None)):
    if not x_wallet:
        return {"summary": {"openValue": 0, "unrealized": 0, "realized": 0, "positions": 0}, "positions": [], "trades": []}

    positions = await db.positions.find({"userId": x_wallet}).to_list(100)
    trades = await db.trades.find({"userId": x_wallet}).sort([("createdAt", -1)]).limit(50).to_list(50)

    enriched_positions = []
    open_value = 0.0
    unrealized = 0.0
    realized = 0.0

    for pos in positions:
        market = await db.markets.find_one({"id": pos["marketId"]})
        if not market:
            continue
        pos_data = serialize(pos)
        pos_data["market"] = serialize(market)
        enriched_positions.append(pos_data)
        if pos["yesShares"] > 0:
            val = pos["yesShares"] * market["yesPrice"]
            cost = pos["yesShares"] * pos["avgYesCost"]
            open_value += val
            unrealized += val - cost
        if pos["noShares"] > 0:
            val = pos["noShares"] * market["noPrice"]
            cost = pos["noShares"] * pos["avgNoCost"]
            open_value += val
            unrealized += val - cost
        realized += pos.get("realizedPnl", 0)

    enriched_trades = []
    for t in trades:
        market = await db.markets.find_one({"id": t["marketId"]})
        t_data = serialize(t)
        if market:
            t_data["market"] = {"question": market["question"], "category": market["category"]}
        enriched_trades.append(t_data)

    return {
        "summary": {
            "openValue": round(open_value, 2),
            "unrealized": round(unrealized, 2),
            "realized": round(realized, 2),
            "positions": len(enriched_positions)
        },
        "positions": enriched_positions,
        "trades": enriched_trades
    }

# ─── AGENTS ──────────────────────────────────────────────────────────

@api_router.get("/agents")
async def list_agents():
    agents = await db.agents.find().to_list(100)
    for a in agents:
        count = await db.positions.count_documents({"userId": a["id"]})
        a["_count"] = {"subscriptions": count + a.get("subscriptionCount", 0)}
    return {"agents": serialize_list(agents)}


@api_router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = await db.agents.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(404, "Agent not found")
    count = await db.positions.count_documents({"userId": agent_id})
    agent["_count"] = {"subscriptions": count + agent.get("subscriptionCount", 0)}
    return {"agent": serialize(agent)}


@api_router.post("/agents/{agent_id}/subscribe")
async def subscribe_agent(agent_id: str, body: SubscribeBody, x_wallet: Optional[str] = Header(None)):
    agent = await db.agents.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(404, "Agent not found")
    if not x_wallet:
        x_wallet = f"demo_{new_id()[:8]}.sol"
    subscription = {
        "id": new_id(), "agentId": agent_id, "userId": x_wallet,
        "capital": body.capital, "createdAt": now_iso()
    }
    await db.subscriptions.insert_one(subscription.copy())
    await db.agents.update_one({"id": agent_id}, {"$inc": {"subscriptionCount": 1}})
    return {"subscription": serialize(subscription)}

# ─── ORACLE ──────────────────────────────────────────────────────────

@api_router.get("/oracle/recent")
async def recent_resolutions():
    resolutions = await db.oracle_resolutions.find().sort([("createdAt", -1)]).limit(20).to_list(20)
    return {"resolutions": serialize_list(resolutions)}


CONSENSUS_THRESHOLD = 3   # ≥3 of 5 agents must agree
ORACLE_QUORUM = 5         # always run 5 agents
MIN_AVG_CONFIDENCE = 0.55 # below this, mark unresolved


@api_router.post("/oracle/resolve/{market_id}")
async def resolve_market(market_id: str, body: ResolveBody):
    """
    5-agent AI oracle consensus.
    - Runs 5 independent LLM agents in parallel
    - Confidence-weighted majority (≥3 of 5 hard threshold)
    - If no side reaches threshold OR avg confidence < MIN_AVG_CONFIDENCE → status="disputed"
    """
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

    # Run all 5 agents in PARALLEL for speed (single Solana slot ~412ms target)
    coroutines = [
        ai_oracle_resolve(
            market["question"],
            market.get("resolutionDetail", ""),
            body.context or ""
        ) for _ in oracle_agents
    ]
    results = await asyncio.gather(*coroutines, return_exceptions=True)

    votes = []
    for agent, result in zip(oracle_agents, results):
        if isinstance(result, Exception):
            result = {"outcome": "INVALID", "confidence": 0.3, "reasoning": f"Agent error: {type(result).__name__}"}
        votes.append({
            "id": new_id(),
            "vote": result["outcome"],
            "confidence": result["confidence"],
            "evidence": result["reasoning"],
            "agent": {k: v for k, v in serialize(agent).items() if k != "_id"}
        })

    # Confidence-weighted tally
    tally_count = {"YES": 0, "NO": 0, "INVALID": 0}
    tally_conf = {"YES": 0.0, "NO": 0.0, "INVALID": 0.0}
    for v in votes:
        tally_count[v["vote"]] = tally_count.get(v["vote"], 0) + 1
        tally_conf[v["vote"]] = tally_conf.get(v["vote"], 0.0) + float(v["confidence"])

    # Determine winning outcome by hard count threshold
    outcome = max(tally_count, key=tally_count.get)
    consensus = tally_count[outcome]
    avg_conf = tally_conf[outcome] / consensus if consensus > 0 else 0.0
    overall_avg_conf = sum(float(v["confidence"]) for v in votes) / max(1, len(votes))

    is_disputed = consensus < CONSENSUS_THRESHOLD or overall_avg_conf < MIN_AVG_CONFIDENCE
    final_status = "disputed" if is_disputed else "resolved"
    final_outcome = outcome if not is_disputed else "DISPUTED"

    reasoning = (
        f"AI oracle consensus: {consensus}/{len(votes)} agents voted {outcome} "
        f"(avg confidence {avg_conf:.0%}, overall {overall_avg_conf:.0%}). "
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
        "averageConfidence": round(overall_avg_conf, 3),
        "consensusThreshold": CONSENSUS_THRESHOLD,
        "isDisputed": is_disputed,
        "reasoning": reasoning,
        "createdAt": now_iso(),
        "market": serialize(market),
        "votes": votes
    }
    await db.oracle_resolutions.insert_one({k: v for k, v in resolution.items()})

    update_fields = {"status": final_status}
    if not is_disputed:
        update_fields["outcome"] = outcome
        update_fields["resolvedAt"] = now_iso()
    await db.markets.update_one({"id": market_id}, {"$set": update_fields})

    resolution.pop("_id", None)
    return {"resolution": resolution}

# ─── STATS ───────────────────────────────────────────────────────────

@api_router.get("/stats/protocol")
async def protocol_stats():
    markets = await db.markets.count_documents({})
    open_markets = await db.markets.count_documents({"status": "open"})
    agents = await db.agents.count_documents({})
    users = await db.users.count_documents({})

    pipeline = [{"$group": {"_id": None, "totalVolume": {"$sum": "$volume"}, "totalLiquidity": {"$sum": "$liquidity"}}}]
    agg = await db.markets.aggregate(pipeline).to_list(1)
    total_volume = agg[0]["totalVolume"] if agg else 0
    total_liquidity = agg[0]["totalLiquidity"] if agg else 0

    return {
        "markets": markets,
        "openMarkets": open_markets,
        "agents": agents,
        "users": users,
        "totalVolume": total_volume,
        "totalLiquidity": total_liquidity
    }


@api_router.get("/stats/leaderboard")
async def leaderboard():
    users = await db.users.find().to_list(100)
    agents = await db.agents.find().to_list(100)
    entries = []
    for u in users:
        positions = await db.positions.find({"userId": u["id"]}).to_list(100)
        pnl = sum(p.get("realizedPnl", 0) for p in positions)
        # Add unrealized
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
            "pnl": round(pnl + random.gauss(0, 5000), 2),  # Add demo variance
            "positions": len(positions)
        })
    # Add agent entries
    for ag in agents[:4]:
        entries.append({
            "wallet": ag["wallet"],
            "handle": ag["handle"],
            "pnl": round(ag["aum"] * ag["pnl30d"] / 100, 2),
            "positions": ag["marketsTraded"]
        })
    entries.sort(key=lambda x: x["pnl"], reverse=True)
    return {"leaderboard": entries[:20]}

# ─── WEBSOCKET ───────────────────────────────────────────────────────

active_connections: Dict[str, list] = {}

@api_router.websocket("/ws/{market_id}")
async def ws_market(websocket: WebSocket, market_id: str):
    await websocket.accept()
    if market_id not in active_connections:
        active_connections[market_id] = []
    active_connections[market_id].append(websocket)
    logger.info(f"WebSocket connected for market {market_id}")
    try:
        market = await db.markets.find_one({"id": market_id})
        if not market:
            await websocket.close(code=1008, reason="Market not found")
            return
        current_price = market["yesPrice"]
        while True:
            # Receive any client messages (non-blocking)
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
            except Exception:
                break

            # Simulate price drift
            drift = random.gauss(0, 0.006)
            current_price = max(0.02, min(0.98, current_price + drift))
            rounded = round(current_price, 4)

            # Persist price
            await db.markets.update_one({"id": market_id}, {
                "$set": {"yesPrice": rounded, "noPrice": round(1 - rounded, 4)}
            })
            await db.price_points.insert_one({
                "id": new_id(), "marketId": market_id,
                "yesPrice": rounded, "noPrice": round(1 - rounded, 4),
                "ts": now_iso()
            })

            # Generate orderbook
            ob = generate_orderbook_snapshot(rounded)
            await websocket.send_json({
                "type": "price",
                "yesPrice": rounded,
                "noPrice": round(1 - rounded, 4),
                "orderbook": ob,
                "ts": now_iso()
            })
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for market {market_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if market_id in active_connections and websocket in active_connections[market_id]:
            active_connections[market_id].remove(websocket)

# ─── STARTUP ─────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    try:
        await seed_database()
    except Exception as e:
        logger.error(f"Seeder error: {e}")

app.include_router(api_router)

logging.getLogger("motor").setLevel(logging.WARNING)
