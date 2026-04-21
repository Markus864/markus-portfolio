export type UserRole = "free" | "pro" | "premium";

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
  | "export_data";

export interface FeatureConfig {
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
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

export function hasFeatureAccess(userRole: UserRole, feature: FeatureName): boolean {
  const config = FEATURE_FLAGS[feature];
  if (!config) return false;
  
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[config.requiredRole];
  
  return userLevel >= requiredLevel;
}

export function getLockedFeatures(role: UserRole): FeatureConfig[] {
  return Object.values(FEATURE_FLAGS).filter(
    (config) => !hasFeatureAccess(role, config.name)
  );
}
