import { getHistoricalData } from './market-data-service';
import { getQuote } from './market-data-service';

export type StratCandleType = 1 | 2 | 3;
export type StratDirection = 'up' | 'down' | 'neutral';

export interface StratCandle {
  type: StratCandleType;
  direction: StratDirection;
  high: number;
  low: number;
  open: number;
  close: number;
  date: string;
}

export interface StratPattern {
  name: string;
  signal: 'STRONG_BUY' | 'BUY' | 'STRONG_SELL' | 'SELL' | 'NEUTRAL';
  description: string;
  confidence: number;
}

export interface StratAnalysis {
  recentCandles: StratCandle[];
  currentPattern: StratPattern | null;
  ftfc: {
    daily: StratDirection;
    weekly: StratDirection;
    monthly: StratDirection;
    alignment: 'ALL_BULLISH' | 'ALL_BEARISH' | 'MIXED';
  };
  triggerLevel: {
    bullish: number;
    bearish: number;
  };
}

export interface TechnicalIndicators {
  symbol: string;
  currentPrice: number;
  volume: number;
  averageVolume: number;
  volumeRatio: number;
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    sma200: number;
    ema9: number;
    ema21: number;
    priceVsSma20: number;
    priceVsSma50: number;
    priceVsSma200: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    bandwidth: number;
  };
  atr14: number;
  support: number;
  resistance: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  priceChange1d: number;
  priceChange5d: number;
  priceChange1m: number;
  recentPrices: number[];
  strat: StratAnalysis;
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices: number[]): { macdLine: number; signalLine: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macdLine = ema12 - ema26;
  
  const macdValues: number[] = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = calculateEMA(slice, 12);
    const e26 = calculateEMA(slice, 26);
    macdValues.push(e12 - e26);
  }
  
  const signalLine = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : macdLine;
  const histogram = macdLine - signalLine;
  
  return { macdLine, signalLine, histogram };
}

function calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
  bandwidth: number;
} {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  
  const squaredDiffs = slice.map(p => Math.pow(p - sma, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / period;
  const standardDeviation = Math.sqrt(variance);
  
  const upper = sma + (stdDev * standardDeviation);
  const lower = sma - (stdDev * standardDeviation);
  const currentPrice = prices[prices.length - 1];
  
  const percentB = (currentPrice - lower) / (upper - lower);
  const bandwidth = (upper - lower) / sma;
  
  return { upper, middle: sma, lower, percentB, bandwidth };
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0;
  
  const trueRanges: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }
  
  return calculateSMA(trueRanges.slice(-period), period);
}

function findSupportResistance(highs: number[], lows: number[], closes: number[]): { support: number; resistance: number } {
  if (closes.length < 5) {
    const lastPrice = closes[closes.length - 1] || 100;
    return { support: lastPrice * 0.95, resistance: lastPrice * 1.05 };
  }
  
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const currentPrice = closes[closes.length - 1];
  
  const lowsBelow = recentLows.filter(l => l < currentPrice).sort((a, b) => b - a);
  const highsAbove = recentHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
  
  const support = lowsBelow.length > 0 ? lowsBelow[0] : currentPrice * 0.95;
  const resistance = highsAbove.length > 0 ? highsAbove[0] : currentPrice * 1.05;
  
  return { support, resistance };
}

// STRAT Methodology Functions (Rob Smith)
function getStratCandleType(
  currentHigh: number, 
  currentLow: number, 
  prevHigh: number, 
  prevLow: number
): StratCandleType {
  const higherHigh = currentHigh > prevHigh;
  const lowerLow = currentLow < prevLow;
  
  if (higherHigh && lowerLow) {
    return 3; // Outside bar - takes out both previous high and low
  } else if (!higherHigh && !lowerLow) {
    return 1; // Inside bar - contained within previous bar
  } else {
    return 2; // Directional bar - takes out one side only
  }
}

function getStratDirection(open: number, close: number, high: number, low: number): StratDirection {
  const bodySize = Math.abs(close - open);
  const totalRange = high - low;
  
  if (totalRange === 0) return 'neutral';
  
  // Use body direction, with range consideration
  if (close > open) {
    return 'up';
  } else if (close < open) {
    return 'down';
  }
  return 'neutral';
}

function analyzeStratCandles(
  opens: number[], 
  highs: number[], 
  lows: number[], 
  closes: number[],
  dates: string[]
): StratCandle[] {
  const candles: StratCandle[] = [];
  
  for (let i = 1; i < opens.length; i++) {
    const type = getStratCandleType(highs[i], lows[i], highs[i-1], lows[i-1]);
    const direction = getStratDirection(opens[i], closes[i], highs[i], lows[i]);
    
    candles.push({
      type,
      direction,
      high: highs[i],
      low: lows[i],
      open: opens[i],
      close: closes[i],
      date: dates[i] || ''
    });
  }
  
  return candles;
}

function detectStratPattern(candles: StratCandle[]): StratPattern | null {
  if (candles.length < 3) return null;
  
  const recent = candles.slice(-5); // Last 5 candles for pattern detection
  const last3 = recent.slice(-3);
  
  if (last3.length < 3) return null;
  
  const [c1, c2, c3] = last3;
  const patternSequence = `${c1.type}-${c2.type}-${c3.type}`;
  
  // 2-1-2 Bullish Reversal: Down bar → Inside bar → Up bar breaking bar 1's high
  // Per Rob Smith: Bar 3 must take out Bar 1's extreme (the directional bar), not just Bar 2
  if (patternSequence === '2-1-2' && 
      c1.direction === 'down' && 
      c3.direction === 'up' && 
      c3.high > c1.high) {
    return {
      name: '2-1-2 Bullish Reversal',
      signal: 'STRONG_BUY',
      description: 'Inside bar breakout to the upside, breaking prior directional bar high. Classic reversal setup.',
      confidence: 0.85
    };
  }
  
  // 2-1-2 Bearish Reversal: Up bar → Inside bar → Down bar breaking bar 1's low
  // Per Rob Smith: Bar 3 must take out Bar 1's extreme (the directional bar), not just Bar 2
  if (patternSequence === '2-1-2' && 
      c1.direction === 'up' && 
      c3.direction === 'down' && 
      c3.low < c1.low) {
    return {
      name: '2-1-2 Bearish Reversal',
      signal: 'STRONG_SELL',
      description: 'Inside bar breakout to the downside, breaking prior directional bar low. Classic reversal setup.',
      confidence: 0.85
    };
  }
  
  // 3-2-2 Bullish Continuation: Outside bar → Up directional → Up continuation
  if (patternSequence === '3-2-2' && 
      c2.direction === 'up' && 
      c3.direction === 'up') {
    return {
      name: '3-2-2 Bullish Continuation',
      signal: 'BUY',
      description: 'Outside bar followed by two up bars. Trend continuation confirmed.',
      confidence: 0.75
    };
  }
  
  // 3-2-2 Bearish Continuation: Outside bar → Down directional → Down continuation
  if (patternSequence === '3-2-2' && 
      c2.direction === 'down' && 
      c3.direction === 'down') {
    return {
      name: '3-2-2 Bearish Continuation',
      signal: 'SELL',
      description: 'Outside bar followed by two down bars. Trend continuation confirmed.',
      confidence: 0.75
    };
  }
  
  // 3-1-2 Bullish: Outside bar → Inside bar → Up breakout
  if (patternSequence === '3-1-2' && 
      c3.direction === 'up' && 
      c3.high > c2.high) {
    return {
      name: '3-1-2 Bullish Breakout',
      signal: 'BUY',
      description: 'Outside bar creates range, inside bar coils, then breaks up. Explosive move potential.',
      confidence: 0.80
    };
  }
  
  // 3-1-2 Bearish: Outside bar → Inside bar → Down breakout
  if (patternSequence === '3-1-2' && 
      c3.direction === 'down' && 
      c3.low < c2.low) {
    return {
      name: '3-1-2 Bearish Breakout',
      signal: 'SELL',
      description: 'Outside bar creates range, inside bar coils, then breaks down. Explosive move potential.',
      confidence: 0.80
    };
  }
  
  // 1-2 Bullish: Inside bar coiling followed by up breakout
  const last2 = last3.slice(-2);
  if (last2[0].type === 1 && last2[1].type === 2 && 
      last2[1].direction === 'up' && last2[1].high > last2[0].high) {
    return {
      name: '1-2 Bullish Breakout',
      signal: 'BUY',
      description: 'Inside bar coil released to upside. Energy expansion.',
      confidence: 0.70
    };
  }
  
  // 1-2 Bearish: Inside bar coiling followed by down breakout
  if (last2[0].type === 1 && last2[1].type === 2 && 
      last2[1].direction === 'down' && last2[1].low < last2[0].low) {
    return {
      name: '1-2 Bearish Breakout',
      signal: 'SELL',
      description: 'Inside bar coil released to downside. Energy expansion.',
      confidence: 0.70
    };
  }
  
  return null;
}

function calculateFTFC(
  opens: number[],
  closes: number[], 
  timeframe: 'daily' | 'weekly' | 'monthly'
): StratDirection {
  // STRAT FTFC: Aggregate candles into proper timeframe and check direction
  // Daily: Use last candle's direction
  // Weekly: Aggregate last 5 daily candles into one weekly candle
  // Monthly: Aggregate last ~21 daily candles into one monthly candle
  
  if (opens.length < 5 || closes.length < 5) return 'neutral';
  
  let periodOpen: number;
  let periodClose: number;
  
  if (timeframe === 'daily') {
    // Just use the most recent daily candle
    periodOpen = opens[opens.length - 1];
    periodClose = closes[closes.length - 1];
  } else if (timeframe === 'weekly') {
    // Aggregate last 5 trading days into a weekly candle
    const numDays = Math.min(5, opens.length);
    periodOpen = opens[opens.length - numDays]; // Open of period start
    periodClose = closes[closes.length - 1]; // Close of period end
  } else {
    // Monthly: Aggregate last ~21 trading days
    const numDays = Math.min(21, opens.length);
    periodOpen = opens[opens.length - numDays]; // Open of period start
    periodClose = closes[closes.length - 1]; // Close of period end
  }
  
  // Determine candle direction based on open vs close (STRAT methodology)
  if (periodClose > periodOpen) {
    return 'up'; // Green candle
  } else if (periodClose < periodOpen) {
    return 'down'; // Red candle
  }
  
  return 'neutral';
}

function calculateStratAnalysis(
  opens: number[],
  highs: number[], 
  lows: number[], 
  closes: number[],
  dates: string[]
): StratAnalysis {
  const stratCandles = analyzeStratCandles(opens, highs, lows, closes, dates);
  const recentCandles = stratCandles.slice(-5);
  const currentPattern = detectStratPattern(stratCandles);
  
  // Calculate FTFC (Full Time Frame Continuity) using aggregated timeframe candles
  const dailyTrend = calculateFTFC(opens.slice(-20), closes.slice(-20), 'daily');
  const weeklyTrend = calculateFTFC(opens.slice(-60), closes.slice(-60), 'weekly');
  const monthlyTrend = calculateFTFC(opens, closes, 'monthly');
  
  let ftfcAlignment: 'ALL_BULLISH' | 'ALL_BEARISH' | 'MIXED' = 'MIXED';
  if (dailyTrend === 'up' && weeklyTrend === 'up' && monthlyTrend === 'up') {
    ftfcAlignment = 'ALL_BULLISH';
  } else if (dailyTrend === 'down' && weeklyTrend === 'down' && monthlyTrend === 'down') {
    ftfcAlignment = 'ALL_BEARISH';
  }
  
  // Calculate trigger levels (breakout points)
  const lastCandle = recentCandles[recentCandles.length - 1];
  const triggerBullish = lastCandle?.high || closes[closes.length - 1] * 1.01;
  const triggerBearish = lastCandle?.low || closes[closes.length - 1] * 0.99;
  
  return {
    recentCandles,
    currentPattern,
    ftfc: {
      daily: dailyTrend,
      weekly: weeklyTrend,
      monthly: monthlyTrend,
      alignment: ftfcAlignment
    },
    triggerLevel: {
      bullish: Number(triggerBullish.toFixed(2)),
      bearish: Number(triggerBearish.toFixed(2))
    }
  };
}

export async function calculateTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
  const quote = await getQuote(symbol);
  const historicalData = await getHistoricalData(symbol, '3mo');
  
  if (historicalData.length < 2) {
    return getDefaultIndicators(symbol, quote.price);
  }
  
  const closes = historicalData.map(d => d.close);
  const highs = historicalData.map(d => d.high);
  const lows = historicalData.map(d => d.low);
  const volumes = historicalData.map(d => d.volume);
  
  const currentPrice = quote.price || closes[closes.length - 1];
  const currentVolume = quote.volume || volumes[volumes.length - 1] || 0;
  const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 1;
  
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, Math.min(200, closes.length));
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  
  const rsi14 = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes, 20, 2);
  const atr14 = calculateATR(highs, lows, closes, 14);
  const { support, resistance } = findSupportResistance(highs, lows, closes);
  
  let maTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentPrice > sma20 && currentPrice > sma50 && sma20 > sma50) {
    maTrend = 'bullish';
  } else if (currentPrice < sma20 && currentPrice < sma50 && sma20 < sma50) {
    maTrend = 'bearish';
  }
  
  let macdTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (macdData.histogram > 0 && macdData.macdLine > 0) {
    macdTrend = 'bullish';
  } else if (macdData.histogram < 0 && macdData.macdLine < 0) {
    macdTrend = 'bearish';
  }
  
  const priceChange1d = closes.length > 1 
    ? ((currentPrice - closes[closes.length - 2]) / closes[closes.length - 2]) * 100 
    : 0;
  const priceChange5d = closes.length > 5 
    ? ((currentPrice - closes[closes.length - 6]) / closes[closes.length - 6]) * 100 
    : 0;
  const priceChange1m = closes.length > 20 
    ? ((currentPrice - closes[closes.length - 21]) / closes[closes.length - 21]) * 100 
    : 0;
  
  const dayHigh = quote.dayHigh || highs[highs.length - 1] || currentPrice;
  const dayLow = quote.dayLow || lows[lows.length - 1] || currentPrice;
  const week52High = quote.week52High || Math.max(...highs);
  const week52Low = quote.week52Low || Math.min(...lows);
  
  // Calculate STRAT analysis
  const opens = historicalData.map(d => d.open);
  const dates = historicalData.map(d => d.date.toISOString().split('T')[0]);
  const stratAnalysis = calculateStratAnalysis(opens, highs, lows, closes, dates);

  return {
    symbol,
    currentPrice,
    volume: currentVolume,
    averageVolume: avgVolume,
    volumeRatio: avgVolume > 0 ? currentVolume / avgVolume : 1,
    rsi14: Number(rsi14.toFixed(2)),
    macd: {
      macdLine: Number(macdData.macdLine.toFixed(4)),
      signalLine: Number(macdData.signalLine.toFixed(4)),
      histogram: Number(macdData.histogram.toFixed(4)),
      trend: macdTrend,
    },
    movingAverages: {
      sma20: Number(sma20.toFixed(2)),
      sma50: Number(sma50.toFixed(2)),
      sma200: Number(sma200.toFixed(2)),
      ema9: Number(ema9.toFixed(2)),
      ema21: Number(ema21.toFixed(2)),
      priceVsSma20: Number(((currentPrice - sma20) / sma20 * 100).toFixed(2)),
      priceVsSma50: Number(((currentPrice - sma50) / sma50 * 100).toFixed(2)),
      priceVsSma200: Number(((currentPrice - sma200) / sma200 * 100).toFixed(2)),
      trend: maTrend,
    },
    bollingerBands: {
      upper: Number(bollingerBands.upper.toFixed(2)),
      middle: Number(bollingerBands.middle.toFixed(2)),
      lower: Number(bollingerBands.lower.toFixed(2)),
      percentB: Number(bollingerBands.percentB.toFixed(2)),
      bandwidth: Number(bollingerBands.bandwidth.toFixed(4)),
    },
    atr14: Number(atr14.toFixed(2)),
    support: Number(support.toFixed(2)),
    resistance: Number(resistance.toFixed(2)),
    dayHigh: Number(dayHigh.toFixed(2)),
    dayLow: Number(dayLow.toFixed(2)),
    week52High: Number(week52High.toFixed(2)),
    week52Low: Number(week52Low.toFixed(2)),
    priceChange1d: Number(priceChange1d.toFixed(2)),
    priceChange5d: Number(priceChange5d.toFixed(2)),
    priceChange1m: Number(priceChange1m.toFixed(2)),
    recentPrices: closes.slice(-10).map(p => Number(p.toFixed(2))),
    strat: stratAnalysis,
  };
}

