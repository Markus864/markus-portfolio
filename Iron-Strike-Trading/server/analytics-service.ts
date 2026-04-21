import type { SelectTradeExecution } from "@shared/schema";
import { Tier } from "./utils/tier";

export interface BasicAnalytics {
  tier: "free" | "pro" | "premium";
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalPnL: number;
  winCount: number;
  lossCount: number;
  winRate: number;
}

export interface ProAnalytics extends Omit<BasicAnalytics, "tier"> {
  tier: "pro" | "premium";
  equityCurve: { date: string; equity: number; tradeId: number }[];
  pnlBySymbol: { symbol: string; pnl: number; trades: number; winRate: number }[];
  winRateByStrategy: { strategy: string; winRate: number; trades: number; avgPnl: number }[];
  rMultipleDistribution: { bucket: string; count: number }[];
  dayOfWeekStats: { day: string; trades: number; winRate: number; avgPnl: number }[];
  monthlyPnL: { month: string; pnl: number; trades: number }[];
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  expectancy: number;
  maxDrawdown: number;
  bestTrade: { symbol: string; pnl: number; date: string } | null;
  worstTrade: { symbol: string; pnl: number; date: string } | null;
  avgRMultiple: number;
}

export interface PremiumAnalytics extends Omit<ProAnalytics, "tier"> {
  tier: "premium";
  aiInsights: {
    tradingPatterns: string[];
    psychologyBreakdown: { bias: string; frequency: number; impact: string }[];
    optimizationSuggestions: string[];
    overallGrade: string;
    gradeColor: string;
  };
  patternDetection: {
    winningPatterns: { pattern: string; frequency: number; avgReturn: number }[];
    losingPatterns: { pattern: string; frequency: number; avgLoss: number }[];
  };
  adaptiveMetrics: {
    confidenceAdjustments: { symbol: string; adjustment: number }[];
    learningProgress: number;
  };
}

export type TieredAnalytics = BasicAnalytics | ProAnalytics | PremiumAnalytics;

function calculatePnL(trade: SelectTradeExecution): number {
  if (!trade.profitLoss) return 0;
  return parseFloat(trade.profitLoss);
}

function isWinningTrade(trade: SelectTradeExecution): boolean {
  return calculatePnL(trade) > 0;
}

