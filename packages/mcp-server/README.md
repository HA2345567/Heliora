# heliora-mcp-server

Model Context Protocol (MCP) server that exposes the entire HELIORA prediction-market protocol as 9 natural-language tools to **any MCP-compatible LLM client** — Claude Desktop, Cursor, Continue, custom OpenAI/Anthropic agents.

## Install
```bash
pip install -r requirements.txt
```

## Run (stdio transport)
```bash
HELIORA_API_URL=https://api.heliora.fi \
HELIORA_WALLET=YourSolanaWalletPubkey \
python server.py
```

## Claude Desktop config
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "heliora": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"],
      "env": {
        "HELIORA_API_URL": "https://api.heliora.fi",
        "HELIORA_WALLET": "8xAB92kzMoLPjE3N5fR1dC4vFgH7iJK6LmN8oP2qRsTu"
      }
    }
  }
}
```

## Tools exposed
1. `heliora_list_markets` — discover trades by category / live / search
2. `heliora_get_market` — full market detail + 200-pt price history
3. `heliora_create_market` — permissionless market creation
4. `heliora_place_trade` — buy YES/NO shares
5. `heliora_get_portfolio` — positions + PnL
6. `heliora_get_orderbook` — 15-deep orderbook snapshot
7. `heliora_resolve_market` — trigger 5-agent oracle consensus
8. `heliora_protocol_stats` — TVL, volume, counts
9. `heliora_leaderboard` — top 20 wallets by PnL

## Example prompts
> "Find the top 5 crypto markets ending this week and tell me which has the largest YES/NO price gap."

> "Create a market: 'Will SOL hit $300 by June 1?' resolved by Pyth, ending 2026-06-01T00:00:00Z, $1000 seed."

> "Resolve market `abc-123` and explain the oracle's reasoning."

## License
MIT
