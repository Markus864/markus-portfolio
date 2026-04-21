import { UserRole } from "@shared/schema";
import { isDeveloper } from "./config/env";

export type FeatureName = 
  | "signals_basic"
  | "signals_all_symbols"
  | "whale_tracker"
  | "batch_ai"
  | "earnings_plays"
  | "alerts"
  | "advanced_strategies"
  | "backtest"
  | "ml_predictions"
  | "chat_unlimited"
  | "export_data"
  | "journal_basic"
  | "journal_strategy_tags"
  | "journal_emotional_state"
  | "journal_r_multiple"
  | "analytics_basic"
  | "analytics_pro"
  | "analytics_premium"
  | "ai_coaching"
  | "ai_trade_review"
  | "adaptive_insights"
  | "ml_backtest";

interface FeatureConfig {
  name: FeatureName;
  displayName: string;
  description: string;
  requiredRole: UserRole;
  comingSoon?: boolean;
}

export const FEATURE_FLAGS: Record<FeatureName, FeatureConfig> = {
  signals_basic: {
    name: "signals_basic",
    displayName: "Basic Signals",
    description: "AI-powered signals for beta symbols (SPY, QQQ, IWM, TSLA)",
    requiredRole: "free",
  },
  signals_all_symbols: {
    name: "signals_all_symbols",
    displayName: "All Symbols",
    description: "Generate signals for any stock symbol",
    requiredRole: "pro",
  },
  whale_tracker: {
    name: "whale_tracker",
    displayName: "Whale Tracker",
    description: "Track large institutional trades and unusual options activity",
    requiredRole: "premium",
    comingSoon: true,
  },
  batch_ai: {
    name: "batch_ai",
    displayName: "Batch AI Analysis",
    description: "Analyze multiple symbols simultaneously",
    requiredRole: "pro",
  },
  earnings_plays: {
    name: "earnings_plays",
    displayName: "Earnings Plays",
    description: "AI-powered earnings trade recommendations",
    requiredRole: "premium",
    comingSoon: true,
  },
  alerts: {
    name: "alerts",
    displayName: "Price Alerts",
    description: "Set custom price alerts for any symbol",
    requiredRole: "pro",
  },
  advanced_strategies: {
    name: "advanced_strategies",
    displayName: "Advanced Strategies",
    description: "Create and backtest custom trading strategies",
    requiredRole: "premium",
  },
  backtest: {
    name: "backtest",
    displayName: "Backtesting",
    description: "Test strategies against historical data",
    requiredRole: "pro",
  },
  ml_predictions: {
    name: "ml_predictions",
    displayName: "ML Predictions",
    description: "Machine learning powered price predictions",
    requiredRole: "premium",
    comingSoon: true,
  },
  chat_unlimited: {
    name: "chat_unlimited",
    displayName: "Unlimited Chat",
    description: "Unlimited AI chat messages",
    requiredRole: "pro",
  },
  export_data: {
    name: "export_data",
    displayName: "Data Export",
    description: "Export signals and trade history to CSV",
    requiredRole: "pro",
  },
  journal_basic: {
    name: "journal_basic",
    displayName: "Basic Journal",
    description: "Log trades, add notes, and track basic metrics",
    requiredRole: "free",
  },
  journal_strategy_tags: {
    name: "journal_strategy_tags",
    displayName: "Strategy Tags",
    description: "Categorize trades with custom strategy tags",
    requiredRole: "pro",
  },
  journal_emotional_state: {
    name: "journal_emotional_state",
    displayName: "Emotional State Tracking",
    description: "Track emotional state and psychology for each trade",
    requiredRole: "pro",
  },
  journal_r_multiple: {
    name: "journal_r_multiple",
    displayName: "R-Multiple Analysis",
    description: "Calculate and track risk-adjusted returns (R-multiples)",
    requiredRole: "pro",
  },
  analytics_basic: {
    name: "analytics_basic",
    displayName: "Basic Analytics",
    description: "View basic trade statistics and P&L summary",
    requiredRole: "free",
  },
  analytics_pro: {
    name: "analytics_pro",
    displayName: "Pro Analytics",
    description: "Access equity curves, P&L by symbol, win-rate by strategy charts",
    requiredRole: "pro",
  },
  analytics_premium: {
    name: "analytics_premium",
    displayName: "Premium Analytics",
    description: "AI-powered insights, pattern detection, and psychology breakdown",
    requiredRole: "premium",
  },
  ai_coaching: {
    name: "ai_coaching",
    displayName: "AI Coaching",
    description: "Get AI-powered coaching on your trading psychology and habits",
    requiredRole: "premium",
  },
  ai_trade_review: {
    name: "ai_trade_review",
    displayName: "AI Trade Review",
    description: "Receive AI analysis and scoring of individual trades",
    requiredRole: "premium",
  },
  adaptive_insights: {
    name: "adaptive_insights",
    displayName: "Adaptive Insights",
    description: "Access insights from the global adaptive learning model",
    requiredRole: "premium",
  },
  ml_backtest: {
    name: "ml_backtest",
    displayName: "ML Backtesting",
    description: "Run machine learning powered strategy backtests",
    requiredRole: "premium",
  },
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

export function hasFeatureAccess(userRole: UserRole, feature: FeatureName, userId?: string | null): boolean {
  const config = FEATURE_FLAGS[feature];
  if (!config) return false;
  
  // Developers get premium-level access to all features
  if (isDeveloper(userId)) {
    return true;
  }
  
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[config.requiredRole];
  
  return userLevel >= requiredLevel;
}

export function getFeatureConfig(feature: FeatureName): FeatureConfig | undefined {
  return FEATURE_FLAGS[feature];
}

export function getFeaturesForRole(role: UserRole): FeatureName[] {
  return Object.keys(FEATURE_FLAGS).filter(
    (key) => hasFeatureAccess(role, key as FeatureName)
  ) as FeatureName[];
}

export function getLockedFeatures(role: UserRole): FeatureConfig[] {
  return Object.values(FEATURE_FLAGS).filter(
    (config) => !hasFeatureAccess(role, config.name)
  );
}

export function getAllFeatures(): FeatureConfig[] {
  return Object.values(FEATURE_FLAGS);
}
