import { z } from "zod";
import { pgTable, serial, varchar, decimal, timestamp, text, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";

// ============ Session Table for Replit Auth ============

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ============ Options Trading Enums ============

export const optionTypeSchema = z.enum(["CALL", "PUT"]);
export const optionSideSchema = z.enum(["LONG", "SHORT"]);
export const optionActionSchema = z.enum(["BUY_CALL", "BUY_PUT", "SELL_CALL", "SELL_PUT", "HOLD"]);

export type OptionType = z.infer<typeof optionTypeSchema>;
export type OptionSide = z.infer<typeof optionSideSchema>;
export type OptionAction = z.infer<typeof optionActionSchema>;

// ============ Greeks Schema ============

export const greeksSchema = z.object({
  delta: z.number().min(-1).max(1),
  gamma: z.number(),
  theta: z.number(),
  vega: z.number(),
  rho: z.number().optional(),
});

export type Greeks = z.infer<typeof greeksSchema>;

// ============ Signal Request Schema ============

export const tierSchema = z.enum(["free", "pro", "premium"]);
export type Tier = z.infer<typeof tierSchema>;

export const riskProfileNameSchema = z.enum([
  "UltraConservative",
  "Conservative",
  "Balanced",
  "Growth",
  "Aggressive",
]);
export type RiskProfileName = z.infer<typeof riskProfileNameSchema>;

export const signalRequestSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).min(1).max(10),
  preferredExpiry: z.enum(["weekly", "monthly", "45_days"]).optional().default("monthly"),
  preferredDelta: z.number().min(0.1).max(0.9).optional().default(0.3),
  tier: tierSchema.optional().default("premium"),
  accountSize: z.number().min(100).max(10000000).optional().default(5000),
  riskProfile: riskProfileNameSchema.optional().default("Balanced"),
});

// ============ Selected Contract Schema ============

export const selectedContractSchema = z.object({
  symbol: z.string(),
  expirationDate: z.string(),
  strike: z.number(),
  type: z.enum(["call", "put"]),
  mid: z.number().nullable(),
  bid: z.number().nullable(),
  ask: z.number().nullable(),
  delta: z.number().nullable(),
  gamma: z.number().nullable(),
  theta: z.number().nullable(),
  vega: z.number().nullable(),
  impliedVolatility: z.number().nullable().optional(),
  openInterest: z.number().nullable(),
  volume: z.number().nullable(),
});

export type SelectedContract = z.infer<typeof selectedContractSchema>;

// ============ Position Preview Schema ============

export const positionPreviewSchema = z.object({
  premium: z.number(),
  contractMultiplier: z.number(),
  costPerContract: z.number(),
});

export type PositionPreview = z.infer<typeof positionPreviewSchema>;

// ============ Options Trading Signal Schema ============

export const tradingSignalSchema = z.object({
  symbol: z.string(),
  action: optionActionSchema,
  optionType: optionTypeSchema,
  optionSide: optionSideSchema,
  strikePrice: z.number().min(0).nullable().optional(),
  expirationDate: z.string().optional(),
  currentPrice: z.number().min(0),
  premium: z.number().min(0).nullable().optional(),
  contracts: z.number().min(0).nullable().optional(),
  contractMultiplier: z.number().default(100),
  totalCost: z.number().min(0).nullable().optional(),
  maxLoss: z.union([z.number().min(0), z.string()]).nullable().optional(),
  maxGain: z.union([z.number(), z.string()]).nullable().optional(),
  breakeven: z.number().min(0).nullable().optional(),
  confidence: z.number().min(0).max(1),
  impliedVolatility: z.number().min(0).optional(),
  greeks: greeksSchema.optional(),
  stopLossPercent: z.number().min(0).max(100).optional(),
  takeProfitPercent: z.number().min(0).optional(),
  reasoning: z.string().optional(),
  
  // Risk Model B fields
  selectedContract: selectedContractSchema.nullable().optional(),
  positionPreview: positionPreviewSchema.nullable().optional(),
  riskProfileUsed: riskProfileNameSchema.nullable().optional(),
  effectiveRiskPercent: z.number().min(0).max(1).nullable().optional(),
  isUnaffordable: z.boolean().optional(),
  unaffordableReason: z.string().optional(),
  riskViolation: z.boolean().optional(), // True when sized at 1 contract but exceeds risk budget
});

export type SignalRequest = z.infer<typeof signalRequestSchema>;
export type TradingSignal = z.infer<typeof tradingSignalSchema>;

