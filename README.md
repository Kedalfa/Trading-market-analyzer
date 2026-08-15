# 📈 Smart Money Concepts (SMC) Market Analyzer

AI-Assisted Market Analysis & Institutional Microstructure Platform for Traders.

---

## 🏗 Architecture Overview

The platform is split into two dedicated, decoupled services:

```
Trading market analyzer/
├── backend/                       # Express.js REST API + MongoDB (Node.js & TypeScript)
│   ├── src/
│   │   ├── config/                # MongoDB connection & env configuration
│   │   ├── models/                # Mongoose Models (Instrument, Analysis, TradeIdea, UserSettings)
│   │   ├── routes/                # REST API endpoints (/api/instruments, /api/market-data, etc.)
│   │   ├── services/              # Binance live candle service, dynamic calendar, seed service
│   │   └── server.ts              # Express HTTP server
│   ├── .env                       # MongoDB URI & backend environment variables
│   ├── .env.example
│   └── package.json
│
├── frontend/                      # Next.js 16 Pro Terminal UI (React 19, Tailwind CSS)
│   ├── src/
│   │   ├── app/                   # App Router & page orchestration
│   │   ├── components/            # Institutional Trading Chart, Overlays, Analysis Panels, Modals
│   │   ├── engine/                # Deterministic SMC Mathematical Engines (Swings, Liquidity, FVG, OB)
│   │   ├── services/              # api.ts (Central HTTP client for all MongoDB backend calls)
│   │   └── types/                 # Domain-driven TypeScript schemas
│   ├── .env.local                 # Frontend environment (NEXT_PUBLIC_BACKEND_URL)
│   └── package.json
│
└── package.json                   # Root orchestrator with concurrently
```

---

## 🚀 Quick Start

### 1. Configure MongoDB Connection

In `backend/.env`, set your MongoDB connection string (MongoDB Atlas cloud URI or local):

```env
MONGODB_URI=mongodb://localhost:27017/smc-analyzer
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/smc-analyzer?retryWrites=true&w=majority

PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
```

### 2. Run Both Services Concurrently

From the repository root:

```bash
# Run both backend & frontend together with formatted colored logs
npm run dev
```

Or run them individually:

```bash
# Start backend on http://localhost:4000
npm run dev:backend

# Start frontend on http://localhost:3000
npm run dev:frontend
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend server health status |
| `GET` | `/api/instruments` | List active instruments from MongoDB |
| `GET` | `/api/market-data/:id?timeframe=15M` | Live Binance/fallback OHLCV candles |
| `GET` | `/api/news/:id` | Dynamic economic calendar events |
| `POST` | `/api/analyses` | Save analysis snapshot to MongoDB |
| `GET` | `/api/analyses` | Query saved analyses with filtering |
| `PATCH` | `/api/analyses/:id/outcome` | Update trade outcome & performance |
| `DELETE` | `/api/analyses/:id` | Delete saved analysis |
| `POST` | `/api/trade-ideas` | Save position size & execution plan |
| `GET` | `/api/trade-ideas` | Query saved trade ideas |
| `GET` | `/api/settings` | Get user risk & workspace preferences |
| `PATCH` | `/api/settings/risk` | Persist risk settings to MongoDB |

---

## 🧠 Core Features

- **No Hardcoded Data**: Instruments, user preferences, risk settings, trade ideas, and analyses are dynamically managed through MongoDB.
- **Deterministic SMC Engines**: High-precision detection of Swings, Liquidity Sweeps, Fair Value Gaps (FVG), Order Blocks, Dealing Ranges, and Market Structure Shifts (MSS / BOS).
- **Institutional Trading Terminal**: Dark-mode charting powered by Lightweight Charts with custom SVG overlay layers.
- **Risk Calculator**: Dynamic lot sizing and position calculation with settings persisted directly to MongoDB.
- **History & Journaling**: Query past setups, track outcomes (Target Hit, Stopped Out, Invalidated), and calculate forward returns.
