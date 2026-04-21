/**
 * Polygon.io Stock Quotes Service
 * Provides real-time stock quotes for Discord and Telegram bots
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = "https://api.polygon.io";

export interface BotQuote {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
}

const quoteCache = new Map<string, { quote: BotQuote; timestamp: number }>();
const CACHE_TTL = 30000; // 30 second cache for bot quotes

export async function getPolygonQuote(symbol: string): Promise<BotQuote | null> {
  const upperSymbol = symbol.toUpperCase();
  
  // Check cache first
  const cached = quoteCache.get(upperSymbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.quote;
  }
  
  if (!POLYGON_API_KEY) {
    console.error("[Polygon Quotes] POLYGON_API_KEY is not set");
    return null;
  }

  try {
    // Use Polygon's snapshot endpoint for comprehensive quote data
    const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(upperSymbol)}?apiKey=${POLYGON_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Polygon Quotes] Failed to fetch quote for ${upperSymbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.ticker) {
      console.error(`[Polygon Quotes] No ticker data for ${upperSymbol}`);
      return null;
    }

    const ticker = data.ticker;
    const day = ticker.day || {};
    const prevDay = ticker.prevDay || {};
    const lastTrade = ticker.lastTrade || {};
    
    // Calculate current price from last trade or day data
    const price = lastTrade.p || day.c || day.vw || 0;
    const prevClose = prevDay.c || prevDay.vw || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    
    const quote: BotQuote = {
      price,
      change,
      changePercent,
      volume: day.v || 0,
      high: day.h || price,
      low: day.l || price,
      open: day.o || price,
      prevClose,
    };
    
    // Cache the result
    quoteCache.set(upperSymbol, { quote, timestamp: Date.now() });
    
    return quote;
  } catch (error: any) {
    console.error(`[Polygon Quotes] Error fetching quote for ${upperSymbol}:`, error.message);
    return null;
  }
}

export function isPolygonConfigured(): boolean {
  return !!POLYGON_API_KEY;
}