export const signalHistory = pgTable("signal_history", {
  id: serial("id").primaryKey(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  optionType: varchar("option_type", { length: 10 }),
  optionSide: varchar("option_side", { length: 10 }),
  strikePrice: decimal("strike_price", { precision: 12, scale: 2 }).notNull(),
  expirationDate: varchar("expiration_date", { length: 20 }).notNull(),
  currentPrice: decimal("current_price", { precision: 12, scale: 2 }).notNull(),
  premium: decimal("premium", { precision: 12, scale: 4 }).notNull(),
  contracts: integer("contracts").notNull(),
  contractMultiplier: integer("contract_multiplier").notNull().default(100),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  maxLoss: varchar("max_loss", { length: 50 }).notNull(),
  maxGain: varchar("max_gain", { length: 50 }),
  breakeven: decimal("breakeven", { precision: 12, scale: 2 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  impliedVolatility: decimal("implied_volatility", { precision: 8, scale: 4 }),
  delta: decimal("delta", { precision: 8, scale: 6 }),
  gamma: decimal("gamma", { precision: 8, scale: 6 }),
  theta: decimal("theta", { precision: 8, scale: 6 }),
  vega: decimal("vega", { precision: 8, scale: 6 }),
  stopLossPercent: decimal("stop_loss_percent", { precision: 5, scale: 2 }).notNull(),
  takeProfitPercent: decimal("take_profit_percent", { precision: 5, scale: 2 }).notNull(),
  reasoning: text("reasoning"),
  accountSize: decimal("account_size", { precision: 12, scale: 2 }).notNull(),
  riskPercentage: decimal("risk_percentage", { precision: 5, scale: 4 }).notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  
  // Canonical asOf block - when the data was captured
  asOfTimestamp: timestamp("as_of_timestamp"),
  dataDelaySeconds: integer("data_delay_seconds"),
  marketSession: varchar("market_session", { length: 20 }), // pre | regular | after | closed
  
  // Canonical intent block - what the user requested
  windowsRequested: text("windows_requested"), // JSON array: ["0dte","1w","2w"]
  riskProfileRequested: varchar("risk_profile_requested", { length: 30 }),
  strictSizing: integer("strict_sizing"), // 1 = true, 0 = false
  
  // Canonical audit block - provenance tracking
  aiModel: varchar("ai_model", { length: 50 }),
  promptVersion: varchar("prompt_version", { length: 30 }),
  dataProviders: text("data_providers"), // JSON array
  inputHash: varchar("input_hash", { length: 64 }),
  
  // Tier at generation time
  tierAtGeneration: varchar("tier_at_generation", { length: 20 }),
  
  // User ID for ownership
  userId: varchar("user_id", { length: 255 }),
});

export const insertSignalHistorySchema = createInsertSchema(signalHistory).omit({
  id: true,
  generatedAt: true,
});

export type InsertSignalHistory = z.infer<typeof insertSignalHistorySchema>;
export type SelectSignalHistory = typeof signalHistory.$inferSelect;

// ============ Signal Events Table (append-only timeline) ============

export const signalEventTypeSchema = z.enum(["CREATED", "TRADED", "CLOSED", "EXPIRED", "UPDATED"]);
export type SignalEventType = z.infer<typeof signalEventTypeSchema>;

export const signalEvents = pgTable("signal_events", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull(),
  eventType: varchar("event_type", { length: 30 }).notNull(), // CREATED, TRADED, CLOSED, EXPIRED
  eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),
  payload: jsonb("payload"), // Event-specific data
});

export const insertSignalEventSchema = createInsertSchema(signalEvents).omit({
  id: true,
  eventTimestamp: true,
});

export type InsertSignalEvent = z.infer<typeof insertSignalEventSchema>;
export type SelectSignalEvent = typeof signalEvents.$inferSelect;

// ============ Imports Table (screenshot parsing provenance) ============

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  tradeId: integer("trade_id"),
  rawImageHash: varchar("raw_image_hash", { length: 64 }),
  parsedPayload: jsonb("parsed_payload"),
  parseConfidence: decimal("parse_confidence", { precision: 5, scale: 4 }),
  needsReview: integer("needs_review").default(0), // 1 = true, 0 = false
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImportSchema = createInsertSchema(imports).omit({
  id: true,
  createdAt: true,
});

export type InsertImport = z.infer<typeof insertImportSchema>;
export type SelectImport = typeof imports.$inferSelect;

// Trade source enum
export const tradeSourceSchema = z.enum(["ironstrike", "manual", "external"]);
export type TradeSource = z.infer<typeof tradeSourceSchema>;

// Asset type enum
export const assetTypeSchema = z.enum(["option", "equity"]);
export type AssetType = z.infer<typeof assetTypeSchema>;

// Session tag enum
export const sessionTagSchema = z.enum(["premarket", "us_open", "midday", "power_hour", "afterhours", "overnight"]);
export type SessionTag = z.infer<typeof sessionTagSchema>;

// Emotional state enum
export const emotionalStateSchema = z.enum(["calm", "confident", "anxious", "fearful", "greedy", "frustrated", "excited", "neutral"]);
export type EmotionalState = z.infer<typeof emotionalStateSchema>;

export const tradeExecutions = pgTable("trade_executions", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id"), // Nullable for manual trades
  strategyId: integer("strategy_id"), // FK to strategies table for analytics
  userId: varchar("user_id", { length: 100 }), // Clerk user ID
  symbol: varchar("symbol", { length: 10 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  optionType: varchar("option_type", { length: 10 }),
  optionSide: varchar("option_side", { length: 10 }),
  strikePrice: decimal("strike_price", { precision: 12, scale: 2 }),
  expirationDate: varchar("expiration_date", { length: 20 }),
  entryPremium: decimal("entry_premium", { precision: 12, scale: 4 }).notNull(),
  exitPremium: decimal("exit_premium", { precision: 12, scale: 4 }),
  contracts: integer("contracts").notNull(),
  contractMultiplier: integer("contract_multiplier").notNull().default(100),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),
  targetPremiumPercent: decimal("target_premium_percent", { precision: 8, scale: 2 }),
  stopLossPremiumPercent: decimal("stop_loss_premium_percent", { precision: 8, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  profitLoss: decimal("profit_loss", { precision: 12, scale: 2 }),
  profitLossPercent: decimal("profit_loss_percent", { precision: 8, scale: 4 }),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  notes: text("notes"),
  
  // Journal fields for TradeZella-style experience
  source: varchar("source", { length: 20 }).notNull().default("ironstrike"), // ironstrike, manual, external
  assetType: varchar("asset_type", { length: 20 }).notNull().default("option"), // option, equity
  strategyTag: varchar("strategy_tag", { length: 100 }), // e.g., "0DTE scalp", "Earnings play"
  tagList: text("tag_list"), // JSON array of tags like ["A+ setup", "Opening drive"]
  sessionTag: varchar("session_tag", { length: 20 }), // premarket, us_open, midday, power_hour, afterhours
  emotionalState: varchar("emotional_state", { length: 20 }), // calm, confident, anxious, fearful, greedy, frustrated
  whatWentWell: text("what_went_well"),
  whatWentWrong: text("what_went_wrong"),
  lessonLearned: text("lesson_learned"),
  screenshotUrl: text("screenshot_url"),
  
  // Risk management fields
  plannedRiskPerTrade: decimal("planned_risk_per_trade", { precision: 12, scale: 2 }), // Dollar amount risked
  plannedStopPrice: decimal("planned_stop_price", { precision: 12, scale: 4 }),
  plannedTakeProfitPrice: decimal("planned_take_profit_price", { precision: 12, scale: 4 }),
  realizedRMultiple: decimal("realized_r_multiple", { precision: 8, scale: 4 }), // P&L / planned risk
});

export const insertTradeExecutionSchema = createInsertSchema(tradeExecutions).omit({
  id: true,
  executedAt: true,
});

export type InsertTradeExecution = z.infer<typeof insertTradeExecutionSchema>;
export type SelectTradeExecution = typeof tradeExecutions.$inferSelect;

export const tradeExecutionUpdateSchema = z.object({
  exitPremium: z.number(), // Allow negative for adjustments/corrections
  entryPremium: z.number().optional(), // Allow editing entry premium if AI parser made a mistake
  notes: z.string().optional(),
});

export type TradeExecutionUpdate = z.infer<typeof tradeExecutionUpdateSchema>;

// Manual trade input schema for logging trades outside Iron Strike
export const manualTradeInputSchema = z.object({
  symbol: z.string().min(1).max(10),
  assetType: assetTypeSchema.default("option"),
  action: z.string().min(1), // LONG_CALL, LONG_PUT, SHORT_CALL, SHORT_PUT, LONG_STOCK, SHORT_STOCK
  optionType: optionTypeSchema.optional(),
  optionSide: optionSideSchema.optional(),
  strikePrice: z.number().min(0).optional(),
  expirationDate: z.string().optional(),
  entryPremium: z.number().min(0),
  contracts: z.number().min(1),
  totalCost: z.number().min(0).optional(),
  
  // Strategy assignment
  strategyId: z.number().optional(), // FK to strategies table
  
  // Journal fields
  strategyTag: z.string().max(100).optional(),
  tagList: z.array(z.string()).optional(),
  sessionTag: sessionTagSchema.optional(),
  emotionalState: emotionalStateSchema.optional(),
  whatWentWell: z.string().optional(),
  whatWentWrong: z.string().optional(),
  lessonLearned: z.string().optional(),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  
  // Risk management
  plannedRiskPerTrade: z.number().min(0).optional(),
  plannedStopPrice: z.number().min(0).optional(),
  plannedTakeProfitPrice: z.number().min(0).optional(),
});

export type ManualTradeInput = z.infer<typeof manualTradeInputSchema>;

// Journal update schema for editing journal fields on any trade
export const tradeJournalUpdateSchema = z.object({
  strategyTag: z.string().max(100).optional(),
  tagList: z.array(z.string()).optional(),
  sessionTag: sessionTagSchema.optional(),
  emotionalState: emotionalStateSchema.optional(),
  whatWentWell: z.string().optional(),
  whatWentWrong: z.string().optional(),
  lessonLearned: z.string().optional(),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  plannedRiskPerTrade: z.union([z.string(), z.number()]).optional(),
  plannedStopPrice: z.union([z.string(), z.number()]).optional(),
  plannedTakeProfitPrice: z.union([z.string(), z.number()]).optional(),
});

export type TradeJournalUpdate = z.infer<typeof tradeJournalUpdateSchema>;

// Trade filter schema for querying trades
export const tradeFilterSchema = z.object({
  symbol: z.string().optional(),
  status: z.enum(["open", "closed", "all"]).optional(),
  source: tradeSourceSchema.optional(),
  strategyTag: z.string().optional(),
  from: z.string().optional(), // ISO date
  to: z.string().optional(), // ISO date
});

export type TradeFilter = z.infer<typeof tradeFilterSchema>;

export const performanceMetricsSchema = z.object({
  totalTrades: z.number(),
  openTrades: z.number(),
  closedTrades: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
  winRate: z.number(),
  averageProfit: z.number(),
  averageLoss: z.number(),
  totalProfitLoss: z.number(),
  bestTrade: z.object({
    symbol: z.string(),
    profitLossPercent: z.number(),
  }).nullable(),
  worstTrade: z.object({
    symbol: z.string(),
    profitLossPercent: z.number(),
  }).nullable(),
  profitFactor: z.number(),
  expectancy: z.number(),
});

export type PerformanceMetrics = z.infer<typeof performanceMetricsSchema>;

// ============ User Strategies for Analytics ============

// Simple user-defined strategies for journaling and analytics (separate from automated trading strategies)
export const strategies = pgTable("strategies", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  tags: text("tags"), // JSON array of tags
  color: varchar("color", { length: 20 }), // For UI display
  isActive: integer("is_active").notNull().default(1), // 1 = active, 0 = archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStrategySchema = createInsertSchema(strategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertStrategy = z.infer<typeof insertStrategySchema>;
export type SelectStrategy = typeof strategies.$inferSelect;

// Strategy input schema for API
export const strategyInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  color: z.string().max(20).optional(),
  isActive: z.boolean().optional().default(true),
});

export type StrategyInput = z.infer<typeof strategyInputSchema>;

// ============ Trading Strategy Schema (Automated Rule-based) ============

// Indicator types for strategy conditions
export const indicatorTypeSchema = z.enum([
  "PRICE",         // Current price
  "SMA",           // Simple Moving Average
  "EMA",           // Exponential Moving Average  
  "RSI",           // Relative Strength Index
  "MACD",          // MACD line
  "MACD_SIGNAL",   // MACD signal line
  "MACD_HISTOGRAM" // MACD histogram
]);

// Comparison operators for conditions
export const comparisonOperatorSchema = z.enum([
  "GREATER_THAN",      // >
  "LESS_THAN",         // <
  "CROSSES_ABOVE",     // crosses from below to above
  "CROSSES_BELOW",     // crosses from above to below
  "EQUALS"             // = (within tolerance)
]);

// Single condition rule
export const strategyConditionSchema = z.object({
  indicator: indicatorTypeSchema,
  period: z.number().min(1).max(200).optional(), // Period for SMA, EMA, RSI
  operator: comparisonOperatorSchema,
  compareTo: z.union([
    z.object({ type: z.literal("VALUE"), value: z.number() }), // Compare to fixed value
    z.object({ type: z.literal("INDICATOR"), indicator: indicatorTypeSchema, period: z.number().min(1).max(200).optional() }) // Compare to another indicator
  ])
});

// Condition group with logical operator
export const conditionGroupSchema = z.object({
  logic: z.enum(["AND", "OR"]),
  conditions: z.array(strategyConditionSchema).min(1)
});

// Full strategy schema
export const strategySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  action: optionActionSchema, // Options action: BUY_CALL, BUY_PUT, SELL_CALL, SELL_PUT, HOLD
  optionType: optionTypeSchema.optional(), // CALL or PUT
  preferredDelta: z.number().min(0.1).max(0.9).optional(),
  conditionGroups: z.array(conditionGroupSchema).min(1), // Groups connected by AND
  enabled: z.boolean().default(true),
  priority: z.number().min(1).max(100).default(50) // Higher priority strategies evaluated first
});

