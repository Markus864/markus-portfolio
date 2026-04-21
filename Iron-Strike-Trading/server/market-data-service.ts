import {
  getHistoricalCandlesFromFlatfiles,
  isPolygonFlatfilesConfigured,
  type Timeframe,
} from "./polygon-flatfiles";

export type DataSource = "polygon" | "tradier" | "finnhub" | "mock" | "flatfiles";

/**
 * Feature flag for using Polygon flat files for backtest historical data.
 * Set USE_FLATFILES_FOR_BACKTEST=1 in environment to enable.
 * When enabled and configured, backtests will prefer flat file data over REST APIs.
 */
export const USE_FLATFILES_FOR_BACKTEST =
  process.env.USE_FLATFILES_FOR_BACKTEST === "1";

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  averageVolume?: number;
  week52High?: number;
  week52Low?: number;
  marketCap?: number;
  lastUpdated: Date;
  dataSource: DataSource;
  cacheAge?: number; // milliseconds since data was fetched
}

// Polygon API configuration
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = "https://api.polygon.io";

export interface HistoricalDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const quoteCache = new Map<string, { quote: MarketQuote; timestamp: number }>();
const profileCache = new Map<string, { marketCap: number; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache for quotes
const PROFILE_CACHE_TTL = 3600000; // 1 hour cache for company profile (market cap doesn't change often)

async function getMarketCap(symbol: string, finnhubApiKey: string): Promise<number | undefined> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = profileCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.marketCap;
  }
  
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${upperSymbol}&token=${finnhubApiKey}`
    );
    
    if (!response.ok) {
      return undefined;
    }
    
    const data = await response.json();
    
    if (data && data.marketCapitalization) {
      // Finnhub returns market cap in millions, convert to actual value
      const marketCap = data.marketCapitalization * 1000000;
      profileCache.set(upperSymbol, { marketCap, timestamp: Date.now() });
      return marketCap;
    }
  } catch (error: any) {
    console.error(`Finnhub profile error for ${upperSymbol}:`, error.message);
  }
  
  return undefined;
}

export async function getQuote(symbol: string): Promise<MarketQuote> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = quoteCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      ...cached.quote,
      cacheAge: Date.now() - cached.timestamp,
    };
  }
  
  const tradierApiKey = process.env.TRADIER_API_KEY;
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  
  // Try Polygon first (primary data provider with paid plan)
  if (POLYGON_API_KEY) {
    try {
      const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(upperSymbol)}?apiKey=${POLYGON_API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Polygon API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.ticker) {
        const ticker = data.ticker;
        const day = ticker.day || {};
        const prevDay = ticker.prevDay || {};
        const lastTrade = ticker.lastTrade || {};
        
        // Calculate current price from last trade, day data, or previous close
        // When markets are closed, lastTrade and day data may be empty - use prevDay.c
        const prevClose = prevDay.c || prevDay.vw || 0;
        const price = lastTrade.p || day.c || day.vw || prevClose || 0;
        const change = prevClose > 0 ? price - prevClose : 0;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
        
        // Get market cap from Finnhub if available
        let marketCap: number | undefined;
        if (finnhubApiKey) {
          marketCap = await getMarketCap(upperSymbol, finnhubApiKey);
        }
        
        const quote: MarketQuote = {
          symbol: upperSymbol,
          price,
          change,
          changePercent,
          previousClose: prevClose,
          open: day.o || price,
          dayHigh: day.h || price,
          dayLow: day.l || price,
          volume: day.v || 0,
          averageVolume: undefined, // Polygon doesn't provide in snapshot
          week52High: undefined,
          week52Low: undefined,
          marketCap: marketCap,
          lastUpdated: new Date(),
          dataSource: "polygon",
          cacheAge: 0,
        };
        
        // Cache the result
        quoteCache.set(upperSymbol, { quote, timestamp: Date.now() });
        
        return quote;
      }
    } catch (error: any) {
      console.error(`Polygon quote error for ${upperSymbol}:`, error.message);
    }
  }
  
  // Fallback to Tradier
  if (tradierApiKey) {
    try {
      const response = await fetch(
        `https://api.tradier.com/v1/markets/quotes?symbols=${upperSymbol}`,
        {
          headers: {
            'Authorization': `Bearer ${tradierApiKey}`,
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Tradier API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.quotes?.quote) {
        const q = data.quotes.quote;
        
        // Get real market cap from Finnhub company profile
        let marketCap: number | undefined;
        if (finnhubApiKey) {
          marketCap = await getMarketCap(upperSymbol, finnhubApiKey);
        }
        
        const quote: MarketQuote = {
          symbol: upperSymbol,
          price: q.last || q.close || 0,
          change: q.change || 0,
          changePercent: q.change_percentage || 0,
          previousClose: q.prevclose || q.last || 0,
          open: q.open || q.last || 0,
          dayHigh: q.high || q.last || 0,
          dayLow: q.low || q.last || 0,
          volume: q.volume || 0,
          averageVolume: q.average_volume,
          week52High: q.week_52_high,
          week52Low: q.week_52_low,
          marketCap: marketCap,
          lastUpdated: new Date(),
          dataSource: "tradier",
          cacheAge: 0,
        };
        
        // Cache the result
        quoteCache.set(upperSymbol, { quote, timestamp: Date.now() });
        
        return quote;
      }
    } catch (error: any) {
      console.error(`Tradier quote error for ${upperSymbol}:`, error.message);
    }
  }
  
  // Fallback to Finnhub
  if (finnhubApiKey) {
    try {
      const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${upperSymbol}&token=${finnhubApiKey}`;
      const response = await fetch(quoteUrl);
      
      if (!response.ok) {
        throw new Error(`Finnhub API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.c && data.c > 0) {
        // Get market cap from company profile
        const marketCap = await getMarketCap(upperSymbol, finnhubApiKey);
        
        const quote: MarketQuote = {
          symbol: upperSymbol,
          price: data.c,
          change: data.d || 0,
          changePercent: data.dp || 0,
          previousClose: data.pc || data.c,
          open: data.o || data.c,
          dayHigh: data.h || data.c,
          dayLow: data.l || data.c,
          volume: data.v || 0,
          marketCap: marketCap,
          lastUpdated: new Date(),
          dataSource: "finnhub",
          cacheAge: 0,
        };
        
        quoteCache.set(upperSymbol, { quote, timestamp: Date.now() });
        return quote;
      }
    } catch (error: any) {
      console.error(`Finnhub error for ${upperSymbol}:`, error.message);
    }
  }
  
  // Fallback: Generate mock data
  console.warn(`Using mock data for ${upperSymbol}`);
  return getMockQuote(upperSymbol);
}

