# ☀️ Heliora

**The AI-Native Prediction Protocol on Solana**

Heliora is a next-generation prediction market platform that combines the speed of Solana with an advanced multi-agent AI architecture. By leveraging autonomous agents to create, price, and resolve markets, Heliora offers a continuous, real-time trading experience across Sports, Crypto, Politics, and AI/Tech events.

---

## ✨ Features

- **⚡ Blazing Fast On-Chain Settlement:** Built on Solana using the Anchor framework, ensuring sub-second trades and minimal transaction fees.
- **🤖 Multi-Agent AI Architecture:** 
  - **Market Creator:** Automatically curates and deploys new markets based on real-time news and institutional data streams.
  - **Market Maker:** Ensures continuous liquidity, dynamic repricing, and tight spreads.
  - **Sentiment & Arbitrage Bots:** Simulates organic market activity and exploits inefficiencies to keep prices accurate.
- **🌐 Real-Time Data Bridge:** Integrates live data from institutional and other high-fidelity sources, maintaining over 2,000+ active markets including the IPL, US Elections, and Crypto milestones.
- **🎨 Premium UI/UX:** A stunning, modern web interface featuring smooth micro-animations, dynamic orderbooks, and interactive charting.
- **🔔 Social & Tracking:** Personalized watchlists, real-time alerts, and native Web Share API capabilities.

## 🏗️ Technology Stack

- **Frontend:** React, Vite, Tailwind CSS, TanStack Query, `@solana/wallet-adapter`
- **Backend:** Node.js, Express, Prisma ORM, SQLite (Dev)
- **Smart Contracts:** Rust, Anchor Framework (v0.32.x), Solana Devnet
- **AI Integration:** LLM abstractions (Google Gemini) for oracle resolution and agent logic

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Bun](https://bun.sh/) (recommended for fast package management)
- [Rust & Cargo](https://rustup.rs/)
- [Solana CLI](https://docs.solanalabs.com/cli/install) & [Anchor CLI](https://www.anchor-lang.com/docs/installation) (v0.32.x)

### 1. Clone the Repository

```bash
git clone https://github.com/HA2345567/Heliora.git
cd Heliora
```

### 2. Smart Contract (Anchor) Setup

Navigate to the Solana program directory to build and deploy the contracts:

```bash
cd program
anchor build
anchor deploy
```
*Note: Ensure your `Anchor.toml` and program IDs inside `lib.rs` are properly configured for the Solana Devnet.*

### 3. Backend Setup

The backend powers the AI agents, the Prisma database, and the institutional market bridge.

```bash
cd backend
bun install
bunx prisma db push
bun dev
```
*The backend will start on `http://localhost:3000`. It will automatically execute the heavy market sync asynchronously without blocking the API.*

### 4. Frontend Setup

```bash
cd frontend
bun install
bun dev
```
*The application will be available at `http://localhost:8080`. Connect your Phantom wallet (on Devnet) to start trading!*

---

## 📖 Architecture Overview

1. **The Protocol Layer:** Solana smart contracts handle the escrow, share minting, order execution, and final market resolution.
2. **The Oracle Layer:** An AI-driven off-chain oracle service that securely resolves markets by fetching verified real-world data, summarizing it, and submitting the outcome on-chain.
3. **The Data & Agent Layer:** A highly optimized Node.js backend syncing thousands of markets, orderbooks, and price histories while hosting the autonomous trading agents.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/HA2345567/Heliora/issues).

## 📄 License

This project is licensed under the **MIT License**.
