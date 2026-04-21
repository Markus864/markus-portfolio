# IronStrike Trading Platform - Comprehensive Audit Documentation

**Version:** 1.0.0  
**Last Updated:** December 20, 2025  
**Domain:** www.ironstriketrading.com  
**Purpose:** External AI audit for competitive analysis against quantvue.io

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Model & Tier Structure](#business-model--tier-structure)
3. [Platform Features Inventory](#platform-features-inventory)
4. [Technical Architecture](#technical-architecture)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Database Schema](#database-schema)
7. [Bot Commands Reference (52 Commands)](#bot-commands-reference-52-commands)
8. [Email Infrastructure](#email-infrastructure)
9. [Security Measures](#security-measures)
10. [Integrations & External Services](#integrations--external-services)
11. [Competitive Differentiators](#competitive-differentiators)
12. [Areas for Improvement](#areas-for-improvement)

---

## Executive Summary

IronStrike Trading is an AI-powered options trading platform that provides intelligent trading signals with confidence scoring, contract sizing, and premium-based risk management. The platform operates across web, Discord, and Telegram with 52+ commands supporting tiered access (Free/Pro/Premium).

### Core Value Proposition
- **AI-Powered Signal Generation:** Uses GPT-4o/GPT-5 for market analysis combined with technical indicators
- **Hybrid Intelligence:** 60% TensorFlow.js neural network + 40% GPT analysis for signal generation
- **Adaptive Learning System:** Adjusts confidence grades (A-F) based on historical performance
- **Multi-Platform Access:** Web app, Discord bot, Telegram bot with unified command structure
- **Risk Management:** Premium-based position sizing with 5 risk profiles

### Key Metrics
- **52 bot commands** across Discord and Telegram
- **3 subscription tiers** (Free, Pro $19/mo, Premium $49/mo)
- **4 email sender personas** for AWS SES
- **20+ API endpoints** for web application
- **Real options chain data** from Tradier API with Greeks

---

## Business Model & Tier Structure

### Subscription Tiers

| Feature | Free | Pro ($19/mo) | Premium ($49/mo) |
|---------|------|--------------|------------------|
| Real-time Quotes | Yes | Yes | Yes |
| Technical Charts | Yes | Yes | Yes |
| Signal Preview (Basic) | Yes | Full | Full + Adaptive |
| Technical Indicators | - | RSI, MACD, EMA, SMA, VWAP | All |
| Market Data (Earnings, Float) | - | Yes | Yes |
| Options Chain Data | - | - | Yes |
| Greeks (Delta, Gamma, Theta, Vega) | - | - | Yes |
| AI Analysis & Sentiment | - | - | Yes |
| AI Chatbot | 10 req/min | 100 req/min | Unlimited |
| Screenshot Trade Parsing | - | GPT-4o-mini | GPT-4o |
| Portfolio Analytics | - | - | Yes |
| Trading Journal | Basic | Tags, Emotions | Full + AI Coaching |
| ML Strategy Engine | - | - | Yes |
| Price Alerts | - | 5 | Unlimited |
| Email Notifications | - | Transactional | All types |

### Revenue Streams
1. **Subscription Revenue:** Monthly recurring from Pro/Premium tiers
2. **Annual Discounts:** Yearly subscriptions for cost savings
3. **Potential Future:** Affiliate revenue from broker partnerships

---

## Platform Features Inventory

### Web Application Features

#### 1. Signal Generator
- AI-powered options trading signals (BUY_CALL/BUY_PUT/SELL_CALL/SELL_PUT/HOLD)
- Confidence scores (0-100%)
- Contract recommendations with strike, expiry, premium
- Position sizing based on account size and risk profile
- Greeks display (Premium only)
- Reasoning and pattern analysis

#### 2. Live Options Scanner
- Real-time scanning of 50+ symbols
- Natural language query parsing ("find cheap calls under $2")
- Filter by premium, delta, expiry, volume
- Cache status monitoring

#### 3. Trading Journal
- Manual trade logging
- Strategy tagging and categorization
- Emotional state tracking (calm, confident, anxious, fearful, greedy, frustrated)
- Session tags (premarket, us_open, midday, power_hour, afterhours)
- R-multiple tracking for risk management
- Screenshot parsing with AI (Pro+)
- AI trade coaching (Premium)

#### 4. Portfolio Analytics
- Total P&L tracking
- Win rate calculation
- Profit factor and expectancy
- Best/worst trade identification
- Equity curve generation
- Strategy performance comparison
- Confidence calibration analysis

#### 5. Adaptive Learning System
- Symbol-level performance tracking
- Confidence grade adjustment (A-F) based on outcomes
- Historical win rate integration into signals
- Performance trend indicators

#### 6. ML Strategy Engine (Premium Only)
- Custom training dataset creation
- Logistic regression model training
- Backtesting with historical data
- Model performance evaluation

#### 7. Price Alerts
- Multi-symbol monitoring
- Above/below price triggers
- Discord, Telegram, Email notifications
- Tier-based alert limits

#### 8. AI Chatbot
- Floating assistant on all pages
- Trading-focused conversations
- Context-aware responses
- Tier-based rate limiting

#### 9. Chart Analysis
- Technical chart display
- Multiple timeframes (1D, 5D, 1M, 3M, 6M, 1Y)
- Interval options (5min, 15min, 30min, 1hour, 4hour)

#### 10. Support Ticket System
- Web form submission
- Automatic ticket numbering (IST-1001, IST-1002...)
- Email confirmation via AWS SES
- Admin dashboard for ticket management
- Rate limiting (3 requests/hour per IP)

---

## Technical Architecture

### Frontend Stack
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter
- **State Management:** TanStack Query (React Query v5)
- **UI Components:** shadcn/ui (New York style) + Radix UI
- **Styling:** Tailwind CSS with dark theme + emerald accents
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

### Backend Stack
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon serverless)
- **ORM:** Drizzle ORM
- **AI:** OpenAI GPT-4o/GPT-5 via Replit AI Integrations
- **ML:** TensorFlow.js for neural network models
- **Authentication:** Clerk with webhooks
- **Payments:** Stripe with subscription management

### Infrastructure
- **Hosting:** Replit (development), AWS App Runner (production)
- **Database:** Neon PostgreSQL (serverless)
- **Email:** AWS SES with verified domain
- **Storage:** AWS S3 for Polygon.io flat files

### Code Organization
```
/client           # React frontend
  /src
    /components   # UI components
    /pages        # Route pages
    /hooks        # Custom hooks
    /lib          # Utilities
/server           # Express backend
  /config         # Environment config
  /services       # Business logic
  /utils          # Helpers
/shared           # Shared types/schemas
  schema.ts       # Drizzle schema + Zod validation
```

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/user` | Optional | Get current user |
| POST | `/api/webhooks/clerk` | Webhook | Clerk auth webhooks |

### Signals & Market Data
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| POST | `/api/signals` | Optional | All | Generate trading signals |
| GET | `/api/quote/:symbol` | No | Free | Real-time quote |
| POST | `/api/quotes` | No | Free | Multiple quotes |
| GET | `/api/chart/:symbol` | No | Free | Historical chart data |
| GET | `/api/history` | No | Free | Signal history |
| GET | `/api/history/:symbol` | No | Free | Symbol signal history |

### Trading & Portfolio
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| POST | `/api/trades` | Required | Pro+ | Execute trade |
| GET | `/api/trades` | Required | Pro+ | Get user trades |
| GET | `/api/trades/open` | Required | Pro+ | Open trades |
| GET | `/api/trades/closed` | Required | Pro+ | Closed trades |
| POST | `/api/trades/manual` | Required | Pro+ | Log manual trade |
| POST | `/api/trades/parse-screenshot` | Required | Pro+ | AI screenshot parsing |
| PATCH | `/api/trades/:id/close` | Required | Pro+ | Close trade |
| PATCH | `/api/trades/:id/journal` | Required | Pro+ | Update journal |

### Options
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| GET | `/api/options/:symbol/expirations` | No | Pro+ | Option expirations |
| GET | `/api/options/:symbol/chain` | No | Premium | Full options chain |

### Scanner
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| GET | `/api/scanner/search` | No | Premium | Live options scanner |
| GET | `/api/scanner/status` | No | Free | Scanner cache status |
| POST | `/api/scanner/scan` | No | Premium | On-demand symbol scan |

### Alerts
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| GET | `/api/alerts` | Required | Pro+ | Get user alerts |
| POST | `/api/alerts` | Required | Pro+ | Create alert |
| DELETE | `/api/alerts/:id` | Required | Pro+ | Delete alert |

### Analytics
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| GET | `/api/analytics/performance` | Required | Premium | Performance metrics |
| GET | `/api/analytics/equity-curve` | Required | Premium | Equity curve data |
| GET | `/api/adaptive/summary` | Required | Pro+ | Adaptive learning summary |

### ML Strategy
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| POST | `/api/ml/train` | Required | Premium | Train ML model |
| POST | `/api/ml/predict` | Required | Premium | Get ML prediction |
| POST | `/api/ml/backtest` | Required | Premium | Run backtest |

### Support
| Method | Endpoint | Auth | Tier | Description |
|--------|----------|------|------|-------------|
| POST | `/api/tickets` | No | Free | Create support ticket |
| GET | `/api/admin/tickets` | Required | Admin | Get all tickets |
| PATCH | `/api/admin/tickets/:id` | Required | Admin | Update ticket |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check (App Runner) |
| GET | `/api/status` | No | System status |
| GET | `/api/market/pulse` | No | Market session info |

---

## Database Schema

### Core Tables

#### `users`
- `id` (varchar PK) - Clerk user ID
- `email` (varchar)
- `firstName`, `lastName` (varchar)
- `role` (varchar) - free/pro/premium
- `profileImageUrl` (text)
- `discordId`, `telegramId` (varchar) - Bot linking
- `stripeCustomerId`, `stripeSubscriptionId` (varchar)
- `createdAt`, `updatedAt` (timestamp)

#### `signal_history`
- `id` (serial PK)
- `symbol`, `action`, `optionType`, `optionSide` (varchar)
- `strikePrice`, `expirationDate` (varchar)
- `currentPrice`, `premium`, `totalCost` (decimal)
- `contracts`, `contractMultiplier` (integer)
- `confidence` (decimal)
- Greeks: `delta`, `gamma`, `theta`, `vega` (decimal)
- `reasoning` (text)
- `accountSize`, `riskPercentage` (decimal)
- Audit fields: `asOfTimestamp`, `marketSession`, `aiModel`, `inputHash`
- `userId`, `tierAtGeneration` (varchar)
- `generatedAt` (timestamp)

#### `trade_executions`
- `id` (serial PK)
- `signalId` (integer FK) - Optional, for AI trades
- `userId` (varchar)
- Trade details: `symbol`, `action`, `optionType`, etc.
- Pricing: `entryPremium`, `exitPremium`, `totalCost`
- Status: `status` (open/won/lost), `profitLoss`, `profitLossPercent`
- Journal fields: `strategyTag`, `emotionalState`, `sessionTag`
- Reflections: `whatWentWell`, `whatWentWrong`, `lessonLearned`
- Risk: `plannedRiskPerTrade`, `realizedRMultiple`
- `executedAt`, `closedAt` (timestamp)

#### `price_alerts`
- `id` (serial PK)
- `userId` (varchar)
- `symbol`, `targetPrice` (varchar/decimal)
- `condition` (above/below)
- `notificationChannels` (jsonb) - discord/telegram/email
- `active` (boolean)
- `createdAt`, `triggeredAt` (timestamp)

#### `support_tickets`
- `id` (serial PK)
- `ticketNumber` (varchar) - IST-1001 format
- `email`, `name`, `subject`, `message` (varchar/text)
- `status` (open/in_progress/resolved/closed)
- `priority` (low/normal/high/urgent)
- `channel` (web/email/discord/telegram)
- `userId` (varchar) - Optional
- `createdAt`, `updatedAt`, `resolvedAt` (timestamp)

#### `adaptive_performance`
- `id` (serial PK)
- `symbol` (varchar)
- `totalSignals`, `winCount`, `lossCount` (integer)
- `winRate` (decimal)
- `confidenceGrade` (varchar) - A/B/C/D/F
- `lastUpdated` (timestamp)

#### `strategies`
- User-defined trading strategies for journaling
- `name`, `description`, `tags`, `color`

#### `sessions`
- PostgreSQL session storage for Clerk auth

---

## Bot Commands Reference (52 Commands)

### Core (Free Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/price <symbol>` | Get real-time stock quote | 2s |
| `/quote <symbol>` | Alias for /price | 2s |
| `/chart <symbol>` | Get technical chart | 5s |
| `/help` | Show all commands | 2s |
| `/start` | Bot introduction | 2s |
| `/connect` | Link account to platform | 0s |
| `/status` | Account status check | 2s |
| `/faq` | Common questions | 5s |
| `/signals` | View pricing info | 5s |

### Market Data (Pro Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/earnings <symbol>` | Earnings date info | 10s |
| `/dividends <symbol>` | Dividend information | 10s |
| `/float <symbol>` | Share float data | 10s |
| `/shortinterest <symbol>` | Short interest % | 10s |

### Technical Indicators (Pro Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/rsi <symbol>` | RSI indicator | 5s |
| `/macd <symbol>` | MACD indicator | 5s |
| `/ema <symbol>` | EMA indicator | 5s |
| `/sma <symbol>` | SMA indicator | 5s |
| `/vwap <symbol>` | VWAP indicator | 5s |
| `/support <symbol>` | Support levels | 5s |
| `/resistance <symbol>` | Resistance levels | 5s |

### Strategy & Signals (Pro Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/signal <symbol>` | Get latest signal | 10s |
| `/today` | Daily market outlook | 10s |
| `/weekly` | Weekly market outlook | 10s |
| `/strategy <symbol>` | Strategy finder | 10s |

### Risk Management (Pro Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/entry <symbol>` | Entry point calculator | 5s |
| `/stoploss <symbol> <price>` | Stop loss calculator | 5s |
| `/takeprofit <symbol> <price>` | Take profit calculator | 5s |
| `/risk <symbol>` | Risk analysis | 5s |
| `/position <account> <risk%>` | Position sizing | 5s |

### Alerts (Pro Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/alerts` | View active alerts | 5s |
| `/alert <symbol> <price> <above/below>` | Set price alert | 5s |

### Options Chain (Premium Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/options <symbol>` | Options chain summary | 10s |
| `/chain <symbol>` | Full options chain | 10s |
| `/iv <symbol>` | Implied volatility | 10s |
| `/greeks <symbol>` | Options Greeks | 10s |
| `/maxpain <symbol>` | Max pain calculation | 10s |
| `/openinterest <symbol>` | Open interest data | 10s |

### AI Analysis (Premium Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/analyze <symbol>` | Full AI analysis | 30s |
| `/sentiment <symbol>` | AI sentiment analysis | 30s |
| `/bias <symbol>` | AI directional bias | 30s |
| `/plan <symbol>` | AI trading plan | 30s |
| `/explain <topic>` | AI explanation | 30s |
| `/review <trade>` | AI trade review | 30s |
| `/ask <question>` | AI chat assistant | 15s |

### Portfolio (Premium Tier)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/portfolio` | Portfolio overview | 5s |
| `/positions` | Open positions | 5s |
| `/pnl` | Profit/Loss stats | 5s |
| `/winrate` | Win rate statistics | 5s |
| `/journal` | Trading journal | 5s |
| `/history` | Trade history | 5s |
| `/stats` | Advanced statistics | 5s |
| `/drawdown` | Drawdown analysis | 5s |
| `/expectancy` | Trade expectancy | 5s |

### Admin (Staff Only)
| Command | Description | Cooldown |
|---------|-------------|----------|
| `/health` | System health check | 0s |

---

## Email Infrastructure

### AWS SES Configuration
- **Domain:** ironstriketrading.com (verified)
- **Region:** us-east-1
- **Status:** Sandbox mode (requires verified recipients)

### Sender Personas

| Persona | Email Address | Use Case | Reply-To |
|---------|---------------|----------|----------|
| SIGNAL_ALERT | alerts@ironstriketrading.com | Trading signals, price alerts | support@ |
| TRANSACTIONAL | noreply@ironstriketrading.com | Auth, receipts, security | noreply@ |
| SUPPORT | support@ironstriketrading.com | Ticket responses | support@ |
| MARKETING | newsletter@ironstriketrading.com | Newsletters, promotions | support@ |

### Email Templates
- Professional HTML templates with IronStrike branding
- Emerald accent color (#10b981)
- Responsive design for mobile
- Plain text fallback

### Required DNS Records
1. **Domain Verification:** TXT record for _amazonses
2. **DKIM:** 3 CNAME records for email signing
3. **SPF:** TXT record with amazonses.com include
4. **DMARC:** Quarantine policy recommended

---

## Security Measures

### Authentication
- **Provider:** Clerk (hosted auth)
- **Session Storage:** PostgreSQL
- **Webhooks:** User sync on create/update/delete

### Rate Limiting
- **Chat API:** 10/100/1000 requests per minute (Free/Pro/Premium)
- **Support Tickets:** 3 requests per hour per IP
- **Bot Commands:** Per-command cooldowns (2-30 seconds)

### API Security
- Clerk middleware on all routes
- `requireAuth()` for protected endpoints
- User tier verification server-side (not from client)
- Developer bypass for testing

### Data Protection
- AWS credentials via environment variables
- Standard AWS SDK env var names with SES fallback
- No secrets exposed in client code
- HTTPS enforced

### Input Validation
- Zod schemas for all request bodies
- SQL injection prevention via Drizzle ORM
- File upload restrictions (10MB, specific MIME types)

---

## Integrations & External Services

### Market Data
| Service | Purpose | Data Provided |
|---------|---------|---------------|
| Tradier API | Primary data source | Quotes, OHLCV, options chains, Greeks |
| Finnhub API | News | Market news with sentiment |
| Polygon.io | Historical data | S3 flat files for backtesting |

### AI Services
| Service | Purpose | Model |
|---------|---------|-------|
| Replit AI Integrations | Primary AI | GPT-4o, GPT-5 |
| OpenAI Direct | Fallback | GPT-4o |
| TensorFlow.js | ML Models | Custom neural networks |

### Infrastructure
| Service | Purpose |
|---------|---------|
| AWS SES | Email notifications |
| AWS S3 | Polygon data storage |
| Stripe | Payment processing |
| Clerk | Authentication |
| Neon | PostgreSQL database |

### Communication
| Platform | Integration |
|----------|-------------|
| Discord | Full bot with 52 commands |
| Telegram | Full bot with 52 commands |
| Web | React SPA |

---

## Competitive Differentiators

### Unique Value Props vs Generic Platforms

1. **Hybrid AI + ML Signal Generation**
   - 60% TensorFlow neural network + 40% GPT analysis
   - Not just AI chat - actual ML models trained on market data

2. **Adaptive Learning System**
   - Confidence grades (A-F) adjust based on actual outcomes
   - Per-symbol performance tracking
   - Self-improving signal quality over time

3. **Multi-Platform Parity**
   - 52 identical commands on Discord, Telegram, and Web
   - Same tier access across all platforms
   - Unified user accounts

4. **Premium-Based Risk Management**
   - Position sizing based on option premium (not stock price)
   - 5 risk profiles (Ultra Conservative to Aggressive)
   - Unaffordable trade detection and warnings

5. **Real Options Data**
   - Live bid/ask spreads from Tradier
   - Real Greeks (not calculated approximations)
   - Actual option chain data

6. **Trading Journal Integration**
   - R-multiple tracking
   - Emotional state logging
   - AI-powered screenshot parsing
   - Strategy performance analytics

7. **Enterprise Email System**
   - 4 distinct sender personas
   - Professional HTML templates
   - Intelligent Reply-To routing

---

## Areas for Improvement

### Known Limitations

1. **Beta Symbols:** Currently limited to SPY, QQQ, IWM, TSLA for signal generation
2. **SES Sandbox:** Email requires production access request
3. **Data Delay:** Tradier free tier has 15-minute delay
4. **ML Training:** Requires significant historical data

### Recommended Enhancements

1. **Expand Symbol Universe:** Add more actively traded options
2. **Paper Trading Mode:** Simulated trades without real money
3. **Broker Integration:** Direct trade execution (TD Ameritrade, Schwab)
4. **Social Features:** Trade idea sharing, leaderboards
5. **Mobile App:** Native iOS/Android apps
6. **Advanced Backtesting:** More sophisticated strategy testing
7. **Options Spreads:** Multi-leg strategy support
8. **Real-Time Streaming:** WebSocket for live updates

### Technical Debt

1. **Test Coverage:** Add comprehensive unit/integration tests
2. **Error Monitoring:** Implement Sentry or similar
3. **Analytics:** Add product analytics (Mixpanel, Amplitude)
4. **CDN:** Static asset optimization
5. **Caching:** Redis for frequently accessed data

---

## Audit Comparison Framework

When comparing to quantvue.io, evaluate:

### Feature Parity
- [ ] Does competitor have AI signal generation?
- [ ] Options chain data quality?
- [ ] Multi-platform support?
- [ ] Trading journal?
- [ ] Adaptive learning?

### Pricing Comparison
- [ ] What are competitor tier prices?
- [ ] What features at each tier?
- [ ] Free tier limitations?

### Technical Quality
- [ ] UI/UX polish level?
- [ ] Mobile experience?
- [ ] Speed/performance?
- [ ] Uptime/reliability?

### Market Positioning
- [ ] Target audience overlap?
- [ ] Unique features they have?
- [ ] Areas where IronStrike excels?

---

*This document is maintained by the development team. Request updates when significant changes are made to the platform.*

*Last audit request: December 20, 2025*
