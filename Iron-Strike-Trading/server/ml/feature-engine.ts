import type { HistoricalDataPoint } from "../market-data-service";

export interface FeatureVector {
  date: Date;
  close: number;
  volume: number;
  maFast: number;       // 10-period moving average
  maSlow: number;       // 30-period moving average
  rsi14: number;        // 14-period RSI
  priceChange1d: number; // 1-day percentage change
  volNormalized: number; // Volume normalized to 20-day mean
  macdLine: number;     // MACD line (12-26)
  macdSignal: number;   // MACD signal (9-period EMA of MACD)
  macdHistogram: number; // MACD histogram
}

export interface FeatureDataset {
  features: FeatureVector[];
  symbol: string;
  startDate: Date;
  endDate: Date;
}

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      const slice = data.slice(0, period);
      const sma = slice.reduce((a, b) => a + b, 0) / period;
      result.push(sma);
    } else {
      const prevEma = result[i - 1];
      const ema = (data[i] - prevEma) * multiplier + prevEma;
      result.push(ema);
    }
  }
  return result;
}

function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(NaN);
      continue;
    }
    
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
    
    if (i < period) {
      result.push(NaN);
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    } else {
      const prevRsi = result[i - 1];
      const prevAvgGain = (100 - prevRsi) === 0 ? 0 : (prevRsi / (100 - prevRsi));
      
      const currentGain = gains[gains.length - 1];
      const currentLoss = losses[losses.length - 1];
      
      const recentGains = gains.slice(-period);
      const recentLosses = losses.slice(-period);
      const avgGain = recentGains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = recentLosses.reduce((a, b) => a + b, 0) / period;
      
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }
  }
  
  return result;
}

function calculateMACD(closes: number[]): { line: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(ema12[i]) || isNaN(ema26[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(ema12[i] - ema26[i]);
    }
  }
  
  const validMacd = macdLine.filter(v => !isNaN(v));
  const macdSignal = calculateEMA(validMacd, 9);
  
  const signalFull: number[] = [];
  let validIndex = 0;
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macdLine[i])) {
      signalFull.push(NaN);
    } else {
      signalFull.push(macdSignal[validIndex] ?? NaN);
      validIndex++;
    }
  }
  
  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalFull[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalFull[i]);
    }
  }
  
  return { line: macdLine, signal: signalFull, histogram };
}

function calculatePriceChange(closes: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(0);
    } else {
      const change = (closes[i] - closes[i - 1]) / closes[i - 1];
      result.push(change);
    }
  }
  return result;
}

function calculateVolumeNormalized(volumes: number[], period: number = 20): number[] {
  const sma = calculateSMA(volumes, period);
  const result: number[] = [];
  for (let i = 0; i < volumes.length; i++) {
    if (isNaN(sma[i]) || sma[i] === 0) {
      result.push(1);
    } else {
      result.push(volumes[i] / sma[i]);
    }
  }
  return result;
}

export function computeFeatures(data: HistoricalDataPoint[]): FeatureVector[] {
  if (data.length < 35) {
    console.warn("Insufficient data for feature computation, need at least 35 data points");
    return [];
  }
  
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume || 1000000);
  
  const maFast = calculateSMA(closes, 10);
  const maSlow = calculateSMA(closes, 30);
  const rsi14 = calculateRSI(closes, 14);
  const priceChange1d = calculatePriceChange(closes);
  const volNormalized = calculateVolumeNormalized(volumes, 20);
  const macd = calculateMACD(closes);
  
  const features: FeatureVector[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (isNaN(maFast[i]) || isNaN(maSlow[i]) || isNaN(rsi14[i])) {
      continue;
    }
    
    features.push({
      date: data[i].date,
      close: closes[i],
      volume: volumes[i],
      maFast: maFast[i],
      maSlow: maSlow[i],
      rsi14: rsi14[i],
      priceChange1d: priceChange1d[i],
      volNormalized: volNormalized[i],
      macdLine: isNaN(macd.line[i]) ? 0 : macd.line[i],
      macdSignal: isNaN(macd.signal[i]) ? 0 : macd.signal[i],
      macdHistogram: isNaN(macd.histogram[i]) ? 0 : macd.histogram[i],
    });
  }
  
  return features;
}

export function getFeatureArray(feature: FeatureVector): number[] {
  return [
    feature.maFast,
    feature.maSlow,
    feature.rsi14,
    feature.priceChange1d,
    feature.volNormalized,
    feature.macdLine,
    feature.macdSignal,
    feature.macdHistogram,
  ];
}

export function getLatestFeatures(data: HistoricalDataPoint[]): FeatureVector | null {
  const features = computeFeatures(data);
  if (features.length === 0) {
    return null;
  }
  return features[features.length - 1];
}

export const FEATURE_NAMES = [
  "maFast",
  "maSlow", 
  "rsi14",
  "priceChange1d",
  "volNormalized",
  "macdLine",
  "macdSignal",
  "macdHistogram",
] as const;

export type FeatureName = typeof FEATURE_NAMES[number];
