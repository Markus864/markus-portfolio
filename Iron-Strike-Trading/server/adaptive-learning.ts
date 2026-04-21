import { storage } from "./storage";
import type { AdaptiveLearning, SelectSignalOutcome, SelectTradeExecution } from "@shared/schema";
import { getQuote } from "./market-data-service";

interface MarketCondition {
  trend: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  volatility: "LOW" | "MEDIUM" | "HIGH";
  momentum: number; // -1 to 1
}

interface AdaptiveConfidence {
  adjustedConfidence: number;
  confidenceAdjustment: number;
  reasoning: string;
  historicalSuccessRate: number;
  recentPerformance: "IMPROVING" | "DECLINING" | "STABLE";
}

export async function analyzeMarketCondition(
  symbol: string,
  currentPrice: number,
  priceHistory: number[] = []
): Promise<MarketCondition> {
  if (priceHistory.length < 5) {
    const mockChange = (Math.random() - 0.4) * 0.04;
    const volatility = Math.abs(mockChange);
    
    return {
      trend: mockChange > 0.01 ? "BULLISH" : mockChange < -0.01 ? "BEARISH" : "NEUTRAL",
      volatility: volatility > 0.025 ? "HIGH" : volatility > 0.015 ? "MEDIUM" : "LOW",
      momentum: Math.min(1, Math.max(-1, mockChange * 20)),
    };
  }
  
  const shortTermAvg = priceHistory.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const longTermAvg = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  const priceChange = (currentPrice - priceHistory[priceHistory.length - 1]) / priceHistory[priceHistory.length - 1];
  
  const prices = priceHistory.slice(-10);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const volatilityRatio = stdDev / avgPrice;
  
  let trend: "BULLISH" | "BEARISH" | "NEUTRAL" | "VOLATILE";
  if (volatilityRatio > 0.03) {
    trend = "VOLATILE";
  } else if (shortTermAvg > longTermAvg * 1.02) {
    trend = "BULLISH";
  } else if (shortTermAvg < longTermAvg * 0.98) {
    trend = "BEARISH";
  } else {
    trend = "NEUTRAL";
  }
  
  return {
    trend,
    volatility: volatilityRatio > 0.025 ? "HIGH" : volatilityRatio > 0.015 ? "MEDIUM" : "LOW",
    momentum: Math.min(1, Math.max(-1, priceChange * 10)),
  };
}

export async function getSymbolLearningMetrics(symbol: string): Promise<AdaptiveLearning> {
  // Get outcomes (trades that have been closed and evaluated)
  const outcomes = await storage.getSignalOutcomes(symbol);
  
  // Also get total signals generated from signal history (even without outcomes)
  const signalHistoryBySymbol = await storage.getSignalHistoryBySymbol(symbol);
  const totalSignalsGenerated = signalHistoryBySymbol.length;
  
  const successfulSignals = outcomes.filter(o => o.wasSuccessful === 1).length;
  const failedSignals = outcomes.filter(o => o.wasSuccessful === 0).length;
  const pendingSignals = outcomes.filter(o => o.wasSuccessful === null).length;
  
  // Use total signals from signal history, but track outcomes separately
  const totalSignalsWithOutcomes = outcomes.length;
  const totalSignals = Math.max(totalSignalsGenerated, totalSignalsWithOutcomes);
  
  const completedSignals = successfulSignals + failedSignals;
  const successRate = completedSignals > 0 ? successfulSignals / completedSignals : 0.5;
  
  const recent = outcomes.slice(-10);
  const recentSuccessful = recent.filter(o => o.wasSuccessful === 1).length;
  const recentCompleted = recent.filter(o => o.wasSuccessful !== null).length;
  const recentSuccessRate = recentCompleted > 0 ? recentSuccessful / recentCompleted : 0.5;
  
  let recentTrend: "IMPROVING" | "DECLINING" | "STABLE" = "STABLE";
  if (recentCompleted >= 5) {
    if (recentSuccessRate > successRate + 0.1) {
      recentTrend = "IMPROVING";
    } else if (recentSuccessRate < successRate - 0.1) {
      recentTrend = "DECLINING";
    }
  }
  
  // Use signals with outcomes for confidence calculation (only where we have actual data)
  const avgConfidenceAdjustment = calculateConfidenceAdjustment(successRate, totalSignalsWithOutcomes);
  
  const marketConditionAccuracy: Record<string, number> = {};
  const conditionGroups: Record<string, SelectSignalOutcome[]> = {};
  
  for (const outcome of outcomes) {
    const condition = outcome.marketCondition || "UNKNOWN";
    if (!conditionGroups[condition]) {
      conditionGroups[condition] = [];
    }
    conditionGroups[condition].push(outcome);
  }
  
  for (const [condition, group] of Object.entries(conditionGroups)) {
    const successful = group.filter(o => o.wasSuccessful === 1).length;
    const completed = group.filter(o => o.wasSuccessful !== null).length;
    marketConditionAccuracy[condition] = completed > 0 ? successful / completed : 0.5;
  }
  
  // pendingSignals: signals in outcomes table with null wasSuccessful (awaiting outcome)
  // Note: totalSignals includes all generated signals; pendingSignals only those with outcome records awaiting resolution
  
  return {
    symbol,
    totalSignals,
    successfulSignals,
    failedSignals,
    pendingSignals,
    successRate,
    avgConfidenceAdjustment,
    recentTrend,
    lastUpdated: new Date().toISOString(),
    marketConditionAccuracy,
  };
}