function getDefaultIndicators(symbol: string, price: number): TechnicalIndicators {
  return {
    symbol,
    currentPrice: price,
    volume: 0,
    averageVolume: 0,
    volumeRatio: 1,
    rsi14: 50,
    macd: { macdLine: 0, signalLine: 0, histogram: 0, trend: 'neutral' },
    movingAverages: {
      sma20: price,
      sma50: price,
      sma200: price,
      ema9: price,
      ema21: price,
      priceVsSma20: 0,
      priceVsSma50: 0,
      priceVsSma200: 0,
      trend: 'neutral',
    },
    bollingerBands: {
      upper: price * 1.02,
      middle: price,
      lower: price * 0.98,
      percentB: 0.5,
      bandwidth: 0.04,
    },
    atr14: price * 0.02,
    support: price * 0.95,
    resistance: price * 1.05,
    dayHigh: price,
    dayLow: price,
    week52High: price * 1.20,
    week52Low: price * 0.80,
    priceChange1d: 0,
    priceChange5d: 0,
    priceChange1m: 0,
    recentPrices: [price],
    strat: {
      recentCandles: [],
      currentPattern: null,
      ftfc: { daily: 'neutral', weekly: 'neutral', monthly: 'neutral', alignment: 'MIXED' },
      triggerLevel: { bullish: price * 1.01, bearish: price * 0.99 }
    }
  };
}

