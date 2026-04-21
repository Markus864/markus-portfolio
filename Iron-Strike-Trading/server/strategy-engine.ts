// Strategy Evaluation Engine
// Evaluates trading strategies against historical market data

import { 
  ConditionGroup, 
  StrategyCondition, 
  IndicatorType, 
  ComparisonOperator,
  SelectTradingStrategy 
} from "@shared/schema";
import { getHistoricalData, HistoricalDataPoint } from "./market-data-service";

// Technical Indicator Calculations (mirrors frontend calculations)
function calculateSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index < period - 1) return null;
    const sum = data.slice(index - period + 1, index + 1).reduce((acc, d) => acc + d, 0);
    return sum / period;
  });
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const multiplier = 2 / (period + 1);
  const ema: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((acc, d) => acc + d, 0);
      ema.push(sum / period);
    } else {
      const prevEma = ema[i - 1] as number;
      ema.push((data[i] - prevEma) * multiplier + prevEma);
    }
  }
  return ema;
}

function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rsi.push(null);
      continue;
    }
    
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
    
    if (i < period) {
      rsi.push(null);
      continue;
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
}

function calculateMACD(data: number[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  const macd: (number | null)[] = data.map((_, i) => {
    if (ema12[i] === null || ema26[i] === null) return null;
    return (ema12[i] as number) - (ema26[i] as number);
  });
  
  const macdData = macd.filter((v): v is number => v !== null);
  const signalRaw = calculateEMA(macdData, 9);
  
  const signal: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
    } else {
      signal.push(signalRaw[signalIdx] || null);
      signalIdx++;
    }
  }
  
  const histogram: (number | null)[] = macd.map((m, i) => {
    if (m === null || signal[i] === null) return null;
    return m - (signal[i] as number);
  });
  
  return { macd, signal, histogram };
}

// Get indicator value at a specific index
function getIndicatorValue(
  indicator: IndicatorType,
  period: number | undefined,
  index: number,
  closePrices: number[],
  indicators: {
    sma: Map<number, (number | null)[]>;
    ema: Map<number, (number | null)[]>;
    rsi: Map<number, (number | null)[]>;
    macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[]; };
  }
): number | null {
  switch (indicator) {
    case "PRICE":
      return closePrices[index];
    
    case "SMA": {
      const p = period || 20;
      if (!indicators.sma.has(p)) {
        indicators.sma.set(p, calculateSMA(closePrices, p));
      }
      return indicators.sma.get(p)![index];
    }
    
    case "EMA": {
      const p = period || 20;
      if (!indicators.ema.has(p)) {
        indicators.ema.set(p, calculateEMA(closePrices, p));
      }
      return indicators.ema.get(p)![index];
    }
    
    case "RSI": {
      const p = period || 14;
      if (!indicators.rsi.has(p)) {
        indicators.rsi.set(p, calculateRSI(closePrices, p));
      }
      return indicators.rsi.get(p)![index];
    }
    
    case "MACD":
      return indicators.macd.macd[index];
    
    case "MACD_SIGNAL":
      return indicators.macd.signal[index];
    
    case "MACD_HISTOGRAM":
      return indicators.macd.histogram[index];
    
    default:
      return null;
  }
}

// Evaluate a single condition at a specific index
function evaluateCondition(
  condition: StrategyCondition,
  index: number,
  closePrices: number[],
  indicators: {
    sma: Map<number, (number | null)[]>;
    ema: Map<number, (number | null)[]>;
    rsi: Map<number, (number | null)[]>;
    macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[]; };
  }
): boolean {
  const leftValue = getIndicatorValue(
    condition.indicator,
    condition.period,
    index,
    closePrices,
    indicators
  );
  
  if (leftValue === null) return false;
  
  let rightValue: number | null;
  if (condition.compareTo.type === "VALUE") {
    rightValue = condition.compareTo.value;
  } else {
    rightValue = getIndicatorValue(
      condition.compareTo.indicator,
      condition.compareTo.period,
      index,
      closePrices,
      indicators
    );
  }
  
  if (rightValue === null) return false;
  
  // For crossover detection, we need the previous values
  const prevLeftValue = index > 0 ? getIndicatorValue(
    condition.indicator,
    condition.period,
    index - 1,
    closePrices,
    indicators
  ) : null;
  
  let prevRightValue: number | null = null;
  if (condition.compareTo.type === "VALUE") {
    prevRightValue = condition.compareTo.value;
  } else if (index > 0) {
    prevRightValue = getIndicatorValue(
      condition.compareTo.indicator,
      condition.compareTo.period,
      index - 1,
      closePrices,
      indicators
    );
  }
  
  switch (condition.operator) {
    case "GREATER_THAN":
      return leftValue > rightValue;
    
    case "LESS_THAN":
      return leftValue < rightValue;
    
    case "EQUALS":
      return Math.abs(leftValue - rightValue) < 0.01; // Small tolerance
    
    case "CROSSES_ABOVE":
      if (prevLeftValue === null || prevRightValue === null) return false;
      return prevLeftValue <= prevRightValue && leftValue > rightValue;
    
    case "CROSSES_BELOW":
      if (prevLeftValue === null || prevRightValue === null) return false;
      return prevLeftValue >= prevRightValue && leftValue < rightValue;
    
    default:
      return false;
  }
}