export async function getMultipleQuotes(symbols: string[]): Promise<MarketQuote[]> {
  const results: MarketQuote[] = [];
  const errors: string[] = [];

  // Fetch quotes with small delays to avoid rate limiting
  for (const symbol of symbols) {
    try {
      const quote = await getQuote(symbol);
      results.push(quote);
      // Small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      errors.push(`${symbol}: ${error.message}`);
    }
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(`Failed to fetch quotes: ${errors.join(", ")}`);
  }

  return results;
}

// Get interval configuration for intraday/daily data
interface IntervalConfig {
  multiplier: number;
  timespan: 'minute' | 'hour' | 'day' | 'week';
  lookbackDays: number;
  maxBars: number;
}

function getIntervalConfig(period: string, interval?: string): IntervalConfig {
  // Get the base lookback days from the period
  const baseLookbackDays = getPeriodDays(period);
  
  // If intraday interval specified, use that with lookback based on period
  if (interval) {
    // For intraday data, we need extra buffer for weekends/holidays
    // Minimum 7 days lookback to ensure we have enough trading days
    const minLookbackDays = 7;
    const lookbackWithBuffer = Math.max(minLookbackDays, Math.ceil(baseLookbackDays * 1.5));
    
    // Calculate target trading days (accounting for weekends: 5 trading days per 7 calendar days)
    const targetTradingDays = Math.max(1, Math.ceil(baseLookbackDays * 5 / 7));
    
    switch (interval) {
      case '5min':
        // 7 hours * 12 bars/hr = ~84 bars per trading day
        return { multiplier: 5, timespan: 'minute', lookbackDays: lookbackWithBuffer, maxBars: Math.max(100, targetTradingDays * 100) };
      case '15min':
        // 7 hours * 4 bars/hr = ~28 bars per trading day
        return { multiplier: 15, timespan: 'minute', lookbackDays: lookbackWithBuffer, maxBars: Math.max(50, targetTradingDays * 35) };
      case '30min':
        // 7 hours * 2 bars/hr = ~14 bars per trading day
        return { multiplier: 30, timespan: 'minute', lookbackDays: lookbackWithBuffer, maxBars: Math.max(30, targetTradingDays * 20) };
      case '1hour':
        // ~7 bars per trading day
        return { multiplier: 1, timespan: 'hour', lookbackDays: lookbackWithBuffer, maxBars: Math.max(20, targetTradingDays * 10) };
      case '4hour':
        // ~2 bars per trading day
        return { multiplier: 4, timespan: 'hour', lookbackDays: lookbackWithBuffer, maxBars: Math.max(10, targetTradingDays * 5) };
    }
  }
  
  // Daily/weekly intervals based on period (no interval specified)
  switch (period) {
    case '1d':
      // 1-day view: show 5-minute candles for today
      return { multiplier: 5, timespan: 'minute', lookbackDays: 2, maxBars: 100 };
    case '5d':
      // 5-day view: show 15-minute candles
      return { multiplier: 15, timespan: 'minute', lookbackDays: 8, maxBars: 250 };
    default:
      // Longer periods: use daily bars
      return { multiplier: 1, timespan: 'day', lookbackDays: Math.ceil(baseLookbackDays * 1.5), maxBars: 5000 };
  }
}