export type IndicatorType = z.infer<typeof indicatorTypeSchema>;
export type ComparisonOperator = z.infer<typeof comparisonOperatorSchema>;
export type StrategyCondition = z.infer<typeof strategyConditionSchema>;
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;
export type Strategy = z.infer<typeof strategySchema>;

// Database table for strategies
export const tradingStrategies = pgTable("trading_strategies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  action: varchar("action", { length: 20 }).notNull(),
  conditionGroups: text("condition_groups").notNull(), // JSON string of condition groups
  enabled: integer("enabled").notNull().default(1), // 1 = true, 0 = false
  priority: integer("priority").notNull().default(50),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTradingStrategySchema = createInsertSchema(tradingStrategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTradingStrategy = z.infer<typeof insertTradingStrategySchema>;
export type SelectTradingStrategy = typeof tradingStrategies.$inferSelect;

// ============ Trade Journal Schema ============

export const tradeJournalEntries = pgTable("trade_journal_entries", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull(), // Reference to trade_executions
  entryType: varchar("entry_type", { length: 20 }).notNull(), // "pre-trade", "during", "post-trade", "lesson"
  content: text("content").notNull(),
  tags: text("tags"), // JSON array of tags
  mood: varchar("mood", { length: 20 }), // "confident", "nervous", "neutral", "regretful"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTradeJournalEntrySchema = createInsertSchema(tradeJournalEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertTradeJournalEntry = z.infer<typeof insertTradeJournalEntrySchema>;
export type SelectTradeJournalEntry = typeof tradeJournalEntries.$inferSelect;

// ============ Portfolio Summary Schema ============

export const portfolioSummarySchema = z.object({
  totalPositions: z.number(),
  openPositions: z.number(),
  closedPositions: z.number(),
  totalInvested: z.number(),
  totalValue: z.number(),
  realizedPnL: z.number(),
  unrealizedPnL: z.number(),
  totalPnL: z.number(),
  totalPnLPercent: z.number(),
  winRate: z.number(),
  avgHoldingPeriod: z.number(), // in days
  topPerformers: z.array(z.object({
    symbol: z.string(),
    pnlPercent: z.number(),
    status: z.string()
  })),
  worstPerformers: z.array(z.object({
    symbol: z.string(),
    pnlPercent: z.number(),
    status: z.string()
  }))
});

export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;

// ============ ML Model Schema ============

export const featureVectorSchema = z.object({
  date: z.string().or(z.date()),
  close: z.number(),
  volume: z.number(),
  maFast: z.number(),
  maSlow: z.number(),
  rsi14: z.number(),
  priceChange1d: z.number(),
  volNormalized: z.number(),
  macdLine: z.number(),
  macdSignal: z.number(),
  macdHistogram: z.number(),
});

export const mlPredictionSchema = z.object({
  probability: z.number().min(0).max(1),
  action: optionActionSchema,
  optionType: optionTypeSchema.optional(),
  confidence: z.number().min(0).max(1),
  features: featureVectorSchema.nullable(),
});

export const modelMetricsSchema = z.object({
  accuracy: z.number().min(0).max(1),
  trainingSamples: z.number(),
  lastTrainedAt: z.string().nullable(),
  isLoaded: z.boolean(),
});

// ============ Enhanced Backtest Schema ============

export const backtestTradeSchema = z.object({
  entryDate: z.string(),
  exitDate: z.string(),
  optionType: optionTypeSchema,
  strikePrice: z.number(),
  entryPremium: z.number(),
  exitPremium: z.number(),
  contracts: z.number(),
  pnl: z.number(),
  pnlPercent: z.number(),
  action: optionActionSchema,
});

export const backtestResultSchema = z.object({
  symbol: z.string(),
  initialCapital: z.number(),
  finalCapital: z.number(),
  totalReturn: z.number(),
  totalReturnPercent: z.number(),
  maxDrawdown: z.number(),
  maxDrawdownPercent: z.number(),
  winRate: z.number(),
  totalTrades: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
  avgWin: z.number(),
  avgLoss: z.number(),
  profitFactor: z.number(),
  sharpeRatio: z.number(),
  trades: z.array(backtestTradeSchema),
  equityCurve: z.array(z.object({
    date: z.string(),
    equity: z.number(),
  })),
  signalSource: z.enum(["ML", "GPT", "HYBRID", "STRATEGY"]),
});

export const backtestRequestSchema = z.object({
  symbol: z.string(),
  initialCapital: z.number().min(1000).default(10000),
  riskPerTrade: z.number().min(0.001).max(0.1).default(0.02),
  lookbackDays: z.number().min(100).max(1000).default(365),
  signalSource: z.enum(["ML", "GPT", "HYBRID", "STRATEGY"]).default("ML"),
  strategyId: z.number().optional(),
});

export type FeatureVectorType = z.infer<typeof featureVectorSchema>;
export type MLPredictionType = z.infer<typeof mlPredictionSchema>;
export type ModelMetricsType = z.infer<typeof modelMetricsSchema>;
export type BacktestTrade = z.infer<typeof backtestTradeSchema>;
export type BacktestResult = z.infer<typeof backtestResultSchema>;
export type BacktestRequest = z.infer<typeof backtestRequestSchema>;

// ============ Hybrid Signal Schema ============

export const hybridSignalSchema = z.object({
  symbol: z.string(),
  mlPrediction: mlPredictionSchema,
  gptAnalysis: tradingSignalSchema.optional(),
  combinedAction: optionActionSchema,
  optionType: optionTypeSchema,
  optionSide: optionSideSchema,
  combinedConfidence: z.number().min(0).max(1),
  reasoning: z.string(),
  strikePrice: z.number(),
  expirationDate: z.string(),
  currentPrice: z.number(),
  premium: z.number(),
  contracts: z.number(),
  totalCost: z.number(),
  maxLoss: z.number(),
  maxGain: z.number(),
  breakeven: z.number(),
  stopLossPercent: z.number(),
  takeProfitPercent: z.number(),
  greeks: greeksSchema.optional(),
});

export type HybridSignal = z.infer<typeof hybridSignalSchema>;

// ============ Adaptive Learning Schema ============

// Track signal outcomes for adaptive learning
export const signalOutcomes = pgTable("signal_outcomes", {
  id: serial("id").primaryKey(),
  signalId: integer("signal_id").notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  optionType: varchar("option_type", { length: 10 }).notNull(),
  strikePrice: decimal("strike_price", { precision: 12, scale: 2 }).notNull(),
  expirationDate: varchar("expiration_date", { length: 20 }).notNull(),
  entryPrice: decimal("entry_price", { precision: 12, scale: 2 }).notNull(),
  entryPremium: decimal("entry_premium", { precision: 12, scale: 4 }).notNull(),
  exitPrice: decimal("exit_price", { precision: 12, scale: 2 }),
  exitPremium: decimal("exit_premium", { precision: 12, scale: 4 }),
  predictedDirection: varchar("predicted_direction", { length: 10 }).notNull(), // "UP" or "DOWN"
  actualDirection: varchar("actual_direction", { length: 10 }), // "UP", "DOWN", or null if pending
  originalConfidence: decimal("original_confidence", { precision: 5, scale: 4 }).notNull(),
  marketCondition: varchar("market_condition", { length: 20 }), // "BULLISH", "BEARISH", "NEUTRAL", "VOLATILE"
  wasSuccessful: integer("was_successful"), // 1 = hit target, 0 = hit stop, null = pending
  profitLossPercent: decimal("profit_loss_percent", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  evaluatedAt: timestamp("evaluated_at"),
});

export const insertSignalOutcomeSchema = createInsertSchema(signalOutcomes).omit({
  id: true,
  createdAt: true,
});

export type InsertSignalOutcome = z.infer<typeof insertSignalOutcomeSchema>;
export type SelectSignalOutcome = typeof signalOutcomes.$inferSelect;

// Adaptive learning metrics per symbol
export const adaptiveLearningSchema = z.object({
  symbol: z.string(),
  totalSignals: z.number(),
  successfulSignals: z.number(),
  failedSignals: z.number(),
  pendingSignals: z.number(),
  successRate: z.number().min(0).max(1),
  avgConfidenceAdjustment: z.number(), // How much to adjust base confidence
  recentTrend: z.enum(["IMPROVING", "DECLINING", "STABLE"]),
  lastUpdated: z.string().or(z.date()),
  marketConditionAccuracy: z.record(z.number()), // Accuracy by market condition
});

export type AdaptiveLearning = z.infer<typeof adaptiveLearningSchema>;

// ============ User Roles Schema ============

export const userRoleSchema = z.enum(["free", "pro", "premium"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// ============ User Schema (for Replit Auth) ============

export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  profileImageUrl: text("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  timezone: varchar("timezone", { length: 50 }).default("America/New_York"),
  telegramChatId: varchar("telegram_chat_id", { length: 100 }),
  discordUserId: varchar("discord_user_id", { length: 50 }),
  discordWebhookUrl: text("discord_webhook_url"),
  defaultNotifyEmail: boolean("default_notify_email").notNull().default(true),
  defaultNotifyTelegram: boolean("default_notify_telegram").notNull().default(false),
  defaultNotifyDiscord: boolean("default_notify_discord").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type SelectUser = typeof users.$inferSelect;

// ============ Watchlist Schema ============

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  notes: text("notes"),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  addedAt: true,
});

export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;
export type SelectWatchlist = typeof watchlist.$inferSelect;

// ============ Price Alerts Schema ============

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }),
  name: varchar("name", { length: 100 }), // Optional user-defined name for the alert
  symbol: varchar("symbol", { length: 10 }).notNull(),
  targetPrice: decimal("target_price", { precision: 12, scale: 2 }).notNull(),
  condition: varchar("condition", { length: 10 }).notNull(), // "ABOVE" or "BELOW"
  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"), // "ACTIVE", "TRIGGERED", "EXPIRED"
  notifyEmail: boolean("notify_email").notNull().default(false),
  notifyTelegram: boolean("notify_telegram").notNull().default(false),
  notifyDiscord: boolean("notify_discord").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  triggeredAt: timestamp("triggered_at"),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
});

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type SelectPriceAlert = typeof priceAlerts.$inferSelect;

// ============ Support Tickets Schema ============

export const ticketStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const ticketChannelSchema = z.enum(["web", "telegram", "discord", "chatbot", "email"]);
export type TicketChannel = z.infer<typeof ticketChannelSchema>;

export const ticketPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
  userId: varchar("user_id", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }),
  subject: varchar("subject", { length: 255 }).notNull(),
  message: text("message").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  channel: varchar("channel", { length: 20 }).notNull().default("web"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  ticketNumber: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SelectSupportTicket = typeof supportTickets.$inferSelect;

export const createTicketRequestSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().max(100).optional(),
  subject: z.string().min(1, "Subject is required").max(255),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  priority: ticketPrioritySchema.optional().default("normal"),
  channel: ticketChannelSchema.optional().default("web"),
});