export function formatIndicatorsForAI(indicators: TechnicalIndicators): string {
  const { rsi14, macd, movingAverages: ma, bollingerBands: bb, strat } = indicators;
  
  let rsiStatus = 'neutral';
  if (rsi14 > 70) rsiStatus = 'OVERBOUGHT';
  else if (rsi14 < 30) rsiStatus = 'OVERSOLD';
  else if (rsi14 > 60) rsiStatus = 'bullish';
  else if (rsi14 < 40) rsiStatus = 'bearish';
  
  let bbStatus = 'middle';
  if (bb.percentB > 1) bbStatus = 'ABOVE UPPER BAND (overbought)';
  else if (bb.percentB < 0) bbStatus = 'BELOW LOWER BAND (oversold)';
  else if (bb.percentB > 0.8) bbStatus = 'near upper band';
  else if (bb.percentB < 0.2) bbStatus = 'near lower band';
  
  // Format STRAT candles
  const stratCandleSequence = strat.recentCandles.length > 0 
    ? strat.recentCandles.map(c => `${c.type}${c.direction === 'up' ? '↑' : c.direction === 'down' ? '↓' : '→'}`).join(' → ')
    : 'No data';
  
  const stratPatternInfo = strat.currentPattern 
    ? `
• DETECTED PATTERN: ${strat.currentPattern.name} (${(strat.currentPattern.confidence * 100).toFixed(0)}% confidence)
• SIGNAL: ${strat.currentPattern.signal}
• DESCRIPTION: ${strat.currentPattern.description}`
    : '• NO STRAT PATTERN DETECTED - Wait for setup or use other analysis';
  
  return `
═══════════════════════════════════════════════════════════════
REAL-TIME MARKET DATA FOR ${indicators.symbol}
═══════════════════════════════════════════════════════════════

【STRAT ANALYSIS - Rob Smith Methodology】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECENT CANDLE SEQUENCE (Type + Direction):
${stratCandleSequence}
(1=Inside, 2=Directional, 3=Outside | ↑=Up, ↓=Down, →=Neutral)
${stratPatternInfo}

FULL TIME FRAME CONTINUITY (FTFC):
• Daily Trend: ${strat.ftfc.daily.toUpperCase()}
• Weekly Trend: ${strat.ftfc.weekly.toUpperCase()}
• Monthly Trend: ${strat.ftfc.monthly.toUpperCase()}
• ALIGNMENT: ${strat.ftfc.alignment}
${strat.ftfc.alignment === 'ALL_BULLISH' ? '  → MAXIMUM CONVICTION LONG - All timeframes aligned bullish' :
  strat.ftfc.alignment === 'ALL_BEARISH' ? '  → MAXIMUM CONVICTION SHORT - All timeframes aligned bearish' :
  '  → MIXED/REDUCED CONVICTION - Timeframes not aligned, use caution'}

TRIGGER LEVELS:
• Bullish Trigger (break above): $${strat.triggerLevel.bullish}
• Bearish Trigger (break below): $${strat.triggerLevel.bearish}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRICE ACTION:
• Current Price: $${indicators.currentPrice.toFixed(2)}
• Day Range: $${indicators.dayLow} - $${indicators.dayHigh}
• 52-Week Range: $${indicators.week52Low} - $${indicators.week52High}
• Price Change: 1D ${indicators.priceChange1d > 0 ? '+' : ''}${indicators.priceChange1d}% | 5D ${indicators.priceChange5d > 0 ? '+' : ''}${indicators.priceChange5d}% | 1M ${indicators.priceChange1m > 0 ? '+' : ''}${indicators.priceChange1m}%

VOLUME ANALYSIS:
• Current Volume: ${(indicators.volume / 1000000).toFixed(2)}M
• Average Volume: ${(indicators.averageVolume / 1000000).toFixed(2)}M
• Volume Ratio: ${indicators.volumeRatio.toFixed(2)}x average ${indicators.volumeRatio > 1.5 ? '(HIGH VOLUME)' : indicators.volumeRatio < 0.5 ? '(LOW VOLUME)' : ''}

KEY SUPPORT/RESISTANCE:
• SUPPORT: $${indicators.support} (${((indicators.currentPrice - indicators.support) / indicators.support * 100).toFixed(1)}% below current)
• RESISTANCE: $${indicators.resistance} (${((indicators.resistance - indicators.currentPrice) / indicators.currentPrice * 100).toFixed(1)}% above current)

MOMENTUM INDICATORS:
• RSI(14): ${rsi14} - ${rsiStatus.toUpperCase()}
• MACD Line: ${macd.macdLine.toFixed(4)} | Signal: ${macd.signalLine.toFixed(4)} | Histogram: ${macd.histogram.toFixed(4)}
• MACD Trend: ${macd.trend.toUpperCase()} ${macd.histogram > 0 ? '(bullish momentum)' : macd.histogram < 0 ? '(bearish momentum)' : ''}

MOVING AVERAGES:
• EMA(9): $${ma.ema9} | EMA(21): $${ma.ema21} ${ma.ema9 > ma.ema21 ? '(bullish cross)' : '(bearish cross)'}
• SMA(20): $${ma.sma20} (${ma.priceVsSma20 > 0 ? '+' : ''}${ma.priceVsSma20}% vs price)
• SMA(50): $${ma.sma50} (${ma.priceVsSma50 > 0 ? '+' : ''}${ma.priceVsSma50}% vs price)
• SMA(200): $${ma.sma200} (${ma.priceVsSma200 > 0 ? '+' : ''}${ma.priceVsSma200}% vs price)
• MA Trend: ${ma.trend.toUpperCase()}

BOLLINGER BANDS (20,2):
• Upper: $${bb.upper} | Middle: $${bb.middle} | Lower: $${bb.lower}
• %B: ${(bb.percentB * 100).toFixed(1)}% - ${bbStatus}
• Bandwidth: ${(bb.bandwidth * 100).toFixed(2)}%

VOLATILITY:
• ATR(14): $${indicators.atr14} (${(indicators.atr14 / indicators.currentPrice * 100).toFixed(2)}% of price)

═══════════════════════════════════════════════════════════════

CRITICAL: Base your signal on THE STRAT analysis above. If a STRAT pattern is detected, 
prioritize that signal. If FTFC shows ALL_BULLISH or ALL_BEARISH, trade in that direction.
If NO pattern and MIXED alignment, recommend HOLD or reduced position size.
`;
}