// Evaluate a condition group (AND/OR logic)
function evaluateConditionGroup(
  group: ConditionGroup,
  index: number,
  closePrices: number[],
  indicators: {
    sma: Map<number, (number | null)[]>;
    ema: Map<number, (number | null)[]>;
    rsi: Map<number, (number | null)[]>;
    macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[]; };
  }
): boolean {
  if (group.logic === "AND") {
    return group.conditions.every(c => evaluateCondition(c, index, closePrices, indicators));
  } else {
    return group.conditions.some(c => evaluateCondition(c, index, closePrices, indicators));
  }
}

// Evaluate a complete strategy at a specific index (all groups connected by AND)
function evaluateStrategy(
  conditionGroups: ConditionGroup[],
  index: number,
  closePrices: number[],
  indicators: {
    sma: Map<number, (number | null)[]>;
    ema: Map<number, (number | null)[]>;
    rsi: Map<number, (number | null)[]>;
    macd: { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[]; };
  }
): boolean {
  return conditionGroups.every(group => 
    evaluateConditionGroup(group, index, closePrices, indicators)
  );
}

export interface StrategySignal {
  date: string;
  action: "BUY" | "SELL";
  price: number;
  strategyName: string;
  strategyId: number;
}

export interface BacktestResult {
  strategyId: number;
  strategyName: string;
  symbol: string;
  signals: StrategySignal[];
  totalSignals: number;
  period: string;
}

// Evaluate a strategy against historical data for a symbol
export async function evaluateStrategyForSymbol(
  strategy: SelectTradingStrategy,
  symbol: string,
  period: string = "3mo"
): Promise<BacktestResult> {
  // Fetch historical data
  const historicalData = await getHistoricalData(symbol, period as any);
  
  if (historicalData.length === 0) {
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol,
      signals: [],
      totalSignals: 0,
      period
    };
  }
  
  // Parse condition groups
  let conditionGroups: ConditionGroup[];
  try {
    conditionGroups = JSON.parse(strategy.conditionGroups);
  } catch {
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol,
      signals: [],
      totalSignals: 0,
      period
    };
  }
  
  // Extract close prices
  const closePrices = historicalData.map(d => d.close);
  
  // Pre-compute MACD (always needed)
  const macdData = calculateMACD(closePrices);
  
  // Initialize indicator cache
  const indicators = {
    sma: new Map<number, (number | null)[]>(),
    ema: new Map<number, (number | null)[]>(),
    rsi: new Map<number, (number | null)[]>(),
    macd: macdData
  };
  
  // Find signals
  const signals: StrategySignal[] = [];
  
  // Start from index 30 to ensure indicators have enough data
  const startIndex = Math.min(30, Math.floor(historicalData.length / 4));
  
  for (let i = startIndex; i < historicalData.length; i++) {
    const result = evaluateStrategy(conditionGroups, i, closePrices, indicators);
    
    if (result) {
      signals.push({
        date: historicalData[i].date.toISOString().split('T')[0],
        action: strategy.action as "BUY" | "SELL",
        price: closePrices[i],
        strategyName: strategy.name,
        strategyId: strategy.id
      });
    }
  }
  
  // Sort signals chronologically by date
  signals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    symbol,
    signals,
    totalSignals: signals.length,
    period
  };
}

// Evaluate all enabled strategies for a symbol
export async function evaluateAllStrategiesForSymbol(
  strategies: SelectTradingStrategy[],
  symbol: string,
  period: string = "3mo"
): Promise<BacktestResult[]> {
  const results: BacktestResult[] = [];
  
  for (const strategy of strategies) {
    if (strategy.enabled === 1) {
      const result = await evaluateStrategyForSymbol(strategy, symbol, period);
      results.push(result);
    }
  }
  
  return results;
}

// Get the latest strategy signals for a symbol (last data point only)
export async function getLatestStrategySignals(
  strategies: SelectTradingStrategy[],
  symbol: string
): Promise<StrategySignal[]> {
  const signals: StrategySignal[] = [];
  
  // Fetch recent data
  const historicalData = await getHistoricalData(symbol, "1mo");
  
  if (historicalData.length === 0) {
    return signals;
  }
  
  const closePrices = historicalData.map(d => d.close);
  const macdData = calculateMACD(closePrices);
  
  const indicators = {
    sma: new Map<number, (number | null)[]>(),
    ema: new Map<number, (number | null)[]>(),
    rsi: new Map<number, (number | null)[]>(),
    macd: macdData
  };
  
  const lastIndex = closePrices.length - 1;
  
  for (const strategy of strategies) {
    if (strategy.enabled !== 1) continue;
    
    let conditionGroups: ConditionGroup[];
    try {
      conditionGroups = JSON.parse(strategy.conditionGroups);
    } catch {
      continue;
    }
    
    const result = evaluateStrategy(conditionGroups, lastIndex, closePrices, indicators);
    
    if (result) {
      signals.push({
        date: historicalData[lastIndex].date.toISOString().split('T')[0],
        action: strategy.action as "BUY" | "SELL",
        price: closePrices[lastIndex],
        strategyName: strategy.name,
        strategyId: strategy.id
      });
    }
  }
  
  return signals;
}
