import type { Tier } from "./tier";

export interface SignalEntitlements {
  showGreeks: boolean;
  showContractDetails: boolean;
  showFullAnalysis: boolean;
  showDataSnapshot: boolean;
  maxSymbolsPerRequest: number;
  limitedHistory: boolean;
  historyDays: number;
}

export interface ScreenshotEntitlements {
  allowed: boolean;
  includeAICoaching: boolean;
  visionModel: "gpt-4o-mini" | "gpt-4o";
  rateLimit: number;
  rateLimitWindow: number;
}

export interface JournalEntitlements {
  allowManualEntry: boolean;
  allowScreenshotImport: boolean;
  allowStrategyTags: boolean;
  allowEmotionalState: boolean;
  allowRMultiple: boolean;
  allowAICoaching: boolean;
  allowExportCSV: boolean;
  maxTradesStored: number | null;
}

export interface AnalyticsEntitlements {
  basicStats: boolean;
  equityCurve: boolean;
  symbolBreakdown: boolean;
  strategyBreakdown: boolean;
  aiInsights: boolean;
  weeklyReview: boolean;
  patternDetection: boolean;
}

export interface BacktestEntitlements {
  allowed: boolean;
  maxDays: number;
  includeMLPredictions: boolean;
}

export interface AdaptiveEntitlements {
  viewSymbolMetrics: boolean;
  viewAllSymbols: boolean;
  viewTrends: boolean;
  viewGlobalInsights: boolean;
}

export interface TierEntitlements {
  signals: SignalEntitlements;
  screenshot: ScreenshotEntitlements;
  journal: JournalEntitlements;
  analytics: AnalyticsEntitlements;
  backtest: BacktestEntitlements;
  adaptive: AdaptiveEntitlements;
}

export const ENTITLEMENTS: Record<Tier, TierEntitlements> = {
  free: {
    signals: {
      showGreeks: false,
      showContractDetails: false,
      showFullAnalysis: false,
      showDataSnapshot: false,
      maxSymbolsPerRequest: 1,
      limitedHistory: true,
      historyDays: 7,
    },
    screenshot: {
      allowed: false,
      includeAICoaching: false,
      visionModel: "gpt-4o-mini",
      rateLimit: 0,
      rateLimitWindow: 60000,
    },
    journal: {
      allowManualEntry: true,
      allowScreenshotImport: false,
      allowStrategyTags: false,
      allowEmotionalState: false,
      allowRMultiple: false,
      allowAICoaching: false,
      allowExportCSV: false,
      maxTradesStored: 50,
    },
    analytics: {
      basicStats: true,
      equityCurve: false,
      symbolBreakdown: false,
      strategyBreakdown: false,
      aiInsights: false,
      weeklyReview: false,
      patternDetection: false,
    },
    backtest: {
      allowed: false,
      maxDays: 0,
      includeMLPredictions: false,
    },
    adaptive: {
      viewSymbolMetrics: false,
      viewAllSymbols: false,
      viewTrends: false,
      viewGlobalInsights: false,
    },
  },
  pro: {
    signals: {
      showGreeks: true,
      showContractDetails: true,
      showFullAnalysis: true,
      showDataSnapshot: false,
      maxSymbolsPerRequest: 5,
      limitedHistory: false,
      historyDays: 90,
    },
    screenshot: {
      allowed: true,
      includeAICoaching: false,
      visionModel: "gpt-4o-mini",
      rateLimit: 20,
      rateLimitWindow: 3600000,
    },
    journal: {
      allowManualEntry: true,
      allowScreenshotImport: true,
      allowStrategyTags: true,
      allowEmotionalState: true,
      allowRMultiple: true,
      allowAICoaching: false,
      allowExportCSV: true,
      maxTradesStored: null,
    },
    analytics: {
      basicStats: true,
      equityCurve: true,
      symbolBreakdown: true,
      strategyBreakdown: true,
      aiInsights: false,
      weeklyReview: false,
      patternDetection: false,
    },
    backtest: {
      allowed: true,
      maxDays: 90,
      includeMLPredictions: false,
    },
    adaptive: {
      viewSymbolMetrics: true,
      viewAllSymbols: false,
      viewTrends: false,
      viewGlobalInsights: false,
    },
  },
  premium: {
    signals: {
      showGreeks: true,
      showContractDetails: true,
      showFullAnalysis: true,
      showDataSnapshot: true,
      maxSymbolsPerRequest: 20,
      limitedHistory: false,
      historyDays: 365,
    },
    screenshot: {
      allowed: true,
      includeAICoaching: true,
      visionModel: "gpt-4o",
      rateLimit: 100,
      rateLimitWindow: 3600000,
    },
    journal: {
      allowManualEntry: true,
      allowScreenshotImport: true,
      allowStrategyTags: true,
      allowEmotionalState: true,
      allowRMultiple: true,
      allowAICoaching: true,
      allowExportCSV: true,
      maxTradesStored: null,
    },
    analytics: {
      basicStats: true,
      equityCurve: true,
      symbolBreakdown: true,
      strategyBreakdown: true,
      aiInsights: true,
      weeklyReview: true,
      patternDetection: true,
    },
    backtest: {
      allowed: true,
      maxDays: 365,
      includeMLPredictions: true,
    },
    adaptive: {
      viewSymbolMetrics: true,
      viewAllSymbols: true,
      viewTrends: true,
      viewGlobalInsights: true,
    },
  },
};

export function getEntitlements(tier: Tier): TierEntitlements {
  return ENTITLEMENTS[tier] || ENTITLEMENTS.free;
}

export function getSignalEntitlements(tier: Tier): SignalEntitlements {
  return getEntitlements(tier).signals;
}

export function getScreenshotEntitlements(tier: Tier): ScreenshotEntitlements {
  return getEntitlements(tier).screenshot;
}

export function getJournalEntitlements(tier: Tier): JournalEntitlements {
  return getEntitlements(tier).journal;
}

export function getAnalyticsEntitlements(tier: Tier): AnalyticsEntitlements {
  return getEntitlements(tier).analytics;
}

export function getBacktestEntitlements(tier: Tier): BacktestEntitlements {
  return getEntitlements(tier).backtest;
}

export function getAdaptiveEntitlements(tier: Tier): AdaptiveEntitlements {
  return getEntitlements(tier).adaptive;
}