function calculateConfidenceAdjustment(successRate: number, sampleSize: number): number {
  if (sampleSize < 5) {
    return 0;
  }
  
  const sampleWeight = Math.min(1, sampleSize / 20);
  const deviation = (successRate - 0.5) * sampleWeight;
  
  return Math.max(-0.2, Math.min(0.2, deviation));
}

export async function getAdaptiveConfidence(
  symbol: string,
  baseConfidence: number,
  currentPrice: number,
  optionType: "CALL" | "PUT",
  marketCondition?: MarketCondition
): Promise<AdaptiveConfidence> {
  const metrics = await getSymbolLearningMetrics(symbol);
  
  let adjustment = metrics.avgConfidenceAdjustment;
  const reasons: string[] = [];
  
  if (metrics.totalSignals > 5) {
    if (metrics.successRate > 0.6) {
      reasons.push(`Strong historical performance (${(metrics.successRate * 100).toFixed(0)}% success rate)`);
    } else if (metrics.successRate < 0.4) {
      adjustment -= 0.1;
      reasons.push(`Below average historical performance (${(metrics.successRate * 100).toFixed(0)}% success rate)`);
    }
  } else {
    reasons.push("Limited historical data - using baseline confidence");
  }
  
  if (metrics.recentTrend === "IMPROVING") {
    adjustment += 0.05;
    reasons.push("Recent performance trend is improving");
  } else if (metrics.recentTrend === "DECLINING") {
    adjustment -= 0.05;
    reasons.push("Recent performance trend is declining");
  }
  
  if (marketCondition) {
    const conditionAccuracy = metrics.marketConditionAccuracy[marketCondition.trend];
    if (conditionAccuracy !== undefined && metrics.totalSignals > 10) {
      if (conditionAccuracy > 0.7) {
        adjustment += 0.05;
        reasons.push(`Strong performance in ${marketCondition.trend} conditions`);
      } else if (conditionAccuracy < 0.3) {
        adjustment -= 0.05;
        reasons.push(`Weak performance in ${marketCondition.trend} conditions`);
      }
    }
    
    if ((optionType === "CALL" && marketCondition.trend === "BULLISH") ||
        (optionType === "PUT" && marketCondition.trend === "BEARISH")) {
      adjustment += 0.03;
      reasons.push(`Option type aligns with current ${marketCondition.trend} trend`);
    } else if ((optionType === "CALL" && marketCondition.trend === "BEARISH") ||
               (optionType === "PUT" && marketCondition.trend === "BULLISH")) {
      adjustment -= 0.03;
      reasons.push(`Option type conflicts with current ${marketCondition.trend} trend`);
    }
  }
  
  const adjustedConfidence = Math.max(0.1, Math.min(0.95, baseConfidence + adjustment));
  
  return {
    adjustedConfidence,
    confidenceAdjustment: adjustment,
    reasoning: reasons.join(". "),
    historicalSuccessRate: metrics.successRate,
    recentPerformance: metrics.recentTrend,
  };
}

export async function recordSignalOutcome(
  signalId: number,
  symbol: string,
  action: string,
  optionType: string,
  strikePrice: number,
  expirationDate: string,
  entryPrice: number,
  entryPremium: number,
  originalConfidence: number,
  predictedDirection: "UP" | "DOWN"
): Promise<void> {
  const marketCondition = await analyzeMarketCondition(symbol, entryPrice);
  
  await storage.createSignalOutcome({
    signalId,
    symbol,
    action,
    optionType,
    strikePrice: strikePrice.toString(),
    expirationDate,
    entryPrice: entryPrice.toString(),
    entryPremium: entryPremium.toString(),
    predictedDirection,
    originalConfidence: originalConfidence.toString(),
    marketCondition: marketCondition.trend,
  });
}