// Fetch historical data from Polygon.io (preferred source)
async function fetchPolygonHistoricalData(
  symbol: string,
  period: string,
  interval?: string
): Promise<HistoricalDataPoint[] | null> {
  if (!POLYGON_API_KEY) {
    return null;
  }
  
  try {
    const config = getIntervalConfig(period, interval);
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - config.lookbackDays);
    
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];
    
    const url = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/${config.multiplier}/${config.timespan}/${fromStr}/${toStr}?adjusted=true&sort=asc&limit=${config.maxBars}&apiKey=${POLYGON_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Polygon] Historical API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // For intraday data, we keep all bars; for daily, filter weekends
      const isIntraday = config.timespan === 'minute' || config.timespan === 'hour';
      
      const results = data.results
        .map((bar: any) => {
          const date = new Date(bar.t);
          const dayOfWeek = date.getDay();
          
          // Skip weekends for daily data
          if (!isIntraday && (dayOfWeek === 0 || dayOfWeek === 6)) {
            return null;
          }
          
          return {
            date,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v || 0,
          };
        })
        .filter((d: HistoricalDataPoint | null) => d !== null);
      
      // For daily data, limit to the requested number of trading days
      let finalResults = results;
      if (!isIntraday) {
        const tradingDays = getPeriodTradingDays(period);
        finalResults = results.slice(-tradingDays);
      }
      
      const startDate = finalResults[0]?.date;
      const endDate = finalResults[finalResults.length - 1]?.date;
      console.log(`[Polygon] Retrieved ${finalResults.length} ${config.multiplier}${config.timespan} bars for ${symbol} (${startDate?.toISOString()} to ${endDate?.toISOString()})`);
      return finalResults;
    }
    
    return null;
  } catch (error: any) {
    console.error(`[Polygon] Historical error for ${symbol}:`, error.message);
    return null;
  }
}

// Get approximate trading days for a period
function getPeriodTradingDays(period: string): number {
  switch (period) {
    case "1d": return 1;
    case "5d": return 5;
    case "1mo": return 22; // ~22 trading days per month
    case "3mo": return 66;
    case "6mo": return 132;
    case "1y": return 252;
    case "2y": return 504;
    case "5y": return 1260;
    default: return 22;
  }
}

