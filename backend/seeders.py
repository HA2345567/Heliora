"""Database seeder. Idempotent."""
import random
from datetime import datetime, timedelta
from .core import db, new_id, generate_price_history, logger

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

    for u in SEED_USERS:
        u["id"] = new_id()
        u["createdAt"] = now.isoformat()
    await db.users.insert_many([u.copy() for u in SEED_USERS])

    agent_docs = []
    for a in SEED_AGENTS:
        wallet_idx = random.randint(0, len(SEED_USERS) - 1)
        agent_docs.append({**a, "id": new_id(), "wallet": SEED_USERS[wallet_idx]["wallet"],
                           "subscriptionCount": random.randint(50, 1500), "createdAt": now.isoformat()})
    await db.agents.insert_many([d.copy() for d in agent_docs])

    market_docs = []
    for m in SEED_MARKETS:
        creator_idx = random.randint(0, len(SEED_USERS) - 1)
        market_id = new_id()
        ends_at = now + timedelta(days=m["daysFromNow"])
        doc = {
            "id": market_id, "onchainId": f"heliora_{market_id[:8]}",
            "question": m["question"], "description": m.get("description", ""),
            "category": m["category"], "resolution": m["resolution"],
            "resolutionDetail": m.get("description", ""),
            "endsAt": ends_at.isoformat(),
            "createdAt": (now - timedelta(days=random.randint(1, 14))).isoformat(),
            "resolvedAt": None, "status": "open", "outcome": None,
            "yesPrice": m["yesPrice"], "noPrice": round(1 - m["yesPrice"], 4),
            "liquidity": m["liquidity"], "volume": m["volume"], "participants": m["participants"],
            "isLive": m["isLive"],
            "creator": {"wallet": SEED_USERS[creator_idx]["wallet"], "handle": SEED_USERS[creator_idx]["handle"]},
        }
        market_docs.append(doc)
        pp = generate_price_history(m["yesPrice"], num_points=200)
        await db.price_points.insert_many([{"id": new_id(), "marketId": market_id, **pt} for pt in pp])
    await db.markets.insert_many([d.copy() for d in market_docs])

    trade_docs = []
    for md in market_docs[:10]:
        for _ in range(random.randint(3, 8)):
            user = random.choice(SEED_USERS)
            agent = random.choice(agent_docs) if random.random() > 0.5 else None
            side = random.choice(["YES", "NO"])
            price = (md["yesPrice"] if side == "YES" else md["noPrice"]) + random.gauss(0, 0.02)
            price = max(0.01, min(0.99, price))
            shares = round(random.uniform(50, 2000), 2)
            trade_docs.append({
                "id": new_id(), "marketId": md["id"],
                "userId": agent["id"] if agent else user["id"],
                "wallet": agent["wallet"] if agent else user["wallet"],
                "handle": agent["handle"] if agent else user.get("handle"),
                "isAgent": agent is not None, "side": side, "kind": "market",
                "shares": shares, "price": round(price, 4),
                "cost": round(shares * price, 2),
                "txSig": f"sig_{new_id()[:12]}",
                "createdAt": (now - timedelta(hours=random.randint(0, 48))).isoformat(),
            })
    if trade_docs:
        await db.trades.insert_many(trade_docs)

    resolved_markets = random.sample(market_docs, min(5, len(market_docs)))
    resolution_docs = []
    for mkt in resolved_markets:
        outcome = random.choice(["YES", "NO"])
        consensus = random.randint(3, 5)
        votes = []
        for ag in random.sample(agent_docs, 5):
            vote = outcome if random.random() < 0.8 else random.choice(["YES", "NO"])
            votes.append({
                "id": new_id(), "vote": vote,
                "confidence": round(random.uniform(0.6, 0.95), 2),
                "evidence": f"Agent analysis: Based on available data, the market question '{mkt['question'][:60]}...' most likely resolves {vote}.",
                "agent": {k: v for k, v in ag.items() if k != "_id"},
            })
        resolution_docs.append({
            "id": new_id(), "marketId": mkt["id"], "outcome": outcome,
            "consensus": consensus, "totalVotes": 5,
            "reasoning": f"Majority consensus ({consensus}/5 agents) determined outcome is {outcome}.",
            "createdAt": (now - timedelta(hours=random.randint(1, 72))).isoformat(),
            "market": {k: v for k, v in mkt.items() if k != "_id"},
            "votes": votes,
        })
    if resolution_docs:
        await db.oracle_resolutions.insert_many(resolution_docs)

    logger.info(f"Seeded {len(market_docs)} markets, {len(agent_docs)} agents, {len(trade_docs)} trades, {len(resolution_docs)} oracle resolutions.")