export const updateTicketRequestSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedTo: z.string().optional().nullable(),
});

export type CreateTicketRequest = z.infer<typeof createTicketRequestSchema>;
export type UpdateTicketRequest = z.infer<typeof updateTicketRequestSchema>;

// ============ API Request Validation Schemas ============

export const addWatchlistRequestSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10, "Symbol too long").toUpperCase(),
});

export const createAlertRequestSchema = z.object({
  name: z.string().max(100, "Name too long").optional(),
  symbol: z.string().min(1, "Symbol is required").max(10, "Symbol too long"),
  targetPrice: z.number().positive("Target price must be positive"),
  condition: z.enum(["ABOVE", "BELOW"]),
  notifyEmail: z.boolean().optional().default(false),
  notifyTelegram: z.boolean().optional().default(false),
  notifyDiscord: z.boolean().optional().default(false),
});

export const updateAlertRequestSchema = z.object({
  name: z.string().max(100, "Name too long").optional().nullable(),
  symbol: z.string().min(1, "Symbol is required").max(10, "Symbol too long").optional(),
  targetPrice: z.number().positive("Target price must be positive").optional(),
  condition: z.enum(["ABOVE", "BELOW"]).optional(),
  notifyEmail: z.boolean().optional(),
  notifyTelegram: z.boolean().optional(),
  notifyDiscord: z.boolean().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

export const chartAnalysisRequestSchema = z.object({
  chartImage: z.string().min(1, "Chart image is required").refine(
    (val) => val.startsWith("data:image/") && val.length < 10 * 1024 * 1024,
    "Invalid image format or size (max 10MB)"
  ),
  context: z.string().max(1000).optional(),
});

export type AddWatchlistRequest = z.infer<typeof addWatchlistRequestSchema>;
export type CreateAlertRequest = z.infer<typeof createAlertRequestSchema>;
export type UpdateAlertRequest = z.infer<typeof updateAlertRequestSchema>;
export type ChartAnalysisRequest = z.infer<typeof chartAnalysisRequestSchema>;

// ============ User Settings Schema ============

export const updateUserSettingsSchema = z.object({
  email: z.string().email().optional().or(z.literal("")),
  timezone: z.string().max(50).optional(),
  telegramChatId: z.string().max(100).optional().or(z.literal("")),
  discordUserId: z.string().max(50).optional().or(z.literal("")),
  discordWebhookUrl: z.string().url().optional().or(z.literal("")),
  firstName: z.string().max(100).optional().or(z.literal("")),
  lastName: z.string().max(100).optional().or(z.literal("")),
  defaultNotifyEmail: z.boolean().optional(),
  defaultNotifyTelegram: z.boolean().optional(),
  defaultNotifyDiscord: z.boolean().optional(),
});

export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

// ============ Market News & Trends Schema ============

export const newsSourceSchema = z.enum(["FINNHUB", "NEWSAPI", "RSS", "CUSTOM"]);
export const newsSentimentSchema = z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]);

