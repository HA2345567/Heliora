# Heliora Backend

A **Node.js + TypeScript** backend for a **prediction market platform** with:
- **Express.js** REST API
- **Prisma ORM** with PostgreSQL
- **WebSocket** live price streaming
- **AI Oracle** consensus-based market resolution
- **Portfolio tracking** and leaderboards

## Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL 12+

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Update `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/heliora"
NODE_ENV="development"
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### 3. Setup Prisma and database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. (Optional) Seed database with sample data

```bash
npm run prisma:seed
```

## Development

### Start development server

```bash
npm run dev
```

Server: http://localhost:3000  
WebSocket: ws://localhost:3000/ws/:marketId

### Build for production

```bash
npm run build
npm start
```

### Database management

```bash
npm run prisma:studio    # Open Prisma Studio UI
npm run prisma:migrate   # Create new migration
```

## API Endpoints

### Health Check
- `GET /api/health` - Server status

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents/:agentId/subscribe` - Subscribe to agent

**Subscribe Body:**
```json
{
  "capital": 50000
}
```

### Markets
- `GET /api/markets` - List markets (filtering, sorting)
- `POST /api/markets` - Create new market
- `GET /api/markets/:id` - Get market with price history
- `GET /api/markets/:id/orderbook` - Get orderbook snapshot

**Query params:** `category`, `live`, `sort` (volume|ending|trending|newest), `search`, `take`

**Create Market Body:**
```json
{
  "question": "Will Bitcoin reach $100,000?",
  "category": "Crypto",
  "endsAt": "2024-12-31T23:59:59Z",
  "description": "...",
  "liquiditySeed": 5000
}
```

### Trades
- `POST /api/trades` - Place trade (YES/NO shares)
- `GET /api/trades/market/:marketId` - Recent trades
- `GET /api/trades/portfolio` - User portfolio & PnL

**Place Trade Body:**
```json
{
  "marketId": "uuid",
  "side": "YES",
  "shares": 100
}
```

**Headers:** `x-wallet: wallet_address.sol`

### Stats
- `GET /api/stats/protocol` - Protocol-wide statistics
- `GET /api/stats/leaderboard` - Top traders leaderboard

### Oracle
- `GET /api/oracle/recent` - Recent resolutions
- `POST /api/oracle/resolve/:marketId` - Resolve market using AI consensus

## WebSocket

### Connect to market price stream

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/market-id');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
  // {
  //   type: 'price',
  //   yesPrice: 0.65,
  //   noPrice: 0.35,
  //   orderbook: { yes: { bids: [...], asks: [...] }, no: {...} },
  //   ts: '2024-04-29T...'
  // }
};
```

## Data Models

### Market
- YES/NO binary prediction market
- Prices move with trading volume (AMM mechanics)
- Can be resolved or disputed by oracle consensus

### Position
- User holdings (YES/NO shares)
- Tracks average cost basis and realized PnL
- Unrealized PnL calculated from current market prices

### Trade
- Records all trades on a market
- Updates positions and market prices
- 1% fee deducted from trade cost

### Agent
- AI trading agent
- Can receive user subscriptions
- Tracks AUM and 30-day PnL

### OracleResolution
- AI consensus voting result
- Required votes from agents
- Disputed if consensus threshold not met

## Trading Mechanics

1. **Price Impact**: Large trades move market prices based on liquidity
2. **Position Averaging**: Multiple trades avg the cost basis
3. **Fee**: 1% deducted from trade cost
4. **PnL Calculation**:
   - Realized PnL: locked in from trades
   - Unrealized PnL: current value - avg cost basis
   - Total PnL = Realized + Unrealized

## Project Structure

```
src/
├── index.ts              # Server setup + WebSocket
├── utils/
│   └── helpers.ts        # Utility functions
└── routes/
    ├── agents.ts         # Agent routes
    ├── markets.ts        # Market routes
    ├── trades.ts         # Trade routes + portfolio
    ├── stats.ts          # Protocol stats & leaderboard
    ├── oracle.ts         # Oracle resolution
    └── ws.ts             # WebSocket initialization
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Seed script
```

## Environment

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - development/production
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed origins for CORS

## Technologies

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma** - ORM
- **PostgreSQL** - Database
- **WebSocket (ws)** - Real-time updates
- **CORS** - Cross-origin requests

## License

MIT

