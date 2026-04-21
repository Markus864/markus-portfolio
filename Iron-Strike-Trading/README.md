# Iron Strike Trading

A full-stack AI-powered options trading signal platform built with React, TypeScript, and Node.js.

## Overview

Iron Strike Trading provides retail traders with professional-grade options signal tools — combining AI-generated signals, real-time market data, strategy backtesting, and a subscription tier system.

## Features

- **Live Signals** — AI-generated options trade signals with confidence scoring
- **Strategy Engine** — Backtesting framework with performance analytics
- **Chart Analysis** — Integrated TradingView charts with custom overlays and indicators
- **AI Coaching** — Adaptive learning panel and AI chatbot for trade guidance
- **Options Screener** — Real-time options chain scanner with filters
- **Earnings Plays** — Pre-earnings volatility trade setups
- **Zero DTE Hub** — Same-day expiry trade tracking and management
- **Whale Tracker** — Large options flow detection
- **Portfolio Analytics** — P&L tracking, win rate, and performance KPIs
- **Subscription Billing** — Stripe-powered Pro and Premium tiers with usage entitlements
- **User Management** — Clerk authentication with role-based access control

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL (Drizzle ORM) |
| **Auth** | Clerk |
| **Payments** | Stripe |
| **Market Data** | Tradier API, Polygon.io, Finnhub |
| **AI** | OpenAI API |
| **Charts** | TradingView Lightweight Charts |
| **Notifications** | Telegram Bot, Discord Webhook, AWS SES |
| **Infrastructure** | Docker, AWS ECS, AWS ECR, AWS CodeCommit |
| **Testing** | Playwright (E2E) |

## Project Structure

```
Iron-Strike-Trading/
├── components/         # Reusable UI components
│   ├── charts/         # TradingView chart wrappers
│   ├── layout/         # App shell (sidebar, topnav)
│   └── ui/             # shadcn/ui component library
├── pages/              # Route-level page components
├── server/             # Node.js backend
│   ├── config/         # Environment config and risk profiles
│   ├── ai/             # AI signal engine and assistants
│   ├── ml/             # ML strategy engine and backtesting
│   ├── risk/           # Position sizing logic
│   └── services/       # External API integrations
├── shared/             # Shared types and DB schema (Drizzle)
├── hooks/              # React custom hooks
├── lib/                # Utility functions
├── api/                # Client-side API layer
├── types/              # TypeScript type definitions
├── e2e/                # Playwright end-to-end tests
├── assets/             # Brand assets and favicons
├── public/             # Static files
├── docs/               # Architecture docs, schema exports, strategy guides
├── status_reports/     # Deployment and status CSVs
├── Dockerfile          # Container build
├── buildspec.yml       # AWS CodeBuild pipeline
├── deploy.sh           # Deployment helper script
└── package.json
```

## Environment Variables

All secrets are loaded from environment variables. Create a `.env` file from the example below — never commit real values:

```env
DATABASE_URL=
SESSION_SECRET=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
OPENAI_API_KEY=
TRADIER_API_KEY=
FINNHUB_API_KEY=
TELEGRAM_BOT_TOKEN=
DISCORD_WEBHOOK_URL=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Getting Started

```bash
npm install
npm run dev
```