export type NewsSource = z.infer<typeof newsSourceSchema>;
export type NewsSentiment = z.infer<typeof newsSentimentSchema>;

export const newsItemSchema = z.object({
  id: z.string(),
  source: newsSourceSchema,
  sourceName: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string(),
  sentiment: newsSentimentSchema.optional(),
  relatedSymbols: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const marketTrendSchema = z.object({
  id: z.string(),
  topic: z.string(),
  score: z.number(),
  change: z.number(),
  relatedSymbols: z.array(z.string()),
  newsCount: z.number(),
  sentiment: newsSentimentSchema,
});

export type NewsItem = z.infer<typeof newsItemSchema>;
export type MarketTrend = z.infer<typeof marketTrendSchema>;

// ============ Analytics KPI Schemas ============

// DTE bucket for trade categorization
export const dteBucketSchema = z.enum(["0DTE", "1W", "2W", "3W", "1M", "1M+"]);
export type DTEBucket = z.infer<typeof dteBucketSchema>;

// Core KPI metrics computed from trades
export const kpiMetricsSchema = z.object({
  winRate: z.number(),
  profitFactor: z.number(),
  expectancy: z.number(),
  avgRMultiple: z.number().nullable(),
  netPnL: z.number(),
  maxDrawdown: z.number(),
  avgHoldTime: z.number(), // in hours
  bestDayPnL: z.number(),
  worstDayPnL: z.number(),
  disciplineScore: z.number(), // 0-100
  signalEdge: z.number().nullable(), // user vs AI baseline
  calibrationScore: z.number().nullable(),
  highConfidenceHitRate: z.number().nullable(), // confidence >= 0.70
  tradesCount: z.number(),
  winningTrades: z.number(),
  losingTrades: z.number(),
});

export type KPIMetrics = z.infer<typeof kpiMetricsSchema>;

// Strategy performance metrics
export const strategyPerformanceSchema = z.object({
  strategyId: z.number(),
  strategyName: z.string(),
  metrics: kpiMetricsSchema,
  timeSeries: z.array(z.object({
    date: z.string(),
    netPnL: z.number(),
    cumulativePnL: z.number(),
    tradesCount: z.number(),
  })),
  bestSymbol: z.string().nullable(),
  worstSymbol: z.string().nullable(),
  sharpeLike: z.number(), // Simplified Sharpe ratio
});

export type StrategyPerformance = z.infer<typeof strategyPerformanceSchema>;

// Confidence calibration bin
export const calibrationBinSchema = z.object({
  binStart: z.number(),
  binEnd: z.number(),
  binLabel: z.string(),
  count: z.number(),
  winRate: z.number(),
  avgPnL: z.number(),
  avgRMultiple: z.number().nullable(),
  predictedConfidence: z.number(), // midpoint of bin
  observedWinRate: z.number(),
});

export type CalibrationBin = z.infer<typeof calibrationBinSchema>;

// User vs AI comparison metrics
export const userVsAISchema = z.object({
  aiBaseline: kpiMetricsSchema,
  userTakenTrades: kpiMetricsSchema,
  userManualTrades: kpiMetricsSchema,
  edge: z.number(), // userPnL - aiPnL normalized
  takenCount: z.number(),
  manualCount: z.number(),
  skippedCount: z.number(),
  timeSeries: z.array(z.object({
    date: z.string(),
    aiCumulativePnL: z.number(),
    userCumulativePnL: z.number(),
  })),
});

export type UserVsAI = z.infer<typeof userVsAISchema>;

// Analytics time range
export const analyticsRangeSchema = z.enum(["30d", "90d", "180d", "1y"]);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

// Mistake detector - tracks overrides that lost money vs followed recommendations
export const mistakeDetectorSchema = z.object({
  followedSignals: z.object({
    count: z.number(),
    winRate: z.number(),
    netPnL: z.number(),
    avgPnL: z.number(),
  }),
  overrodeSignals: z.object({
    count: z.number(),
    winRate: z.number(),
    netPnL: z.number(),
    avgPnL: z.number(),
    strikeOverrides: z.number(),
    expiryOverrides: z.number(),
    directionOverrides: z.number(),
  }),
  costOfOverrides: z.number(), // Estimated P&L difference if user had followed signals
  overrideDetails: z.array(z.object({
    tradeId: z.number(),
    symbol: z.string(),
    overrideType: z.enum(["strike", "expiry", "direction", "multiple"]),
    signalAction: z.string(),
    userAction: z.string(),
    pnl: z.number(),
    date: z.string(),
  })),
});

export type MistakeDetector = z.infer<typeof mistakeDetectorSchema>;
