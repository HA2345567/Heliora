"""
HELIORA MCP Server
──────────────────
Model Context Protocol (MCP) server exposing Heliora's prediction-market protocol
as natural-language tools to any MCP-compatible LLM client (Claude Desktop,
Cursor, custom OpenAI agents, etc.).

Run:
    pip install -r requirements.txt
    python server.py

Or as a module:
    python -m heliora_mcp_server

Configure your MCP client to launch this command on stdio transport.
"""

from __future__ import annotations

import os
import json
import asyncio
from typing import Any
from urllib.parse import urlencode

import httpx
from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent


HELIORA_API_URL = os.environ.get("HELIORA_API_URL", "https://api.heliora.fi")
HELIORA_WALLET = os.environ.get("HELIORA_WALLET", "")

server = Server("heliora-mcp")


# ─── HTTP helpers ─────────────────────────────────────────────────────

def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if HELIORA_WALLET:
        h["X-Wallet"] = HELIORA_WALLET
    return h


async def _get(path: str, params: dict | None = None) -> dict:
    url = f"{HELIORA_API_URL}{path}"
    if params:
        url = f"{url}?{urlencode({k: v for k, v in params.items() if v is not None})}"
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(url, headers=_headers())
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(f"{HELIORA_API_URL}{path}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()


# ─── MCP tool definitions ─────────────────────────────────────────────

@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="heliora_list_markets",
            description="List open prediction markets on Heliora. Useful for discovering trades; supports category filter, live-only filter, search by question text, and sort by volume/ending/trending/newest.",
            inputSchema={
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["Crypto", "DeFi", "NFTs", "Memes", "Politics", "AI", "Sports", "Social"]},
                    "live": {"type": "boolean"},
                    "sort": {"type": "string", "enum": ["volume", "ending", "trending", "newest"], "default": "volume"},
                    "search": {"type": "string"},
                    "take": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
                },
            },
        ),
        Tool(
            name="heliora_get_market",
            description="Fetch full detail of one market: question, YES/NO probabilities, 200-point price history, recent trades, and any oracle resolution.",
            inputSchema={
                "type": "object",
                "properties": {"marketId": {"type": "string"}},
                "required": ["marketId"],
            },
        ),
        Tool(
            name="heliora_create_market",
            description="Permissionlessly create a new prediction market with seeded liquidity. Good for capturing emerging narratives.",
            inputSchema={
                "type": "object",
                "properties": {
                    "question": {"type": "string", "minLength": 8, "maxLength": 200},
                    "description": {"type": "string"},
                    "category": {"type": "string", "default": "Crypto"},
                    "resolution": {"type": "string", "enum": ["Pyth", "Switchboard", "AIOracle"], "default": "AIOracle"},
                    "resolutionDetail": {"type": "string"},
                    "endsAt": {"type": "string", "description": "ISO 8601 timestamp"},
                    "liquiditySeed": {"type": "number", "default": 500},
                    "isLive": {"type": "boolean", "default": False},
                },
                "required": ["question", "endsAt"],
            },
        ),
        Tool(
            name="heliora_place_trade",
            description="Buy YES or NO shares on a market via the on-chain AMM. Returns fill price + cost.",
            inputSchema={
                "type": "object",
                "properties": {
                    "marketId": {"type": "string"},
                    "side": {"type": "string", "enum": ["YES", "NO"]},
                    "kind": {"type": "string", "enum": ["market", "limit"], "default": "market"},
                    "shares": {"type": "number", "minimum": 0.0001},
                },
                "required": ["marketId", "side", "shares"],
            },
        ),
        Tool(
            name="heliora_get_portfolio",
            description="Return all open positions, unrealized PnL, realized PnL, and recent trades for the connected wallet.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="heliora_get_orderbook",
            description="Get a 15-deep YES-side orderbook snapshot (bids + asks) for a market.",
            inputSchema={
                "type": "object",
                "properties": {"marketId": {"type": "string"}},
                "required": ["marketId"],
            },
        ),
        Tool(
            name="heliora_resolve_market",
            description="Trigger 5-agent AI oracle consensus resolution. Returns final outcome (YES/NO/INVALID), the consensus tally, and each agent's evidence.",
            inputSchema={
                "type": "object",
                "properties": {
                    "marketId": {"type": "string"},
                    "context": {"type": "string", "description": "Optional extra context the oracle should consider."},
                },
                "required": ["marketId"],
            },
        ),
        Tool(
            name="heliora_protocol_stats",
            description="Return high-level protocol stats: TVL, total volume, market & agent counts.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="heliora_leaderboard",
            description="Return the top 20 wallets by all-time PnL across Heliora.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


# ─── tool dispatcher ─────────────────────────────────────────────────

@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any] | None) -> list[TextContent]:
    args = arguments or {}
    try:
        if name == "heliora_list_markets":
            data = await _get("/api/markets", args)
        elif name == "heliora_get_market":
            data = await _get(f"/api/markets/{args['marketId']}")
        elif name == "heliora_create_market":
            data = await _post("/api/markets", args)
        elif name == "heliora_place_trade":
            data = await _post("/api/trades", args)
        elif name == "heliora_get_portfolio":
            data = await _get("/api/portfolio")
        elif name == "heliora_get_orderbook":
            data = await _get(f"/api/markets/{args['marketId']}/orderbook")
        elif name == "heliora_resolve_market":
            data = await _post(
                f"/api/oracle/resolve/{args['marketId']}",
                {"context": args.get("context", "")},
            )
        elif name == "heliora_protocol_stats":
            data = await _get("/api/stats/protocol")
        elif name == "heliora_leaderboard":
            data = await _get("/api/stats/leaderboard")
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]
        return [TextContent(type="text", text=json.dumps(data, indent=2, default=str))]
    except httpx.HTTPStatusError as e:
        return [TextContent(type="text", text=f"HTTP {e.response.status_code}: {e.response.text[:300]}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error calling {name}: {type(e).__name__}: {e}")]


# ─── stdio entrypoint ────────────────────────────────────────────────

async def amain() -> None:
    async with stdio_server() as (read, write):
        await server.run(
            read,
            write,
            InitializationOptions(
                server_name="heliora-mcp",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


def main() -> None:
    asyncio.run(amain())


if __name__ == "__main__":
    main()
