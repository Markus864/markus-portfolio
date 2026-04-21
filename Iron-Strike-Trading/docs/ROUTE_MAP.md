# IronStrike Options Trading Platform - Complete Route Map

**Platform URL:** www.ironstriketrading.com  
**Document Purpose:** Complete route inventory for AI analysis and competitive comparison  
**Last Updated:** December 2024  
**Total Frontend Routes:** 37 pages  
**Total Backend API Endpoints:** 96  

---

## Table of Contents

1. [Frontend Routes - Public](#frontend-routes---public)
2. [Frontend Routes - Protected App](#frontend-routes---protected-app)
3. [Backend API - Authentication & Webhooks](#backend-api---authentication--webhooks)
4. [Backend API - System & Health](#backend-api---system--health)
5. [Backend API - Signal Generation](#backend-api---signal-generation)
6. [Backend API - Market Data](#backend-api---market-data)
7. [Backend API - Trade Management](#backend-api---trade-management)
8. [Backend API - Trading Journal](#backend-api---trading-journal)
9. [Backend API - Strategy Management](#backend-api---strategy-management)
10. [Backend API - Analytics & Performance](#backend-api---analytics--performance)
11. [Backend API - Adaptive Learning](#backend-api---adaptive-learning)
12. [Backend API - Machine Learning](#backend-api---machine-learning)
13. [Backend API - AI Features](#backend-api---ai-features)
14. [Backend API - Watchlist & Alerts](#backend-api---watchlist--alerts)
15. [Backend API - Market Intelligence](#backend-api---market-intelligence)
16. [Backend API - Support Tickets](#backend-api---support-tickets)
17. [Backend API - Admin & Email](#backend-api---admin--email)
18. [Backend API - Billing (Stripe)](#backend-api---billing-stripe)
19. [Backend API - Account & Settings](#backend-api---account--settings)
20. [Backend API - Developer/Debug](#backend-api---developerdebug)
21. [Navigation Structure](#navigation-structure)
22. [Page Component Inventory](#page-component-inventory)

---

## Frontend Routes - Public

These routes are accessible without authentication.

| Route | Page Component | File Path | Purpose |
|-------|----------------|-----------|---------|
| `/` | Landing | `client/src/pages/Landing.tsx` | Premium landing page with hero section, feature highlights, pricing preview, testimonials |
| `/pricing` | Pricing | `client/src/pages/Pricing.tsx` | Subscription tier comparison (Free/Pro/Premium) with Stripe checkout integration |
| `/terms` | Terms | `client/src/pages/Terms.tsx` | Terms of Service legal document |
| `/privacy` | Privacy | `client/src/pages/Privacy.tsx` | Privacy Policy legal document |
| `/risk-disclosure` | RiskDisclosure | `client/src/pages/RiskDisclosure.tsx` | Trading risk disclosure and disclaimers |
| `/disclaimer` | Disclaimer | `client/src/pages/Disclaimer.tsx` | Legal disclaimer for trading signals |
| `/contact` | Contact | `client/src/pages/Contact.tsx` | Contact form for user inquiries |
| `/changelog` | Changelog | `client/src/pages/Changelog.tsx` | Platform updates and version history |
| `/how-it-works` | HowItWorks | `client/src/pages/HowItWorks.tsx` | Explanation of platform functionality |
| `/methodology` | Methodology | `client/src/pages/Methodology.tsx` | Signal generation methodology documentation |
| `/commands` | BotCommands | `client/src/pages/BotCommands.tsx` | Discord/Telegram bot command reference (52 commands) |
| `/billing/success` | BillingSuccess | `client/src/pages/BillingSuccess.tsx` | Post-payment confirmation page |
| `*` (catch-all) | NotFound | `client/src/pages/not-found.tsx` | 404 error page for unmatched routes |

**Total Public Routes: 13**

---

## Frontend Routes - Protected App

These routes require Clerk authentication. All protected routes include:
- Collapsible sidebar navigation
- Floating AI Chatbot component
- Footer component
- Error boundary wrapper

| Route | Page Component | File Path | Purpose |
|-------|----------------|-----------|---------|
| `/app` | Dashboard | `client/src/pages/Dashboard.tsx` | Main dashboard with overview widgets, recent signals, portfolio snapshot |
| `/app/home` | Home | `client/src/pages/Home.tsx` | Personalized home page with user-specific content |
| `/app/control-center` | ControlCenter | `client/src/pages/ControlCenter.tsx` | Admin/developer control panel (developer-only) |
| `/app/live` | LiveSignals | `client/src/pages/LiveSignals.tsx` | Real-time AI trading signal feed with live updates |
| `/app/generator` | SignalGenerator | `client/src/pages/SignalGenerator.tsx` | On-demand signal generation with custom parameters |
| `/app/history` | HistoryPage | `client/src/pages/History.tsx` | Historical signal archive with filtering and search |
| `/app/charts` | Charts | `client/src/pages/Charts.tsx` | TradingView-style interactive charts |
| `/app/chart-analysis` | ChartAnalysis | `client/src/pages/ChartAnalysis.tsx` | AI-powered chart pattern recognition and analysis |
| `/app/screener` | OptionsScreener | `client/src/pages/OptionsScreener.tsx` | Options contract screener with filtering |
| `/app/0dte` | ZeroDTEHub | `client/src/pages/ZeroDTEHub.tsx` | Zero-days-to-expiration trading signals |
| `/app/whales` | WhaleTracker | `client/src/pages/WhaleTracker.tsx` | Large institutional options flow tracking |
| `/app/earnings` | EarningsPlays | `client/src/pages/EarningsPlays.tsx` | Earnings-based trading strategies and calendar |
| `/app/portfolio` | PortfolioAnalytics | `client/src/pages/PortfolioAnalytics.tsx` | Portfolio management and trading journal |
| `/app/watchlist` | Watchlist | `client/src/pages/Watchlist.tsx` | Symbol watchlist management |
| `/app/alerts` | Alerts | `client/src/pages/Alerts.tsx` | Price alert configuration and management |
| `/app/strategies` | Strategies | `client/src/pages/Strategies.tsx` | Trading strategy creation and management |
| `/app/calculator` | CalculatorPage | `client/src/pages/Calculator.tsx` | Options profit/loss calculator |
| `/app/news` | MarketNews | `client/src/pages/MarketNews.tsx` | Market news aggregation with sentiment analysis |
| `/app/analytics-kpis` | AnalyticsKpis | `client/src/pages/AnalyticsKpis.tsx` | Performance KPI dashboard |
| `/app/strategy-performance` | StrategyPerformance | `client/src/pages/StrategyPerformance.tsx` | Strategy performance metrics and comparison |
| `/app/confidence-calibration` | ConfidenceCalibration | `client/src/pages/ConfidenceCalibration.tsx` | AI confidence accuracy tracking and calibration |
| `/app/user-vs-ai` | UserVsAI | `client/src/pages/UserVsAI.tsx` | User trade performance vs AI signal comparison |
| `/app/settings` | AccountSettings | `client/src/pages/AccountSettings.tsx` | User account settings and preferences |
| `/app/support-tickets` | SupportTickets | `client/src/pages/SupportTickets.tsx` | Support ticket submission and tracking |

**Total Protected Routes: 24**

---

## Backend API - Authentication & Webhooks

| Method | Endpoint | Auth Required | Rate Limited | Purpose |
|--------|----------|---------------|--------------|---------|
| POST | `/api/webhooks/clerk` | No | No | Clerk authentication webhook handler |
| POST | `/api/webhooks/stripe` | No | No | Stripe payment webhook handler |
| POST | `/integrations/telegram/webhook/:secret` | No | No | Telegram bot webhook endpoint |
| GET | `/api/auth/user` | Yes | No | Get current authenticated user details |
| GET | `/api/user/tier` | Yes | No | Get user subscription tier (free/pro/premium) |

---

## Backend API - System & Health

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/health` | No | System health check with database status |
| GET | `/api/status` | No | Detailed system status and version info |
| GET | `/api/market/pulse` | No | Real-time market pulse data |

---

## Backend API - Signal Generation

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/signals` | No | Generate AI trading signal for symbol |
| POST | `/api/signals/hybrid` | No | Generate hybrid ML+GPT signal (60% ML, 40% GPT) |
| GET | `/api/signals/0dte` | No | Get zero-days-to-expiration signals |
| GET | `/api/live-signals` | No | Live signal feed with real-time updates |
| GET | `/api/history` | No | Get all historical signals |
| GET | `/api/history/:symbol` | No | Get symbol-specific signal history |

---

## Backend API - Market Data

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/quote/:symbol` | No | Get single stock quote from Tradier |
| POST | `/api/quotes` | No | Get batch quotes for multiple symbols |
| GET | `/api/chart/:symbol` | No | Get OHLCV chart data for symbol |
| POST | `/api/analyze-chart` | No | AI-powered chart pattern analysis |

---

## Backend API - Trade Management

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/trades` | Yes | Create new trade from signal |
| GET | `/api/trades` | Yes | Get all user trades |
| GET | `/api/trades/open` | Yes | Get open positions only |
| GET | `/api/trades/closed` | Yes | Get closed trades only |
| GET | `/api/trades/filtered` | Yes | Get filtered trades with query params |
| POST | `/api/trades/manual` | Yes | Create manual trade entry |
| POST | `/api/trades/parse-screenshot` | Yes | AI screenshot parsing (Vision API) |
| PATCH | `/api/trades/:id` | Yes | Update existing trade |
| POST | `/api/trades/:id/close` | Yes | Close an open trade |

---

## Backend API - Trading Journal

| Method | Endpoint | Auth Required | Tier Gated | Purpose |
|--------|----------|---------------|------------|---------|
| GET | `/api/journal` | Yes | No | Get all journal entries |
| GET | `/api/journal/trade/:tradeId` | Yes | No | Get journal entry for specific trade |
| POST | `/api/journal` | Yes | No | Create new journal entry |
| DELETE | `/api/journal/:id` | Yes | No | Delete journal entry |
| GET | `/api/journal/summary` | Yes | Yes (Pro+) | Get journal performance summary with R-multiples |

---

## Backend API - Strategy Management

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/strategies` | No | Get all trading strategies |
| GET | `/api/strategies/enabled` | No | Get enabled strategies only |
| GET | `/api/strategies/:id` | No | Get single strategy by ID |
| POST | `/api/strategies` | Yes | Create new strategy |
| PATCH | `/api/strategies/:id` | Yes | Update existing strategy |
| DELETE | `/api/strategies/:id` | Yes | Delete strategy |
| POST | `/api/strategies/:id/backtest` | Yes | Run backtest on strategy |
| POST | `/api/strategies/evaluate` | No | Evaluate strategy performance |
| POST | `/api/strategies/ml-evaluate` | Yes | ML-based strategy evaluation |
| POST | `/api/strategies/migrate` | Yes | Migrate legacy strategies |

---

## Backend API - Analytics & Performance

| Method | Endpoint | Auth Required | Tier Gated | Purpose |
|--------|----------|---------------|------------|---------|
| GET | `/api/performance` | No | No | Overall platform performance metrics |
| GET | `/api/analytics` | Yes | Yes | Full analytics dashboard data |
| GET | `/api/analytics/kpis` | Yes | Yes (Pro+) | Key performance indicators |
| GET | `/api/analytics/strategy-performance` | Yes | Yes (Pro+) | Strategy-level performance metrics |
| GET | `/api/analytics/confidence-calibration` | Yes | Yes (Pro+) | AI confidence accuracy analysis |
| GET | `/api/analytics/user-vs-ai` | Yes | Yes (Pro+) | User trades vs AI signals comparison |
| GET | `/api/analytics/mistake-detector` | Yes | Yes (Premium) | Trading mistake pattern analysis |
| GET | `/api/portfolio/summary` | No | No | Portfolio summary data |

---

## Backend API - Adaptive Learning

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/learning/status` | No | Adaptive learning system status |
| GET | `/api/learning/:symbol` | No | Symbol-specific learning metrics |
| GET | `/api/adaptive/summary` | Yes | Adaptive learning summary (tier-gated) |

---

## Backend API - Machine Learning

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/ml/status` | No | TensorFlow.js model status |
| POST | `/api/ml/train` | No | Train ML model on historical data |
| POST | `/api/ml/predict` | No | Get ML prediction for symbol |
| POST | `/api/ml/features` | No | Compute feature vectors |
| POST | `/api/ml/backtest` | No | Run ML model backtest |

---

## Backend API - AI Features

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/api/chat` | No | AI chatbot conversation |
| POST | `/api/ai/trade-review` | Yes | AI-powered trade review and coaching |
| POST | `/api/ai/portfolio-insights` | Yes | AI portfolio analysis insights |

---

## Backend API - Watchlist & Alerts

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/watchlist` | Yes | Get user watchlist |
| POST | `/api/watchlist` | Yes | Add symbol to watchlist |
| DELETE | `/api/watchlist/:id` | Yes | Remove from watchlist |
| GET | `/api/alerts` | Yes | Get user price alerts |
| POST | `/api/alerts` | Yes | Create new price alert |
| PATCH | `/api/alerts/:id` | Yes | Update existing alert |
| DELETE | `/api/alerts/:id` | Yes | Delete alert |
| POST | `/api/alerts/:id/toggle` | Yes | Toggle alert active/inactive |

---

## Backend API - Market Intelligence

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/news` | No | Market news with sentiment analysis |
| GET | `/api/news/categories` | No | News category taxonomy |
| GET | `/api/trends` | No | Market trend analysis |
| GET | `/api/screener` | No | Options contract screener |
| GET | `/api/screener/status` | No | Screener data freshness status |
| POST | `/api/screener/refresh` | No | Force refresh screener data |
| GET | `/api/whales` | No | Institutional whale activity |
| GET | `/api/earnings` | No | Earnings calendar and plays |

---

## Backend API - Support Tickets

| Method | Endpoint | Auth Required | Rate Limited | Purpose |
|--------|----------|---------------|--------------|---------|
| POST | `/api/tickets` | No | Yes (3/hour) | Create support ticket |
| GET | `/api/tickets` | Yes (Admin) | No | Get all tickets (admin only) |
| GET | `/api/tickets/:id` | Yes | No | Get single ticket |
| PATCH | `/api/tickets/:id` | Yes | No | Update ticket status |
| GET | `/api/my-tickets` | Yes | No | Get user's own tickets |

---

## Backend API - Admin & Email

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/admin/email/status` | Yes (Admin) | Email service status (AWS SES) |
| POST | `/api/admin/email/test` | Yes (Admin) | Send test email |
| POST | `/api/admin/email/send` | Yes (Admin) | Send custom email |

---

## Backend API - Billing (Stripe)

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/billing/config` | No | Get Stripe publishable key config |
| POST | `/api/billing/create-checkout-session` | Yes | Create Stripe checkout session |
| GET | `/api/billing/confirm` | Yes | Confirm successful payment |
| POST | `/api/billing/portal` | Yes | Access Stripe customer portal |

---

## Backend API - Account & Settings

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/account/settings` | Yes | Get user account settings |
| PUT | `/api/account/settings` | Yes | Update user account settings |
| GET | `/api/onboarding/status` | Yes | Get user onboarding progress |

---

## Backend API - Developer/Debug

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/api/debug/last-signal` | Yes | Debug: get last generated signal |
| GET | `/api/debug/adaptive` | Yes | Debug: adaptive learning state |
| GET | `/api/export/codebase` | No | Export codebase as text |
| GET | `/api/export/codebase-zip` | No | Export codebase as ZIP archive |

---

## Navigation Structure

```
PUBLIC PAGES
├── Landing (/)
│   ├── Hero Section
│   ├── Feature Highlights
│   ├── Pricing Preview
│   └── Call-to-Action → Login
├── Pricing (/pricing)
├── How It Works (/how-it-works)
├── Methodology (/methodology)
├── Bot Commands (/commands)
├── Contact (/contact)
├── Changelog (/changelog)
└── Legal
    ├── Terms (/terms)
    ├── Privacy (/privacy)
    ├── Risk Disclosure (/risk-disclosure)
    └── Disclaimer (/disclaimer)

AUTHENTICATED APP (Requires Login)
├── Dashboard (/app) - Main overview
├── Home (/app/home) - Personalized feed
│
├── SIGNALS SECTION
│   ├── Live Signals (/app/live) - Real-time feed
│   ├── Signal Generator (/app/generator) - On-demand
│   ├── 0DTE Hub (/app/0dte) - Zero-day expiry
│   └── History (/app/history) - Historical archive
│
├── ANALYSIS SECTION
│   ├── Charts (/app/charts) - TradingView-style
│   ├── Chart Analysis (/app/chart-analysis) - AI patterns
│   ├── Options Screener (/app/screener) - Filtering
│   ├── Whale Tracker (/app/whales) - Institutional flow
│   └── Earnings Plays (/app/earnings) - Earnings strategies
│
├── PORTFOLIO SECTION
│   ├── Portfolio Analytics (/app/portfolio) - Journal + tracking
│   ├── Strategies (/app/strategies) - Strategy management
│   ├── Watchlist (/app/watchlist) - Symbol tracking
│   └── Alerts (/app/alerts) - Price alerts
│
├── ANALYTICS SECTION
│   ├── KPIs (/app/analytics-kpis) - Performance metrics
│   ├── Strategy Performance (/app/strategy-performance)
│   ├── Confidence Calibration (/app/confidence-calibration)
│   └── User vs AI (/app/user-vs-ai) - Comparison
│
├── TOOLS SECTION
│   ├── Calculator (/app/calculator) - P&L calculator
│   └── Market News (/app/news) - News feed
│
├── ACCOUNT SECTION
│   ├── Settings (/app/settings) - Account preferences
│   └── Support Tickets (/app/support-tickets) - Help
│
└── DEVELOPER (Hidden)
    └── Control Center (/app/control-center) - Admin panel

FLOATING COMPONENTS (All /app/* pages)
└── AI Chatbot - Persistent chat interface
```

---

## Page Component Inventory

All page components are located in `client/src/pages/`.

| Component | File | Lines (Approx) | Key Features |
|-----------|------|----------------|--------------|
| Landing | Landing.tsx | 500+ | Hero, features grid, pricing cards, testimonials |
| Dashboard | Dashboard.tsx | 400+ | Widget grid, recent signals, quick actions |
| Home | Home.tsx | 300+ | Personalized content, notifications |
| LiveSignals | LiveSignals.tsx | 400+ | Real-time signal feed, filtering |
| SignalGenerator | SignalGenerator.tsx | 500+ | Form, AI generation, results display |
| HistoryPage | History.tsx | 350+ | Signal archive, search, pagination |
| Charts | Charts.tsx | 400+ | TradingView integration, indicators |
| ChartAnalysis | ChartAnalysis.tsx | 450+ | AI pattern recognition, annotations |
| OptionsScreener | OptionsScreener.tsx | 500+ | Multi-criteria filtering, sorting |
| ZeroDTEHub | ZeroDTEHub.tsx | 400+ | 0DTE signals, expiration tracking |
| WhaleTracker | WhaleTracker.tsx | 350+ | Large order flow, institutional activity |
| EarningsPlays | EarningsPlays.tsx | 400+ | Earnings calendar, strategy suggestions |
| PortfolioAnalytics | PortfolioAnalytics.tsx | 600+ | Journal, trades, analytics charts |
| Watchlist | Watchlist.tsx | 300+ | Symbol management, quick quotes |
| Alerts | Alerts.tsx | 350+ | Alert CRUD, notification preferences |
| Strategies | Strategies.tsx | 450+ | Strategy builder, backtesting |
| CalculatorPage | Calculator.tsx | 300+ | Options P&L calculator |
| MarketNews | MarketNews.tsx | 350+ | News feed, sentiment analysis |
| AnalyticsKpis | AnalyticsKpis.tsx | 400+ | KPI dashboard, charts |
| StrategyPerformance | StrategyPerformance.tsx | 400+ | Strategy comparison |
| ConfidenceCalibration | ConfidenceCalibration.tsx | 350+ | AI accuracy tracking |
| UserVsAI | UserVsAI.tsx | 400+ | Performance comparison |
| AccountSettings | AccountSettings.tsx | 350+ | User preferences, tier info |
| SupportTickets | SupportTickets.tsx | 300+ | Ticket submission, tracking |
| ControlCenter | ControlCenter.tsx | 500+ | Admin tools, system controls |
| Pricing | Pricing.tsx | 400+ | Tier comparison, Stripe checkout |
| BillingSuccess | BillingSuccess.tsx | 150+ | Payment confirmation |
| Terms | Terms.tsx | 200+ | Legal document |
| Privacy | Privacy.tsx | 200+ | Legal document |
| RiskDisclosure | RiskDisclosure.tsx | 200+ | Legal document |
| Disclaimer | Disclaimer.tsx | 200+ | Legal document |
| Contact | Contact.tsx | 250+ | Contact form |
| Changelog | Changelog.tsx | 200+ | Version history |
| HowItWorks | HowItWorks.tsx | 300+ | Platform explanation |
| Methodology | Methodology.tsx | 300+ | Technical documentation |
| BotCommands | BotCommands.tsx | 400+ | 52 command reference |
| NotFound | not-found.tsx | 100+ | 404 error page |

---

## Route Statistics Summary

| Category | Count |
|----------|-------|
| **Frontend - Public Routes** | 13 |
| **Frontend - Protected Routes** | 24 |
| **Frontend - Total Pages** | 37 |
| **Backend - Auth/Webhook Endpoints** | 5 |
| **Backend - System/Health Endpoints** | 3 |
| **Backend - Signal Endpoints** | 6 |
| **Backend - Market Data Endpoints** | 4 |
| **Backend - Trade Endpoints** | 9 |
| **Backend - Journal Endpoints** | 5 |
| **Backend - Strategy Endpoints** | 10 |
| **Backend - Analytics Endpoints** | 8 |
| **Backend - Adaptive Learning Endpoints** | 3 |
| **Backend - ML Endpoints** | 5 |
| **Backend - AI Endpoints** | 3 |
| **Backend - Watchlist/Alert Endpoints** | 8 |
| **Backend - Market Intelligence Endpoints** | 8 |
| **Backend - Support Ticket Endpoints** | 5 |
| **Backend - Admin/Email Endpoints** | 3 |
| **Backend - Billing Endpoints** | 4 |
| **Backend - Account Endpoints** | 3 |
| **Backend - Debug Endpoints** | 4 |
| **Backend - Total API Endpoints** | 96 |

---

## File Location Reference

```
project-root/
├── client/
│   └── src/
│       ├── App.tsx                    # Router configuration
│       ├── pages/                     # All 37 page components
│       ├── components/
│       │   ├── layout/
│       │   │   └── AppSidebar.tsx     # Sidebar navigation
│       │   ├── AIChatbot.tsx          # Floating chatbot
│       │   ├── ProtectedRoute.tsx     # Auth wrapper
│       │   └── Footer.tsx             # Page footer
│       └── lib/
│           └── queryClient.ts         # TanStack Query config
├── server/
│   ├── routes.ts                      # All 96 API endpoints
│   ├── storage.ts                     # Database operations
│   ├── adaptive-learning.ts           # Adaptive learning system
│   ├── market-data-service.ts         # Tradier API integration
│   ├── email-service.ts               # AWS SES email
│   ├── command-registry.ts            # 52 bot commands
│   └── ml/
│       ├── ml-service.ts              # TensorFlow.js models
│       ├── feature-engine.ts          # Feature computation
│       └── backtest-engine.ts         # ML backtesting
└── shared/
    └── schema.ts                      # Database schema + Zod types
```

---

**End of Route Map Document**
