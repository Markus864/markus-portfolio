# AI Options Trading Assistant

## Overview
The AI Options Trading Assistant is an AI-powered platform designed to generate intelligent options trading signals (BUY_CALL/BUY_PUT/SELL_CALL/SELL_PUT). It provides recommendations with confidence scores, contract sizing, and premium-based risk management. The application leverages OpenAI's GPT models to analyze stock symbols and generate actionable trading signals, considering user-defined parameters such as account size and risk tolerance. The project aims to provide a robust, AI-driven tool for options traders, inspired by leading fintech platforms, providing a clear business vision and significant market potential within the financial technology sector.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React, TypeScript, Vite, Wouter for routing, and React Query for server state management. It uses `shadcn/ui` (New York style) based on Radix UI, styled with Tailwind CSS, featuring a dark theme with emerald accents. The UI design blends Material Design with fintech aesthetics. Navigation includes a premium landing page and a collapsible sidebar for core features like Live Signals, Signal Generator, Portfolio & Analytics, and various analytical tools. A floating AI Chatbot is available across all app pages. React Hook Form with Zod handles form management.

### Backend
The backend utilizes Express.js with TypeScript, providing RESTful APIs for signal generation, historical data, journaling, and analytics. Zod schemas are used for request validation and structured error handling. The AI architecture leverages OpenAI Assistants API with specialized assistants for primary signal generation, educational Q&A, signal explanation, and historical backtesting. An adaptive learning system assigns and adjusts signal confidence grades based on performance. Legacy TensorFlow.js models are maintained for neural network training and inference. Technical indicators are calculated from Polygon.io historical data before AI analysis.

### Core Features
- **Dashboard Command Center:** Real-time dashboard displaying active signals, alerts, win rate, P&L, open positions, daily risk, recent signals, and a unified activity timeline.
- **Adaptive Performance API:** Provides tier-gated access to performance metrics.
- **Trading Journal:** Supports manual trade logging with R-multiple tracking, strategy tags, emotion tracking, and AI trade coaching. It includes AI Screenshot Parsing using OpenAI GPT-4o Vision API for trade detail extraction.
- **Trading Journal Summary:** Displays performance metrics such as total trades, win rate, P&L, R-multiple tracking, and psychology insights.
- **Analytics Engine:** Offers comprehensive performance analytics, including KPIs, strategy performance, confidence calibration, and equity curve generation.
- **ML Strategy Engine:** A premium module for building training datasets, training logistic regression models, and evaluating model performance.
- **AI Chatbot with Live Market Data:** A floating chatbot that automatically detects stock symbols in user messages and fetches real-time quotes from Polygon.io.
- **AI Chart Coaching Overlays:** Tier-gated coaching features on charts, including Coach Notes, Trade Grade, Risk Box, Mistake Map, and Drill Mode, powered by OpenAI GPT-4o.
- **Market Scanner (Iron Strike Coach):** A background service that monitors a watchlist and sends real-time Discord alerts for strong momentum or selling pressure.
- **Teaser Alert System:** Sends automatic redacted signal alerts for high-confidence trades to drive upgrades.
- **Role Synchronization Bridge:** Provides two-way synchronization between Stripe payments and Discord roles.
- **Primary Signal Engine (V2):** Utilizes OpenAI Assistants API with persistent threads and tool calling for signal generation.
- **Authentication:** Implemented via Clerk Auth using OpenID Connect, with session management in PostgreSQL.

### Code Organization
The project follows a monorepo structure with `/client`, `/server`, and `/shared` directories.

### Design System — Precision AI Engine v1.0
The design philosophy emphasizes calm authority, technical precision, and quiet confidence. The color palette is locked to a deep charcoal primary background, with an emerald accent. Typography uses Inter for UI and JetBrains Mono for data. Design rules emphasize no gradients, minimal shadows, sparing accent use, generous whitespace, and a maximum border-radius of 6px. Public pages (Landing, How It Works, Methodology, Pricing) adhere to this aesthetic.

## External Dependencies

### Third-Party Services
- **Replit AI Integrations:** Provides OpenAI-compatible API access for GPT-4o.
- **Polygon.io API:** Primary source for stock quotes, historical OHLCV data, and Greeks.
- **Tradier API:** Fallback source for quotes and options chains.
- **Finnhub API:** Provides market news with sentiment analysis.
- **Polygon.io Flat Files:** S3-based historical data for backtesting.
- **AWS SES:** Email service for transactional and marketing communications.
- **Freshdesk:** Support ticket management system.

### Database & ORM
- **PostgreSQL:** Primary database for persisting signal history, watchlist, alerts, journal entries, and sessions.
- **Drizzle ORM:** Used for PostgreSQL interaction.

### Key NPM Packages
- **Frontend:** `react`, `@tanstack/react-query`, `wouter`, `react-hook-form`, `zod`, `date-fns`, `Radix UI components`, `lucide-react`, `tailwindcss`, `class-variance-authority`, `clsx`.
- **Backend:** `express`, `openai`, `p-limit`, `p-retry`, `zod`, `drizzle-orm`, `@neondatabase/serverless`, `nanoid`.
- **Build Tools:** `vite`, `tsx`, `esbuild`, `drizzle-kit`.