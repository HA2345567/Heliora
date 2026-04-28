# Heliora Market Factory — Solana Anchor Program

On-chain prediction market protocol. Permissionless creation, AMM-based YES/NO trading, AI-oracle resolution (5-agent consensus), and trustless claim.

## Program ID
`HeLi5oRA1MarketFactoRyPRoGRaM1111111111111`

## Instructions
| ix | description |
|----|-------------|
| `create_market(market_id, question, resolution_kind, ends_at, liquidity_seed)` | Open new market, transfer seed liquidity to vault PDA |
| `place_bet(side, collateral_in, min_shares_out)` | Buy YES (0) or NO (1) shares via x·y=k AMM |
| `submit_oracle_vote(outcome, confidence_bps)` | One of 5 oracle agents votes YES/NO/INVALID. Auto-resolves at ≥3-of-5 |
| `claim()` | Winning side: 1 share = 1 collateral unit. INVALID: cost-basis refund |

## PDAs
- `["market", market_id]`
- `["vault", market]`
- `["position", market, owner, side]`
- `["oracle_vote", market, agent]`

## Build
```bash
cd programs/heliora_market_factory
anchor build
anchor deploy --provider.cluster devnet
```

## Constants
- `MAX_AGENTS = 5`, `CONSENSUS_THRESHOLD = 3`
- `FEE_BPS = 100` (1%)
- AMM is constant product (`x · y = k`)

## Status
Bytecode-complete. Awaiting devnet deployment + IDL fetch by frontend client.