function getDayOfWeek(dateStr: string | Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  return days[date.getDay()];
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function calculateRMultiple(trade: SelectTradeExecution): number | null {
  if (!trade.profitLoss || !trade.plannedRiskPerTrade) return null;
  const pnl = parseFloat(trade.profitLoss);
  const risk = parseFloat(trade.plannedRiskPerTrade);
  if (risk <= 0) return null;
  return pnl / risk;
}

export function calculateBasicAnalytics(trades: SelectTradeExecution[]): BasicAnalytics {
  const closedTrades = trades.filter(t => t.closedAt !== null);
  const openTrades = trades.filter(t => t.closedAt === null);
  
  let totalPnL = 0;
  let winCount = 0;
  let lossCount = 0;
  
  for (const trade of closedTrades) {
    const pnl = calculatePnL(trade);
    totalPnL += pnl;
    if (pnl > 0) winCount++;
    else if (pnl < 0) lossCount++;
  }
  
  const winRate = closedTrades.length > 0 ? (winCount / closedTrades.length) * 100 : 0;
  
  return {
    tier: "free",
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    totalPnL,
    winCount,
    lossCount,
    winRate,
  };
}

export function calculateProAnalytics(trades: SelectTradeExecution[]): ProAnalytics {
  const basic = calculateBasicAnalytics(trades);
  const closedTrades = trades.filter(t => t.closedAt !== null);
  
  const equityCurve: ProAnalytics["equityCurve"] = [];
  let runningEquity = 0;
  const sortedClosed = [...closedTrades].sort((a, b) => 
    new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime()
  );
  
  for (const trade of sortedClosed) {
    runningEquity += calculatePnL(trade);
    equityCurve.push({
      date: new Date(trade.closedAt!).toISOString().split("T")[0],
      equity: runningEquity,
      tradeId: trade.id,
    });
  }
  
  const symbolMap = new Map<string, { pnl: number; wins: number; total: number }>();
  for (const trade of closedTrades) {
    const pnl = calculatePnL(trade);
    const current = symbolMap.get(trade.symbol) || { pnl: 0, wins: 0, total: 0 };
    current.pnl += pnl;
    current.total++;
    if (pnl > 0) current.wins++;
    symbolMap.set(trade.symbol, current);
  }
  
  const pnlBySymbol: ProAnalytics["pnlBySymbol"] = Array.from(symbolMap.entries()).map(([symbol, data]) => ({
    symbol,
    pnl: data.pnl,
    trades: data.total,
    winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
  }));
  
  const strategyMap = new Map<string, { wins: number; total: number; totalPnl: number }>();
  for (const trade of closedTrades) {
    const strategy = trade.strategyTag || "Untagged";
    const pnl = calculatePnL(trade);
    const current = strategyMap.get(strategy) || { wins: 0, total: 0, totalPnl: 0 };
    current.total++;
    current.totalPnl += pnl;
    if (pnl > 0) current.wins++;
    strategyMap.set(strategy, current);
  }
  
  const winRateByStrategy: ProAnalytics["winRateByStrategy"] = Array.from(strategyMap.entries()).map(([strategy, data]) => ({
    strategy,
    winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
    trades: data.total,
    avgPnl: data.total > 0 ? data.totalPnl / data.total : 0,
  }));
  
  const rMultiples: number[] = [];
  for (const trade of closedTrades) {
    const rMultiple = calculateRMultiple(trade);
    if (rMultiple !== null) rMultiples.push(rMultiple);
  }
  
  const rBuckets = { "<-2R": 0, "-2R to -1R": 0, "-1R to 0": 0, "0 to 1R": 0, "1R to 2R": 0, ">2R": 0 };
  for (const r of rMultiples) {
    if (r < -2) rBuckets["<-2R"]++;
    else if (r < -1) rBuckets["-2R to -1R"]++;
    else if (r < 0) rBuckets["-1R to 0"]++;
    else if (r < 1) rBuckets["0 to 1R"]++;
    else if (r < 2) rBuckets["1R to 2R"]++;
    else rBuckets[">2R"]++;
  }
  
  const rMultipleDistribution: ProAnalytics["rMultipleDistribution"] = Object.entries(rBuckets).map(([bucket, count]) => ({
    bucket,
    count,
  }));
  
  const dayMap = new Map<string, { wins: number; total: number; totalPnl: number }>();
  for (const trade of closedTrades) {
    const day = getDayOfWeek(trade.closedAt!);
    const pnl = calculatePnL(trade);
    const current = dayMap.get(day) || { wins: 0, total: 0, totalPnl: 0 };
    current.total++;
    current.totalPnl += pnl;
    if (pnl > 0) current.wins++;
    dayMap.set(day, current);
  }
  
  const dayOfWeekStats: ProAnalytics["dayOfWeekStats"] = Array.from(dayMap.entries()).map(([day, data]) => ({
    day,
    trades: data.total,
    winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
    avgPnl: data.total > 0 ? data.totalPnl / data.total : 0,
  }));
  
  const monthMap = new Map<string, { pnl: number; trades: number }>();
  for (const trade of closedTrades) {
    const month = getMonthKey(new Date(trade.closedAt!));
    const pnl = calculatePnL(trade);
    const current = monthMap.get(month) || { pnl: 0, trades: 0 };
    current.pnl += pnl;
    current.trades++;
    monthMap.set(month, current);
  }
  
  const monthlyPnL: ProAnalytics["monthlyPnL"] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      pnl: data.pnl,
      trades: data.trades,
    }));
  
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let winTrades = 0;
  let lossTrades = 0;
  
  for (const trade of closedTrades) {
    const pnl = calculatePnL(trade);
    if (pnl > 0) {
      totalWinAmount += pnl;
      winTrades++;
    } else if (pnl < 0) {
      totalLossAmount += Math.abs(pnl);
      lossTrades++;
    }
  }
  
  const averageWin = winTrades > 0 ? totalWinAmount / winTrades : 0;
  const averageLoss = lossTrades > 0 ? totalLossAmount / lossTrades : 0;
  const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? Infinity : 0;
  
  const winRate = closedTrades.length > 0 ? winTrades / closedTrades.length : 0;
  const expectancy = (winRate * averageWin) - ((1 - winRate) * averageLoss);
  
  let peak = 0;
  let maxDrawdown = 0;
  runningEquity = 0;
  
  for (const trade of sortedClosed) {
    runningEquity += calculatePnL(trade);
    if (runningEquity > peak) peak = runningEquity;
    const drawdown = peak - runningEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  let bestTrade: ProAnalytics["bestTrade"] = null;
  let worstTrade: ProAnalytics["worstTrade"] = null;
  let bestPnl = -Infinity;
  let worstPnl = Infinity;
  
  for (const trade of closedTrades) {
    const pnl = calculatePnL(trade);
    if (pnl > bestPnl) {
      bestPnl = pnl;
      bestTrade = {
        symbol: trade.symbol,
        pnl,
        date: new Date(trade.closedAt!).toISOString().split("T")[0],
      };
    }
    if (pnl < worstPnl) {
      worstPnl = pnl;
      worstTrade = {
        symbol: trade.symbol,
        pnl,
        date: new Date(trade.closedAt!).toISOString().split("T")[0],
      };
    }
  }
  
  const avgRMultiple = rMultiples.length > 0 
    ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length 
    : 0;
  
  return {
    ...basic,
    tier: "pro",
    equityCurve,
    pnlBySymbol,
    winRateByStrategy,
    rMultipleDistribution,
    dayOfWeekStats,
    monthlyPnL,
    averageWin,
    averageLoss,
    profitFactor,
    expectancy,
    maxDrawdown,
    bestTrade,
    worstTrade,
    avgRMultiple,
  };
}