// Fetch intraday data from Tradier timesales API (supports 1min, 5min, 15min)
async function fetchTradierIntradayData(
  symbol: string,
  period: string,
  interval?: string
): Promise<HistoricalDataPoint[] | null> {
  const tradierApiKey = process.env.TRADIER_API_KEY;
  if (!tradierApiKey) return null;
  
  try {
    // Determine the Tradier interval (only supports 1min, 5min, 15min)
    // For 30min, 1hour, 4hour we'll fetch 15min and aggregate
    let tradierInterval: '1min' | '5min' | '15min' = '15min';
    let aggregateMultiplier = 1;
    
    if (interval === '5min') {
      tradierInterval = '5min';
      aggregateMultiplier = 1;
    } else if (interval === '15min') {
      tradierInterval = '15min';
      aggregateMultiplier = 1;
    } else if (interval === '30min') {
      tradierInterval = '15min';
      aggregateMultiplier = 2; // Aggregate 2 15min bars into 1 30min bar
    } else if (interval === '1hour') {
      tradierInterval = '15min';
      aggregateMultiplier = 4; // Aggregate 4 15min bars into 1 1hour bar
    } else if (interval === '4hour') {
      tradierInterval = '15min';
      aggregateMultiplier = 16; // Aggregate 16 15min bars into 1 4hour bar
    }
    
    // Calculate date range based on period
    const lookbackDays = Math.max(7, Math.ceil(getPeriodDays(period) * 1.5));
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - lookbackDays);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    const url = `https://api.tradier.com/v1/markets/timesales?symbol=${symbol}&interval=${tradierInterval}&start=${startStr}&end=${endStr}`;
    console.log(`[Tradier] Fetching ${tradierInterval} timesales for ${symbol}: ${startStr} to ${endStr}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tradierApiKey}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Tradier] Timesales API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.series?.data || data.series.data.length === 0) {
      console.log(`[Tradier] No timesales data returned`);
      return null;
    }
    
    const rawBars = Array.isArray(data.series.data) ? data.series.data : [data.series.data];
    
    // Map to our format
    let bars: HistoricalDataPoint[] = rawBars.map((bar: any) => ({
      date: new Date(bar.time),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume || 0,
    }));
    
    // Aggregate if needed (for 30min, 1hour, 4hour)
    if (aggregateMultiplier > 1) {
      const aggregated: HistoricalDataPoint[] = [];
      for (let i = 0; i < bars.length; i += aggregateMultiplier) {
        const chunk = bars.slice(i, Math.min(i + aggregateMultiplier, bars.length));
        if (chunk.length === 0) continue;
        
        aggregated.push({
          date: chunk[0].date,
          open: chunk[0].open,
          high: Math.max(...chunk.map(b => b.high)),
          low: Math.min(...chunk.map(b => b.low)),
          close: chunk[chunk.length - 1].close,
          volume: chunk.reduce((sum, b) => sum + b.volume, 0),
        });
      }
      bars = aggregated;
    }
    
    console.log(`[Tradier] Retrieved ${bars.length} ${interval || tradierInterval} bars for ${symbol}`);
    return bars;
  } catch (error: any) {
    console.error(`[Tradier] Timesales error for ${symbol}:`, error.message);
    return null;
  }
}

export async function getHistoricalData(
  symbol: string,
  period: "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1mo",
  interval?: "5min" | "15min" | "30min" | "1hour" | "4hour"
): Promise<HistoricalDataPoint[]> {
  const upperSymbol = symbol.toUpperCase();
  
  // Short periods (1d, 5d) need intraday data even without explicit interval
  // Flat files only have daily data, so skip them for these periods
  const needsIntradayData = !!interval || period === "1d" || period === "5d";
  const minExpectedBars = needsIntradayData ? 20 : 5;

  // Try Polygon flat files first if enabled and configured (for daily data only)
  // Skip flat files for short periods that need intraday resolution
  if (USE_FLATFILES_FOR_BACKTEST && isPolygonFlatfilesConfigured() && !needsIntradayData) {
    const to = new Date();
    const from = new Date(Date.now() - getPeriodSeconds(period) * 1000);
    
    console.log(
      `[Market Data] Using flat files for ${upperSymbol} (${period}), range: ${from.toISOString().split("T")[0]} to ${to.toISOString().split("T")[0]}`
    );
    
    const flatfileData = await getHistoricalCandlesFromFlatfiles(
      upperSymbol,
      "1d" as Timeframe,
      from,
      to
    );
    
    if (flatfileData && flatfileData.length >= minExpectedBars) {
      console.log(`[Flatfiles] Successfully retrieved ${flatfileData.length} bars for ${upperSymbol}`);
      return flatfileData;
    }
    
    console.log(
      `[Flatfiles] Insufficient data (${flatfileData?.length || 0} bars), falling back to REST APIs...`
    );
  } else if (USE_FLATFILES_FOR_BACKTEST && !isPolygonFlatfilesConfigured()) {
    console.log("[Market Data] Flat files enabled but S3 credentials not configured, using REST APIs");
  }
  
  // Try Polygon REST API (preferred source with proper timestamps)
  const polygonData = await fetchPolygonHistoricalData(upperSymbol, period, interval);
  if (polygonData && polygonData.length >= minExpectedBars) {
    return polygonData;
  }
  
  // For intraday data, try Tradier timesales API as fallback
  if (needsIntradayData) {
    console.log(`[Polygon] Insufficient data (${polygonData?.length || 0} bars), trying Tradier timesales...`);
    const tradierIntradayData = await fetchTradierIntradayData(upperSymbol, period, interval);
    if (tradierIntradayData && tradierIntradayData.length > 0) {
      return tradierIntradayData;
    }
  }
  
  // Return Polygon data even if limited (better than nothing)
  if (polygonData && polygonData.length > 0) {
    return polygonData;
  }
  
  // Fallback to Tradier daily data
  const tradierApiKey = process.env.TRADIER_API_KEY;
  if (tradierApiKey) {
    try {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - getPeriodSeconds(period) * 1000).toISOString().split('T')[0];
      const interval = getTradierInterval(period);
      
      const url = `https://api.tradier.com/v1/markets/history?symbol=${upperSymbol}&interval=${interval}&start=${start}&end=${end}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tradierApiKey}`,
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Tradier history API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.history?.day) {
        const days = Array.isArray(data.history.day) ? data.history.day : [data.history.day];
        // Filter out weekend days from Tradier data too
        const filteredDays = days.filter((d: any) => {
          const date = new Date(d.date);
          const dayOfWeek = date.getDay();
          return dayOfWeek !== 0 && dayOfWeek !== 6;
        });
        console.log(`[Tradier] Retrieved ${filteredDays.length} historical bars for ${upperSymbol}`);
        return filteredDays.map((d: any) => ({
          date: new Date(d.date),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume || 0,
        }));
      }
    } catch (error: any) {
      console.error(`Tradier historical error for ${upperSymbol}:`, error.message);
    }
  }
  
  // Fallback: Generate mock historical data
  console.warn(`Using mock historical data for ${upperSymbol}`);
  return getMockHistoricalData(upperSymbol, period);
}