export async function evaluateSignalOutcome(
  outcomeId: number,
  exitPrice: number,
  exitPremium: number,
  wasSuccessful: boolean
): Promise<void> {
  const outcome = await storage.getSignalOutcomeById(outcomeId);
  if (!outcome) return;
  
  const entryPremium = parseFloat(outcome.entryPremium as string);
  const profitLossPercent = ((exitPremium - entryPremium) / entryPremium) * 100;
  
  const actualDirection = exitPrice > parseFloat(outcome.entryPrice as string) ? "UP" : "DOWN";
  
  await storage.updateSignalOutcome(outcomeId, {
    exitPrice: exitPrice.toString(),
    exitPremium: exitPremium.toString(),
    actualDirection,
    wasSuccessful: wasSuccessful ? 1 : 0,
    profitLossPercent: profitLossPercent.toString(),
    evaluatedAt: new Date(),
  });
}

export async function getAllLearningMetrics(): Promise<AdaptiveLearning[]> {
  const symbols = await storage.getDistinctSymbolsFromOutcomes();
  const metrics: AdaptiveLearning[] = [];
  
  for (const symbol of symbols) {
    metrics.push(await getSymbolLearningMetrics(symbol));
  }
  
  return metrics;
}

export function getConfidenceGrade(confidence: number): {
  grade: "A" | "B" | "C" | "D" | "F";
  color: string;
  description: string;
} {
  if (confidence >= 0.85) {
    return { grade: "A", color: "emerald", description: "Very High Confidence" };
  } else if (confidence >= 0.70) {
    return { grade: "B", color: "green", description: "High Confidence" };
  } else if (confidence >= 0.55) {
    return { grade: "C", color: "yellow", description: "Moderate Confidence" };
  } else if (confidence >= 0.40) {
    return { grade: "D", color: "orange", description: "Low Confidence" };
  } else {
    return { grade: "F", color: "red", description: "Very Low Confidence" };
  }
}

export async function syncTradeExecutionToAdaptive(trade: SelectTradeExecution): Promise<void> {
  try {
    // Only process trades that came from a signal and are properly closed
    if (!trade.signalId) {
      return;
    }

    // Require valid exit data to evaluate the trade (use explicit null check, not falsy, since 0 is valid)
    if (trade.exitPremium === null || trade.exitPremium === undefined) {
      console.log(`[Adaptive] Skipping trade #${trade.id}: missing exitPremium`);
      return;
    }

    const outcomes = await storage.getSignalOutcomes(trade.symbol);
    if (!outcomes || outcomes.length === 0) {
      console.log(`[Adaptive] Skipping trade #${trade.id}: no signal outcomes for ${trade.symbol}`);
      return;
    }

    // Find matching outcomes for this signalId, sorted by most recent first
    const matching = outcomes
      .filter((o) => o.signalId === trade.signalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (matching.length === 0) {
      console.log(`[Adaptive] Skipping trade #${trade.id}: no matching outcome for signalId ${trade.signalId}`);
      return;
    }

    const outcome = matching[0];

    // Get current stock price for exit price comparison
    let exitPrice: number;
    try {
      const quote = await getQuote(trade.symbol);
      exitPrice = quote.price;
    } catch {
      // Fall back to entry price if quote fails - this is suboptimal but acceptable
      exitPrice = parseFloat(outcome.entryPrice as string);
    }

    const exitPremium = parseFloat(trade.exitPremium as string);

    // Determine success based on actual profit/loss values
    // Only mark successful if there's a clear positive profit
    let wasSuccessful = false;
    
    if (trade.profitLossPercent !== null && trade.profitLossPercent !== undefined) {
      const pct = parseFloat(trade.profitLossPercent as string);
      wasSuccessful = pct > 0;
    } else if (trade.profitLoss !== null && trade.profitLoss !== undefined) {
      const pl = parseFloat(trade.profitLoss as string);
      wasSuccessful = pl > 0;
    } else {
      // If no P/L data, compare exit premium to entry premium
      const entryPremium = parseFloat(trade.entryPremium as string);
      wasSuccessful = exitPremium > entryPremium;
    }

    await evaluateSignalOutcome(outcome.id, exitPrice, exitPremium, wasSuccessful);

    console.log(`[Adaptive] Synced trade #${trade.id} for ${trade.symbol}: ${wasSuccessful ? "SUCCESS" : "FAILURE"} (P/L: ${trade.profitLossPercent || 'N/A'}%)`);
  } catch (error) {
    console.error(`[Adaptive] Error syncing trade #${trade.id}:`, error);
  }
}