export async function calculatePremiumAnalytics(
  trades: SelectTradeExecution[],
  generateAIInsights: boolean = true
): Promise<PremiumAnalytics> {
  const proAnalytics = calculateProAnalytics(trades);
  const closedTrades = trades.filter(t => t.closedAt !== null);
  
  let aiInsights: PremiumAnalytics["aiInsights"] = {
    tradingPatterns: [],
    psychologyBreakdown: [],
    optimizationSuggestions: [],
    overallGrade: "B",
    gradeColor: "blue",
  };
  
  if (generateAIInsights && closedTrades.length >= 5) {
    const emotionalMap = new Map<string, { count: number; wins: number; losses: number }>();
    for (const trade of closedTrades) {
      const emotion = trade.emotionalState || "unknown";
      const current = emotionalMap.get(emotion) || { count: 0, wins: 0, losses: 0 };
      current.count++;
      if (calculatePnL(trade) > 0) current.wins++;
      else if (calculatePnL(trade) < 0) current.losses++;
      emotionalMap.set(emotion, current);
    }
    
    const psychologyBreakdown: PremiumAnalytics["aiInsights"]["psychologyBreakdown"] = [];
    for (const [bias, data] of Array.from(emotionalMap.entries())) {
      if (bias === "unknown") continue;
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      let impact = "neutral";
      if (winRate > 60) impact = "positive";
      else if (winRate < 40) impact = "negative";
      
      psychologyBreakdown.push({
        bias,
        frequency: data.count,
        impact,
      });
    }
    
    const patterns: string[] = [];
    if (proAnalytics.winRate > 60) patterns.push("Strong win rate indicates good entry timing");
    if (proAnalytics.winRate < 40) patterns.push("Low win rate suggests reviewing entry criteria");
    if (proAnalytics.profitFactor > 2) patterns.push("Excellent profit factor - winners outpace losers");
    if (proAnalytics.profitFactor < 1) patterns.push("Profit factor below 1 - losses exceed wins");
    if (proAnalytics.avgRMultiple > 1.5) patterns.push("Strong R-multiple performance");
    if (proAnalytics.avgRMultiple < 0.5) patterns.push("Consider tightening stop losses or letting winners run");
    
    const suggestions: string[] = [];
    if (proAnalytics.maxDrawdown > proAnalytics.totalPnL * 0.5) {
      suggestions.push("Consider smaller position sizes to reduce drawdown risk");
    }
    if (proAnalytics.averageLoss > proAnalytics.averageWin) {
      suggestions.push("Focus on letting winners run longer or cutting losses quicker");
    }
    const bestDay = proAnalytics.dayOfWeekStats.reduce((a, b) => a.winRate > b.winRate ? a : b, { day: "", winRate: 0, trades: 0, avgPnl: 0 });
    if (bestDay.day && bestDay.trades >= 3) {
      suggestions.push(`${bestDay.day} shows your best performance - consider focusing trading on this day`);
    }
    
    let grade = "C";
    let gradeColor = "yellow";
    if (proAnalytics.winRate >= 60 && proAnalytics.profitFactor >= 1.5) {
      grade = "A";
      gradeColor = "emerald";
    } else if (proAnalytics.winRate >= 50 && proAnalytics.profitFactor >= 1.2) {
      grade = "B";
      gradeColor = "blue";
    } else if (proAnalytics.winRate >= 40 || proAnalytics.profitFactor >= 1) {
      grade = "C";
      gradeColor = "yellow";
    } else {
      grade = "D";
      gradeColor = "red";
    }
    
    aiInsights = {
      tradingPatterns: patterns,
      psychologyBreakdown,
      optimizationSuggestions: suggestions,
      overallGrade: grade,
      gradeColor,
    };
  }
  
  const winningPatterns: PremiumAnalytics["patternDetection"]["winningPatterns"] = [];
  const losingPatterns: PremiumAnalytics["patternDetection"]["losingPatterns"] = [];
  
  const actionStats = new Map<string, { wins: number; losses: number; totalWin: number; totalLoss: number }>();
  for (const trade of closedTrades) {
    const action = trade.action;
    const pnl = calculatePnL(trade);
    const current = actionStats.get(action) || { wins: 0, losses: 0, totalWin: 0, totalLoss: 0 };
    if (pnl > 0) {
      current.wins++;
      current.totalWin += pnl;
    } else if (pnl < 0) {
      current.losses++;
      current.totalLoss += Math.abs(pnl);
    }
    actionStats.set(action, current);
  }
  
  for (const [action, stats] of Array.from(actionStats.entries())) {
    const total = stats.wins + stats.losses;
    if (total < 3) continue;
    const winRate = total > 0 ? stats.wins / total : 0;
    if (winRate >= 0.6) {
      winningPatterns.push({
        pattern: action,
        frequency: total,
        avgReturn: stats.wins > 0 ? stats.totalWin / stats.wins : 0,
      });
    } else if (winRate <= 0.4) {
      losingPatterns.push({
        pattern: action,
        frequency: total,
        avgLoss: stats.losses > 0 ? stats.totalLoss / stats.losses : 0,
      });
    }
  }
  
  return {
    ...proAnalytics,
    tier: "premium",
    aiInsights,
    patternDetection: {
      winningPatterns,
      losingPatterns,
    },
    adaptiveMetrics: {
      confidenceAdjustments: [],
      learningProgress: 0,
    },
  };
}

export async function getAnalyticsForTier(
  trades: SelectTradeExecution[],
  tier: Tier
): Promise<TieredAnalytics> {
  switch (tier) {
    case "premium":
      return calculatePremiumAnalytics(trades, true);
    case "pro":
      return calculateProAnalytics(trades);
    case "free":
    default:
      return calculateBasicAnalytics(trades);
  }
}