function getTradierInterval(period: string): 'daily' | 'weekly' | 'monthly' {
  switch (period) {
    case "1d":
    case "5d":
    case "1mo":
    case "3mo":
      return 'daily';
    case "6mo":
    case "1y":
      return 'weekly';
    case "2y":
    case "5y":
      return 'monthly';
    default:
      return 'daily';
  }
}

function getPeriodSeconds(period: string): number {
  switch (period) {
    case "1d": return 86400;
    case "5d": return 5 * 86400;
    case "1mo": return 30 * 86400;
    case "3mo": return 90 * 86400;
    case "6mo": return 180 * 86400;
    case "1y": return 365 * 86400;
    case "2y": return 730 * 86400;
    case "5y": return 1825 * 86400;
    default: return 30 * 86400;
  }
}

function getResolution(period: string): string {
  switch (period) {
    case "1d": return "5";
    case "5d": return "15";
    case "1mo": return "60";
    case "3mo":
    case "6mo": return "D";
    case "1y":
    case "2y":
    case "5y": return "W";
    default: return "D";
  }
}

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    const char = symbol.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getMockQuote(symbol: string): MarketQuote {
  const hash = hashSymbol(symbol);
  const basePrice = 50 + (hash % 450);
  const volatility = 1 + (Math.random() - 0.5) * 0.04;
  const price = Number((basePrice * volatility).toFixed(2));
  const change = Number(((Math.random() - 0.5) * 10).toFixed(2));
  const previousClose = Number((price - change).toFixed(2));
  
  return {
    symbol,
    price,
    change,
    changePercent: Number(((change / previousClose) * 100).toFixed(2)),
    previousClose,
    open: Number((previousClose * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2)),
    dayHigh: Number((price * (1 + Math.random() * 0.02)).toFixed(2)),
    dayLow: Number((price * (1 - Math.random() * 0.02)).toFixed(2)),
    volume: Math.floor(Math.random() * 10000000),
    lastUpdated: new Date(),
    dataSource: "mock",
    cacheAge: 0,
  };
}

