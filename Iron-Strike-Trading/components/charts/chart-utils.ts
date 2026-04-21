export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: number;
  value: number;
  color: string;
}

export interface IndicatorData {
  time: number;
  value: number;
}

export function calculateSMA(data: OHLCData[], period: number): IndicatorData[] {
  const result: IndicatorData[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

export function calculateEMA(data: OHLCData[], period: number): IndicatorData[] {
  const result: IndicatorData[] = [];
  const multiplier = 2 / (period + 1);
  
  if (data.length < period) return result;
  
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({ time: data[period - 1].time, value: ema });
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }
  
  return result;
}

export function calculateRSI(data: OHLCData[], period: number = 14): IndicatorData[] {
  const result: IndicatorData[] = [];
  if (data.length < period + 1) return result;
  
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < gains.length; i++) {
    if (i === period) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i + 1].time, value: rsi });
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i + 1].time, value: rsi });
    }
  }
  
  return result;
}

export function calculateMACD(data: OHLCData[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
  macd: IndicatorData[];
  signal: IndicatorData[];
  histogram: IndicatorData[];
} {
  const ema12 = calculateEMA(data, fastPeriod);
  const ema26 = calculateEMA(data, slowPeriod);
  
  const macdLine: IndicatorData[] = [];
  
  const ema26StartIdx = slowPeriod - fastPeriod;
  
  for (let i = 0; i < ema26.length; i++) {
    const ema12Idx = i + ema26StartIdx;
    if (ema12Idx >= 0 && ema12Idx < ema12.length) {
      macdLine.push({
        time: ema26[i].time,
        value: ema12[ema12Idx].value - ema26[i].value
      });
    }
  }
  
  const signalData: OHLCData[] = macdLine.map(d => ({
    time: d.time,
    open: d.value,
    high: d.value,
    low: d.value,
    close: d.value
  }));
  
  const signalLine = calculateEMA(signalData, signalPeriod);
  
  const histogram: IndicatorData[] = [];
  const signalStartIdx = signalPeriod - 1;
  
  for (let i = signalStartIdx; i < macdLine.length; i++) {
    const signalIdx = i - signalStartIdx;
    if (signalIdx >= 0 && signalIdx < signalLine.length) {
      histogram.push({
        time: macdLine[i].time,
        value: macdLine[i].value - signalLine[signalIdx].value
      });
    }
  }
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram
  };
}

export interface ChartState {
  symbol: string;
  timeframe: string;
  chartType: 'candle' | 'line';
  indicators: {
    volume: boolean;
    sma: boolean;
    smaPeriod: number;
    ema: boolean;
    emaPeriod: number;
    rsi: boolean;
    macd: boolean;
  };
  drawings: Drawing[];
}

export interface Drawing {
  id: string;
  type: 'trendline' | 'hline' | 'ray' | 'fib';
  points: { time: number; price: number }[];
  style?: {
    color?: string;
    lineWidth?: number;
  };
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'ironstrike-chart-state';
const DRAWINGS_KEY_PREFIX = 'ist_chart_drawings_v1';
const PREFS_KEY_PREFIX = 'ist_chart_prefs_v1';

export interface ChartPreferences {
  chartType: 'candle' | 'line';
  indicators: {
    volume: boolean;
    sma: boolean;
    smaPeriod: number;
    ema: boolean;
    emaPeriod: number;
    rsi: boolean;
    macd: boolean;
  };
}

export function loadChartState(): Partial<ChartState> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load chart state:', e);
  }
  return null;
}

export function saveChartState(state: ChartState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save chart state:', e);
  }
}

export function loadChartPreferences(symbol: string, timeframe: string): ChartPreferences | null {
  try {
    const key = `${PREFS_KEY_PREFIX}:${symbol}:${timeframe}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load chart preferences:', e);
  }
  return null;
}

export function saveChartPreferences(symbol: string, timeframe: string, prefs: ChartPreferences): void {
  try {
    const key = `${PREFS_KEY_PREFIX}:${symbol}:${timeframe}`;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save chart preferences:', e);
  }
}

export function loadDrawings(symbol: string, timeframe: string): Drawing[] {
  try {
    const key = `${DRAWINGS_KEY_PREFIX}:${symbol}:${timeframe}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const drawings = JSON.parse(stored);
      if (Array.isArray(drawings)) {
        const now = Date.now();
        return drawings.map(d => ({
          ...d,
          points: d.points.map((p: any) => ({
            time: typeof p.time === 'number' ? p.time : 0,
            price: typeof p.price === 'number' ? p.price : 0,
          })),
          createdAt: typeof d.createdAt === 'number' ? d.createdAt : now,
          updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : now,
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to load drawings:', e);
  }
  return [];
}

export function saveDrawings(symbol: string, timeframe: string, drawings: Drawing[]): void {
  try {
    const key = `${DRAWINGS_KEY_PREFIX}:${symbol}:${timeframe}`;
    localStorage.setItem(key, JSON.stringify(drawings));
  } catch (e) {
    console.warn('Failed to save drawings:', e);
  }
}

export function getDefaultChartState(): ChartState {
  return {
    symbol: 'AAPL',
    timeframe: '1mo',
    chartType: 'candle',
    indicators: {
      volume: true,
      sma: false,
      smaPeriod: 20,
      ema: false,
      emaPeriod: 9,
      rsi: false,
      macd: false
    },
    drawings: []
  };
}
