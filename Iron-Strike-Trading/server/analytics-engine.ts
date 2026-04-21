import { db } from "./db";
import { 
  tradeExecutions, 
  signalHistory, 
  signalOutcomes, 
  strategies,
  type SelectTradeExecution,
  type SelectSignalHistory,
  type SelectSignalOutcome,
  type KPIMetrics,
  type CalibrationBin,
  type StrategyPerformance,
  type DTEBucket,
  type AnalyticsRange,
  type MistakeDetector,
} from "@shared/schema";
import { eq, and, gte, lte, isNull, isNotNull, desc, sql } from "drizzle-orm";

interface TradeWithPnL extends SelectTradeExecution {
  pnl: number;
  pnlPercent: number;
  holdTimeHours: number;
}

function getRangeStartDate(range: AnalyticsRange): Date {
  const now = new Date();
  switch (range) {
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "180d":
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function getDTEBucket(expirationDate: string | null, executedAt: Date): DTEBucket {
  if (!expirationDate) return "1M+";
  
  const expiry = new Date(expirationDate);
  const diffDays = Math.ceil((expiry.getTime() - executedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return "0DTE";
  if (diffDays <= 7) return "1W";
  if (diffDays <= 14) return "2W";
  if (diffDays <= 21) return "3W";
  if (diffDays <= 30) return "1M";
  return "1M+";
}

function parseTradeForAnalytics(trade: SelectTradeExecution): TradeWithPnL {
  const pnl = parseFloat(String(trade.profitLoss || 0));
  const pnlPercent = parseFloat(String(trade.profitLossPercent || 0));
  const holdTimeHours = trade.closedAt && trade.executedAt 
    ? (new Date(trade.closedAt).getTime() - new Date(trade.executedAt).getTime()) / (1000 * 60 * 60)
    : 0;
  
  return {
    ...trade,
    pnl,
    pnlPercent,
    holdTimeHours,
  };
}

export function calculateKPIMetrics(trades: TradeWithPnL[]): KPIMetrics {
  const closedTrades = trades.filter(t => t.status !== "open");
  
  if (closedTrades.length === 0) {
    return {
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      avgRMultiple: null,
      netPnL: 0,
      maxDrawdown: 0,
      avgHoldTime: 0,
      bestDayPnL: 0,
      worstDayPnL: 0,
      disciplineScore: 0,
      signalEdge: null,
      calibrationScore: null,
      highConfidenceHitRate: null,
      tradesCount: 0,
      winningTrades: 0,
      losingTrades: 0,
    };
  }
  
  const winningTrades = closedTrades.filter(t => t.pnl > 0);
  const losingTrades = closedTrades.filter(t => t.pnl < 0);
  
  const winRate = winningTrades.length / closedTrades.length;
  
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  const netPnL = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const expectancy = netPnL / closedTrades.length;
  
  const avgHoldTime = closedTrades.reduce((sum, t) => sum + t.holdTimeHours, 0) / closedTrades.length;
  
  const tradesWithR = closedTrades.filter(t => t.realizedRMultiple !== null);
  const avgRMultiple = tradesWithR.length > 0
    ? tradesWithR.reduce((sum, t) => sum + parseFloat(String(t.realizedRMultiple)), 0) / tradesWithR.length
    : null;
  
  let runningPnL = 0;
  let peak = 0;
  let maxDrawdown = 0;
  
  const sortedTrades = [...closedTrades].sort((a, b) => 
    new Date(a.closedAt || a.executedAt).getTime() - new Date(b.closedAt || b.executedAt).getTime()
  );
  
  for (const trade of sortedTrades) {
    runningPnL += trade.pnl;
    if (runningPnL > peak) {
      peak = runningPnL;
    }
    const drawdown = peak - runningPnL;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  const dailyPnL = new Map<string, number>();
  for (const trade of closedTrades) {
    const date = new Date(trade.closedAt || trade.executedAt).toISOString().split('T')[0];
    dailyPnL.set(date, (dailyPnL.get(date) || 0) + trade.pnl);
  }
  
  const dailyValues = Array.from(dailyPnL.values());
  const bestDayPnL = dailyValues.length > 0 ? Math.max(...dailyValues) : 0;
  const worstDayPnL = dailyValues.length > 0 ? Math.min(...dailyValues) : 0;
  
  let journalComplete = 0;
  let stopsHonored = 0;
  let stopsTotal = 0;
  
  for (const trade of closedTrades) {
    if (trade.notes || trade.whatWentWell || trade.whatWentWrong || trade.lessonLearned) {
      journalComplete++;
    }
    if (trade.plannedStopPrice) {
      stopsTotal++;
      if (trade.pnl < 0 && trade.exitPremium) {
        stopsHonored++;
      }
    }
  }
  
  const journalScore = closedTrades.length > 0 ? (journalComplete / closedTrades.length) * 50 : 0;
  const stopsScore = stopsTotal > 0 ? (stopsHonored / stopsTotal) * 50 : 25;
  const disciplineScore = Math.round(journalScore + stopsScore);
  
  return {
    winRate,
    profitFactor: isFinite(profitFactor) ? profitFactor : 0,
    expectancy,
    avgRMultiple,
    netPnL,
    maxDrawdown,
    avgHoldTime,
    bestDayPnL,
    worstDayPnL,
    disciplineScore,
    signalEdge: null,
    calibrationScore: null,
    highConfidenceHitRate: null,
    tradesCount: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
  };
}

export async function getKPIsByRange(
  range: AnalyticsRange,
  userId?: string
): Promise<{
  overall: KPIMetrics;
  bySymbol: Record<string, KPIMetrics>;
  byDTEBucket: Record<DTEBucket, KPIMetrics>;
  byDirection: Record<string, KPIMetrics>;
}> {
  const startDate = getRangeStartDate(range);
  
  let query = db.select().from(tradeExecutions)
    .where(
      and(
        gte(tradeExecutions.executedAt, startDate),
        isNotNull(tradeExecutions.closedAt)
      )
    );
  
  const rawTrades = await query;
  const trades = rawTrades
    .filter(t => !userId || t.userId === userId)
    .map(parseTradeForAnalytics);
  
  const overall = calculateKPIMetrics(trades);
  
  const bySymbol: Record<string, KPIMetrics> = {};
  const symbolGroups = new Map<string, TradeWithPnL[]>();
  for (const trade of trades) {
    const symbol = trade.symbol;
    if (!symbolGroups.has(symbol)) {
      symbolGroups.set(symbol, []);
    }
    symbolGroups.get(symbol)!.push(trade);
  }
  for (const [symbol, symbolTrades] of Array.from(symbolGroups.entries())) {
    bySymbol[symbol] = calculateKPIMetrics(symbolTrades);
  }
  
  const byDTEBucket: Record<DTEBucket, KPIMetrics> = {
    "0DTE": calculateKPIMetrics([]),
    "1W": calculateKPIMetrics([]),
    "2W": calculateKPIMetrics([]),
    "3W": calculateKPIMetrics([]),
    "1M": calculateKPIMetrics([]),
    "1M+": calculateKPIMetrics([]),
  };
  const dteGroups = new Map<DTEBucket, TradeWithPnL[]>();
  for (const trade of trades) {
    const bucket = getDTEBucket(trade.expirationDate, new Date(trade.executedAt));
    if (!dteGroups.has(bucket)) {
      dteGroups.set(bucket, []);
    }
    dteGroups.get(bucket)!.push(trade);
  }
  for (const [bucket, bucketTrades] of Array.from(dteGroups.entries())) {
    byDTEBucket[bucket as DTEBucket] = calculateKPIMetrics(bucketTrades);
  }
  
  const byDirection: Record<string, KPIMetrics> = {};
  const directionGroups = new Map<string, TradeWithPnL[]>();
  for (const trade of trades) {
    const direction = trade.optionType || "UNKNOWN";
    if (!directionGroups.has(direction)) {
      directionGroups.set(direction, []);
    }
    directionGroups.get(direction)!.push(trade);
  }
  for (const [direction, directionTrades] of Array.from(directionGroups.entries())) {
    byDirection[direction] = calculateKPIMetrics(directionTrades);
  }
  
  return { overall, bySymbol, byDTEBucket, byDirection };
}

export async function getStrategyPerformance(
  range: AnalyticsRange,
  userId?: string
): Promise<StrategyPerformance[]> {
  const startDate = getRangeStartDate(range);
  
  const allStrategies = await db.select().from(strategies);
  
  const rawTrades = await db.select().from(tradeExecutions)
    .where(
      and(
        gte(tradeExecutions.executedAt, startDate),
        isNotNull(tradeExecutions.closedAt)
      )
    );
  
  const trades = rawTrades
    .filter(t => !userId || t.userId === userId)
    .map(parseTradeForAnalytics);
  
  const results: StrategyPerformance[] = [];
  
  for (const strategy of allStrategies) {
    const strategyTrades = trades.filter(t => 
      t.strategyId === strategy.id || 
      t.strategyTag?.toLowerCase() === strategy.name.toLowerCase()
    );
    
    if (strategyTrades.length === 0) continue;
    
    const metrics = calculateKPIMetrics(strategyTrades);
    
    const dailyPnL = new Map<string, { netPnL: number; count: number }>();
    for (const trade of strategyTrades) {
      const date = new Date(trade.closedAt || trade.executedAt).toISOString().split('T')[0];
      const existing = dailyPnL.get(date) || { netPnL: 0, count: 0 };
      dailyPnL.set(date, {
        netPnL: existing.netPnL + trade.pnl,
        count: existing.count + 1,
      });
    }
    
    const sortedDates = Array.from(dailyPnL.keys()).sort();
    let cumulative = 0;
    const timeSeries = sortedDates.map(date => {
      const day = dailyPnL.get(date)!;
      cumulative += day.netPnL;
      return {
        date,
        netPnL: day.netPnL,
        cumulativePnL: cumulative,
        tradesCount: day.count,
      };
    });
    
    const symbolPnL = new Map<string, number>();
    for (const trade of strategyTrades) {
      symbolPnL.set(trade.symbol, (symbolPnL.get(trade.symbol) || 0) + trade.pnl);
    }
    const sortedSymbols = Array.from(symbolPnL.entries()).sort((a, b) => b[1] - a[1]);
    const bestSymbol = sortedSymbols.length > 0 ? sortedSymbols[0][0] : null;
    const worstSymbol = sortedSymbols.length > 0 ? sortedSymbols[sortedSymbols.length - 1][0] : null;
    
    const dailyReturns = timeSeries.map((d, i) => {
      if (i === 0) return 0;
      return d.netPnL;
    });
    const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const variance = dailyReturns.length > 0 
      ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeLike = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    results.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      metrics,
      timeSeries,
      bestSymbol,
      worstSymbol,
      sharpeLike: isFinite(sharpeLike) ? sharpeLike : 0,
    });
  }
  
  const untaggedTrades = trades.filter(t => !t.strategyId && !t.strategyTag);
  if (untaggedTrades.length > 0) {
    const metrics = calculateKPIMetrics(untaggedTrades);
    
    const dailyPnL = new Map<string, { netPnL: number; count: number }>();
    for (const trade of untaggedTrades) {
      const date = new Date(trade.closedAt || trade.executedAt).toISOString().split('T')[0];
      const existing = dailyPnL.get(date) || { netPnL: 0, count: 0 };
      dailyPnL.set(date, {
        netPnL: existing.netPnL + trade.pnl,
        count: existing.count + 1,
      });
    }
    
    const sortedDates = Array.from(dailyPnL.keys()).sort();
    let cumulative = 0;
    const timeSeries = sortedDates.map(date => {
      const day = dailyPnL.get(date)!;
      cumulative += day.netPnL;
      return {
        date,
        netPnL: day.netPnL,
        cumulativePnL: cumulative,
        tradesCount: day.count,
      };
    });
    
    results.push({
      strategyId: 0,
      strategyName: "Untagged Trades",
      metrics,
      timeSeries,
      bestSymbol: null,
      worstSymbol: null,
      sharpeLike: 0,
    });
  }
  
  return results.sort((a, b) => b.metrics.netPnL - a.metrics.netPnL);
}

export async function getConfidenceCalibration(
  range: AnalyticsRange,
  bins: number = 10
): Promise<{
  bins: CalibrationBin[];
  calibrationError: number;
  evaluatedCount: number;
  pendingCount: number;
}> {
  const startDate = getRangeStartDate(range);
  
  const outcomes = await db.select().from(signalOutcomes)
    .where(gte(signalOutcomes.createdAt, startDate));
  
  const evaluated = outcomes.filter(o => o.wasSuccessful !== null);
  const pending = outcomes.filter(o => o.wasSuccessful === null);
  
  const binSize = 1.0 / bins;
  const calibrationBins: CalibrationBin[] = [];
  
  for (let i = 0; i < bins; i++) {
    const binStart = i * binSize;
    const binEnd = (i + 1) * binSize;
    const midpoint = (binStart + binEnd) / 2;
    
    const binOutcomes = evaluated.filter(o => {
      const conf = parseFloat(String(o.originalConfidence));
      return conf >= binStart && conf < binEnd;
    });
    
    const wins = binOutcomes.filter(o => o.wasSuccessful === 1).length;
    const winRate = binOutcomes.length > 0 ? wins / binOutcomes.length : 0;
    const avgPnL = binOutcomes.length > 0
      ? binOutcomes.reduce((sum, o) => sum + parseFloat(String(o.profitLossPercent || 0)), 0) / binOutcomes.length
      : 0;
    
    calibrationBins.push({
      binStart,
      binEnd,
      binLabel: `${(binStart * 100).toFixed(0)}-${(binEnd * 100).toFixed(0)}%`,
      count: binOutcomes.length,
      winRate,
      avgPnL,
      avgRMultiple: null,
      predictedConfidence: midpoint,
      observedWinRate: winRate,
    });
  }
  
  let totalError = 0;
  let totalSamples = 0;
  for (const bin of calibrationBins) {
    if (bin.count > 0) {
      totalError += Math.abs(bin.predictedConfidence - bin.observedWinRate) * bin.count;
      totalSamples += bin.count;
    }
  }
  const calibrationError = totalSamples > 0 ? totalError / totalSamples : 0;
  
  return {
    bins: calibrationBins,
    calibrationError,
    evaluatedCount: evaluated.length,
    pendingCount: pending.length,
  };
}

export async function getUserVsAIComparison(
  range: AnalyticsRange,
  userId?: string
): Promise<{
  aiBaseline: KPIMetrics;
  userTakenTrades: KPIMetrics;
  userManualTrades: KPIMetrics;
  edge: number;
  takenCount: number;
  manualCount: number;
  skippedCount: number;
  timeSeries: Array<{
    date: string;
    aiCumulativePnL: number;
    userCumulativePnL: number;
  }>;
}> {
  const startDate = getRangeStartDate(range);
  
  const outcomes = await db.select().from(signalOutcomes)
    .where(
      and(
        gte(signalOutcomes.createdAt, startDate),
        isNotNull(signalOutcomes.wasSuccessful)
      )
    );
  
  const rawTrades = await db.select().from(tradeExecutions)
    .where(
      and(
        gte(tradeExecutions.executedAt, startDate),
        isNotNull(tradeExecutions.closedAt)
      )
    );
  
  const trades = rawTrades
    .filter(t => !userId || t.userId === userId)
    .map(parseTradeForAnalytics);
  
  const aiBuildTrades: TradeWithPnL[] = outcomes.map(o => ({
    id: o.id,
    signalId: o.signalId,
    strategyId: null,
    userId: null,
    symbol: o.symbol,
    action: o.action,
    optionType: o.optionType,
    optionSide: null,
    strikePrice: String(o.strikePrice),
    expirationDate: o.expirationDate,
    entryPremium: String(o.entryPremium),
    exitPremium: o.exitPremium ? String(o.exitPremium) : null,
    contracts: 1,
    contractMultiplier: 100,
    totalCost: String(parseFloat(String(o.entryPremium)) * 100),
    targetPremiumPercent: null,
    stopLossPremiumPercent: null,
    status: o.wasSuccessful === 1 ? "won" : "lost",
    profitLoss: null,
    profitLossPercent: o.profitLossPercent ? String(o.profitLossPercent) : null,
    executedAt: o.createdAt,
    closedAt: o.evaluatedAt,
    notes: null,
    source: "ironstrike",
    assetType: "option",
    strategyTag: null,
    tagList: null,
    sessionTag: null,
    emotionalState: null,
    whatWentWell: null,
    whatWentWrong: null,
    lessonLearned: null,
    screenshotUrl: null,
    plannedRiskPerTrade: null,
    plannedStopPrice: null,
    plannedTakeProfitPrice: null,
    realizedRMultiple: null,
    pnl: parseFloat(String(o.profitLossPercent || 0)) * parseFloat(String(o.entryPremium)) / 100,
    pnlPercent: parseFloat(String(o.profitLossPercent || 0)),
    holdTimeHours: 0,
  }));
  
  const aiBaseline = calculateKPIMetrics(aiBuildTrades);
  
  const takenTrades = trades.filter(t => t.signalId !== null);
  const manualTrades = trades.filter(t => t.signalId === null);
  
  const userTakenTradesMetrics = calculateKPIMetrics(takenTrades);
  const userManualTradesMetrics = calculateKPIMetrics(manualTrades);
  
  const aiPnL = aiBaseline.netPnL;
  const userPnL = userTakenTradesMetrics.netPnL + userManualTradesMetrics.netPnL;
  const edge = aiPnL !== 0 ? ((userPnL - aiPnL) / Math.abs(aiPnL)) * 100 : userPnL > 0 ? 100 : 0;
  
  const signalIds = new Set(outcomes.map(o => o.signalId));
  const takenSignalIds = new Set(takenTrades.filter(t => t.signalId).map(t => t.signalId));
  const skippedCount = signalIds.size - takenSignalIds.size;
  
  const allDates = new Set<string>();
  for (const o of outcomes) {
    allDates.add(new Date(o.createdAt).toISOString().split('T')[0]);
  }
  for (const t of trades) {
    if (t.closedAt) {
      allDates.add(new Date(t.closedAt).toISOString().split('T')[0]);
    }
  }
  
  const sortedDates = Array.from(allDates).sort();
  let aiCumulative = 0;
  let userCumulative = 0;
  
  const timeSeries = sortedDates.map(date => {
    const dayOutcomes = outcomes.filter(o => 
      new Date(o.createdAt).toISOString().split('T')[0] === date
    );
    const dayTrades = trades.filter(t => 
      t.closedAt && new Date(t.closedAt).toISOString().split('T')[0] === date
    );
    
    const dayAiPnL = dayOutcomes.reduce((sum, o) => {
      const pnl = parseFloat(String(o.profitLossPercent || 0)) * parseFloat(String(o.entryPremium)) / 100;
      return sum + pnl;
    }, 0);
    
    const dayUserPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    aiCumulative += dayAiPnL;
    userCumulative += dayUserPnL;
    
    return {
      date,
      aiCumulativePnL: aiCumulative,
      userCumulativePnL: userCumulative,
    };
  });
  
  return {
    aiBaseline,
    userTakenTrades: userTakenTradesMetrics,
    userManualTrades: userManualTradesMetrics,
    edge: isFinite(edge) ? edge : 0,
    takenCount: takenTrades.length,
    manualCount: manualTrades.length,
    skippedCount: Math.max(0, skippedCount),
    timeSeries,
  };
}

export async function migrateStrategyTagsToStrategies(userId?: string): Promise<{
  migrated: number;
  strategies: Array<{ id: number; name: string }>;
}> {
  const trades = await db.select().from(tradeExecutions)
    .where(
      and(
        isNotNull(tradeExecutions.strategyTag),
        isNull(tradeExecutions.strategyId)
      )
    );
  
  const uniqueTags = new Set(trades.map(t => t.strategyTag).filter(Boolean));
  const existingStrategies = await db.select().from(strategies);
  const existingNames = new Set(existingStrategies.map(s => s.name.toLowerCase()));
  
  const createdStrategies: Array<{ id: number; name: string }> = [];
  
  for (const tag of Array.from(uniqueTags)) {
    if (!tag || existingNames.has(tag.toLowerCase())) continue;
    
    const [created] = await db.insert(strategies).values({
      userId: userId || null,
      name: tag,
      description: `Auto-migrated from strategy tag "${tag}"`,
      isActive: 1,
    }).returning();
    
    createdStrategies.push({ id: created.id, name: created.name });
    existingNames.add(tag.toLowerCase());
  }
  
  const allStrategies = await db.select().from(strategies);
  const nameToId = new Map(allStrategies.map(s => [s.name.toLowerCase(), s.id]));
  
  let migrated = 0;
  for (const trade of trades) {
    if (!trade.strategyTag) continue;
    const strategyId = nameToId.get(trade.strategyTag.toLowerCase());
    if (strategyId) {
      await db.update(tradeExecutions)
        .set({ strategyId })
        .where(eq(tradeExecutions.id, trade.id));
      migrated++;
    }
  }
  
  return { migrated, strategies: createdStrategies };
}

export async function getMistakeDetector(
  range: AnalyticsRange,
  userId?: string
): Promise<MistakeDetector> {
  const startDate = getRangeStartDate(range);
  
  const rawTrades = await db.select().from(tradeExecutions)
    .where(
      and(
        gte(tradeExecutions.executedAt, startDate),
        isNotNull(tradeExecutions.closedAt),
        isNotNull(tradeExecutions.signalId)
      )
    );
  
  const signals = await db.select().from(signalHistory)
    .where(gte(signalHistory.generatedAt, startDate));
  
  const signalMap = new Map(signals.map(s => [s.id, s]));
  
  const trades = rawTrades
    .filter(t => !userId || t.userId === userId)
    .map(parseTradeForAnalytics);
  
  const followed: TradeWithPnL[] = [];
  const overrode: TradeWithPnL[] = [];
  const overrideDetails: MistakeDetector["overrideDetails"] = [];
  
  let strikeOverrides = 0;
  let expiryOverrides = 0;
  let directionOverrides = 0;
  
  for (const trade of trades) {
    if (!trade.signalId) continue;
    
    const signal = signalMap.get(trade.signalId);
    if (!signal) continue;
    
    const tradeStrike = parseFloat(String(trade.strikePrice || 0));
    const signalStrike = parseFloat(String(signal.strikePrice || 0));
    const strikeMatch = Math.abs(tradeStrike - signalStrike) < 0.01;
    
    const expiryMatch = trade.expirationDate === signal.expirationDate;
    
    const signalDirection = signal.action;
    const tradeDirection = trade.action;
    const directionMatch = signalDirection === tradeDirection;
    
    if (strikeMatch && expiryMatch && directionMatch) {
      followed.push(trade);
    } else {
      overrode.push(trade);
      
      let overrideType: "strike" | "expiry" | "direction" | "multiple" = "multiple";
      const overrideCount = (!strikeMatch ? 1 : 0) + (!expiryMatch ? 1 : 0) + (!directionMatch ? 1 : 0);
      
      if (overrideCount === 1) {
        if (!strikeMatch) { overrideType = "strike"; strikeOverrides++; }
        else if (!expiryMatch) { overrideType = "expiry"; expiryOverrides++; }
        else if (!directionMatch) { overrideType = "direction"; directionOverrides++; }
      } else {
        if (!strikeMatch) strikeOverrides++;
        if (!expiryMatch) expiryOverrides++;
        if (!directionMatch) directionOverrides++;
      }
      
      overrideDetails.push({
        tradeId: trade.id,
        symbol: trade.symbol,
        overrideType,
        signalAction: `${signalDirection} @ $${signalStrike} exp ${signal.expirationDate}`,
        userAction: `${tradeDirection} @ $${tradeStrike} exp ${trade.expirationDate}`,
        pnl: trade.pnl,
        date: new Date(trade.executedAt).toISOString().split('T')[0],
      });
    }
  }
  
  const followedWins = followed.filter(t => t.pnl > 0).length;
  const followedNetPnL = followed.reduce((sum, t) => sum + t.pnl, 0);
  const followedAvgPnL = followed.length > 0 ? followedNetPnL / followed.length : 0;
  
  const overrodeWins = overrode.filter(t => t.pnl > 0).length;
  const overrodeNetPnL = overrode.reduce((sum, t) => sum + t.pnl, 0);
  const overrodeAvgPnL = overrode.length > 0 ? overrodeNetPnL / overrode.length : 0;
  
  const costOfOverrides = followed.length > 0 && overrode.length > 0
    ? (followedAvgPnL - overrodeAvgPnL) * overrode.length
    : 0;
  
  return {
    followedSignals: {
      count: followed.length,
      winRate: followed.length > 0 ? followedWins / followed.length : 0,
      netPnL: followedNetPnL,
      avgPnL: followedAvgPnL,
    },
    overrodeSignals: {
      count: overrode.length,
      winRate: overrode.length > 0 ? overrodeWins / overrode.length : 0,
      netPnL: overrodeNetPnL,
      avgPnL: overrodeAvgPnL,
      strikeOverrides,
      expiryOverrides,
      directionOverrides,
    },
    costOfOverrides,
    overrideDetails: overrideDetails.sort((a, b) => a.pnl - b.pnl),
  };
}