function getMockHistoricalData(symbol: string, period: string): HistoricalDataPoint[] {
  const hash = hashSymbol(symbol);
  const basePrice = 50 + (hash % 450);
  const targetTradingDays = getPeriodTradingDays(period);
  const data: HistoricalDataPoint[] = [];
  
  let price = basePrice;
  const now = new Date();
  
  // Generate more days than needed to account for weekends, then filter
  let tradingDaysGenerated = 0;
  let daysBack = 0;
  
  while (tradingDaysGenerated < targetTradingDays && daysBack < targetTradingDays * 2) {
    const candidateDate = new Date(now.getTime() - daysBack * 86400000);
    const dayOfWeek = candidateDate.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const change = (Math.random() - 0.5) * (price * 0.03);
      price = Math.max(1, price + change);
      
      const high = price * (1 + Math.random() * 0.02);
      const low = price * (1 - Math.random() * 0.02);
      const open = low + Math.random() * (high - low);
      
      data.unshift({
        date: candidateDate,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(price.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000),
      });
      
      tradingDaysGenerated++;
    }
    
    daysBack++;
  }
  
  return data;
}

function getPeriodDays(period: string): number {
  switch (period) {
    case "1d": return 1;
    case "5d": return 5;
    case "1mo": return 30;
    case "3mo": return 90;
    case "6mo": return 180;
    case "1y": return 365;
    case "2y": return 730;
    case "5y": return 1825;
    default: return 30;
  }
}

export interface MarketMover {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface MarketNewsItem {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: Date;
  symbol?: string;
}

const moversCache = new Map<string, { data: { gainers: MarketMover[]; losers: MarketMover[] }; timestamp: number }>();
const newsCache = new Map<string, { data: MarketNewsItem[]; timestamp: number }>();
const MOVERS_CACHE_TTL = 300000; // 5 minutes
const NEWS_CACHE_TTL = 300000; // 5 minutes

export async function getMarketMovers(): Promise<{ gainers: MarketMover[]; losers: MarketMover[] }> {
  const cacheKey = 'market_movers';
  const cached = moversCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < MOVERS_CACHE_TTL) {
    return cached.data;
  }

  // Use a list of popular stocks and fetch their current quotes
  const popularSymbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'INTC', 'NFLX', 
                         'SPY', 'QQQ', 'IWM', 'DIS', 'BA', 'JPM', 'V', 'MA', 'PYPL', 'CRM'];
  
  const tradierApiKey = process.env.TRADIER_API_KEY;
  if (!tradierApiKey) {
    return { gainers: [], losers: [] };
  }

  try {
    const response = await fetch(
      `https://api.tradier.com/v1/markets/quotes?symbols=${popularSymbols.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${tradierApiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { gainers: [], losers: [] };
    }

    const data = await response.json();
    const quotes = data.quotes?.quote;
    if (!quotes || !Array.isArray(quotes)) {
      return { gainers: [], losers: [] };
    }

    const movers: MarketMover[] = quotes
      .filter((q: any) => q.last && q.change_percentage !== undefined)
      .map((q: any) => ({
        symbol: q.symbol,
        price: q.last,
        change: q.change || 0,
        changePercent: q.change_percentage || 0,
        volume: q.volume || 0,
      }));

    const sorted = movers.sort((a, b) => b.changePercent - a.changePercent);
    const result = {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
    };

    moversCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching market movers:', error);
    return { gainers: [], losers: [] };
  }
}

export async function getMarketNews(symbol?: string): Promise<MarketNewsItem[]> {
  const cacheKey = symbol ? `news_${symbol.toUpperCase()}` : 'news_general';
  const cached = newsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NEWS_CACHE_TTL) {
    return cached.data;
  }

  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  
  try {
    let url: string;
    if (symbol && finnhubApiKey) {
      // Company-specific news
      url = `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${getDateString(-7)}&to=${getDateString(0)}&token=${finnhubApiKey}`;
    } else if (finnhubApiKey) {
      // General market news
      url = `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`;
    } else {
      return [];
    }

    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    const news: MarketNewsItem[] = data.slice(0, 10).map((item: any) => ({
      headline: item.headline || 'No headline',
      summary: item.summary || '',
      source: item.source || 'Unknown',
      url: item.url || '',
      datetime: new Date(item.datetime * 1000),
      symbol: symbol?.toUpperCase(),
    }));

    newsCache.set(cacheKey, { data: news, timestamp: Date.now() });
    return news;
  } catch (error) {
    console.error('Error fetching market news:', error);
    return [];
  }
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}
