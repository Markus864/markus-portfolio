import { env } from "../config/env";

export interface PolygonOptionContract {
  symbol: string;
  expirationDate: string;
  strike: number;
  type: "call" | "put";
  mid: number;
  bid: number;
  ask: number;
  last: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
  impliedVolatility: number;
  openInterest: number;
  volume: number;
}

export interface PolygonOptionsChain {
  underlyingPrice: number;
  options: PolygonOptionContract[];
}

export interface StrategyFilters {
  direction: "BUY_CALL" | "BUY_PUT" | "NO_TRADE";
  preferredExpirationWindow: "0dte" | "1w" | "2w" | "3w" | "1m";
  preferredMoneyness: "deep_itm" | "itm" | "atm" | "slightly_otm" | "far_otm";
  targetDeltaRange: [number, number];
}

export interface FilteredContracts {
  primaryContract: PolygonOptionContract | null;
  alternatives: PolygonOptionContract[];
}

const POLYGON_BASE_URL = "https://api.polygon.io";

function getPolygonApiKey(): string {
  return process.env.POLYGON_API_KEY || "";
}

function getTargetExpirationDate(window: string): { minDate: string; maxDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let minDays = 0;
  let maxDays = 1;
  
  switch (window) {
    case "0dte":
      minDays = 0;
      maxDays = 1;
      break;
    case "1w":
      minDays = 5;
      maxDays = 9;
      break;
    case "2w":
      minDays = 12;
      maxDays = 16;
      break;
    case "3w":
      minDays = 19;
      maxDays = 23;
      break;
    case "1m":
      minDays = 26;
      maxDays = 35;
      break;
  }
  
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + minDays);
  
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxDays);
  
  return {
    minDate: minDate.toISOString().split("T")[0],
    maxDate: maxDate.toISOString().split("T")[0],
  };
}

export async function fetchUnderlyingSnapshot(symbol: string): Promise<PolygonOptionsChain> {
  const apiKey = getPolygonApiKey();
  
  if (!apiKey) {
    console.warn("[Polygon] No API key configured, returning empty chain");
    return { underlyingPrice: 0, options: [] };
  }
  
  try {
    const tickerUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`;
    const tickerResponse = await fetch(tickerUrl);
    
    if (!tickerResponse.ok) {
      throw new Error(`Polygon ticker API error: ${tickerResponse.status}`);
    }
    
    const tickerData = await tickerResponse.json();
    const underlyingPrice = tickerData.results?.[0]?.c || 0;
    
    const optionsUrl = `${POLYGON_BASE_URL}/v3/snapshot/options/${symbol}?limit=250&apiKey=${apiKey}`;
    const optionsResponse = await fetch(optionsUrl);
    
    if (!optionsResponse.ok) {
      if (optionsResponse.status === 403) {
        console.warn("[Polygon] Options API requires paid subscription");
        return { underlyingPrice, options: [] };
      }
      throw new Error(`Polygon options API error: ${optionsResponse.status}`);
    }
    
    const optionsData = await optionsResponse.json();
    const results = optionsData.results || [];
    
    const options: PolygonOptionContract[] = results.map((opt: any) => {
      const details = opt.details || {};
      const day = opt.day || {};
      const greeks = opt.greeks || {};
      
      return {
        symbol: details.ticker || opt.ticker || "",
        expirationDate: details.expiration_date || "",
        strike: details.strike_price || 0,
        type: details.contract_type?.toLowerCase() === "put" ? "put" : "call",
        mid: (day.close + day.open) / 2 || day.close || 0,
        bid: opt.last_quote?.bid || 0,
        ask: opt.last_quote?.ask || 0,
        last: day.close || 0,
        greeks: {
          delta: greeks.delta || 0,
          gamma: greeks.gamma || 0,
          theta: greeks.theta || 0,
          vega: greeks.vega || 0,
        },
        impliedVolatility: opt.implied_volatility || 0,
        openInterest: opt.open_interest || 0,
        volume: day.volume || 0,
      };
    });
    
    console.log(`[Polygon] Fetched ${options.length} options for ${symbol} @ $${underlyingPrice.toFixed(2)}`);
    
    return { underlyingPrice, options };
  } catch (error: any) {
    console.error(`[Polygon] Error fetching options for ${symbol}:`, error.message);
    return { underlyingPrice: 0, options: [] };
  }
}

export async function fetchOptionsChainWithFilters(
  symbol: string,
  contractType: "call" | "put",
  expirationDateGte?: string,
  expirationDateLte?: string
): Promise<PolygonOptionsChain> {
  const apiKey = getPolygonApiKey();
  
  if (!apiKey) {
    console.warn("[Polygon] No API key configured");
    return { underlyingPrice: 0, options: [] };
  }
  
  try {
    const tickerUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`;
    const tickerResponse = await fetch(tickerUrl);
    const tickerData = await tickerResponse.json();
    const underlyingPrice = tickerData.results?.[0]?.c || 0;
    
    let optionsUrl = `${POLYGON_BASE_URL}/v3/snapshot/options/${symbol}?contract_type=${contractType}&limit=250&apiKey=${apiKey}`;
    
    if (expirationDateGte) {
      optionsUrl += `&expiration_date.gte=${expirationDateGte}`;
    }
    if (expirationDateLte) {
      optionsUrl += `&expiration_date.lte=${expirationDateLte}`;
    }
    
    const optionsResponse = await fetch(optionsUrl);
    
    if (!optionsResponse.ok) {
      if (optionsResponse.status === 403) {
        console.warn("[Polygon] Options snapshot requires Options subscription tier");
        return { underlyingPrice, options: [] };
      }
      throw new Error(`Polygon options API error: ${optionsResponse.status}`);
    }
    
    const optionsData = await optionsResponse.json();
    const results = optionsData.results || [];
    
    const options: PolygonOptionContract[] = results.map((opt: any) => {
      const details = opt.details || {};
      const day = opt.day || {};
      const greeks = opt.greeks || {};
      const quote = opt.last_quote || {};
      
      const bid = quote.bid || 0;
      const ask = quote.ask || 0;
      const mid = bid && ask ? (bid + ask) / 2 : day.close || 0;
      
      return {
        symbol: details.ticker || opt.ticker || "",
        expirationDate: details.expiration_date || "",
        strike: details.strike_price || 0,
        type: details.contract_type?.toLowerCase() === "put" ? "put" : "call",
        mid,
        bid,
        ask,
        last: day.close || 0,
        greeks: {
          delta: greeks.delta || 0,
          gamma: greeks.gamma || 0,
          theta: greeks.theta || 0,
          vega: greeks.vega || 0,
        },
        impliedVolatility: opt.implied_volatility || 0,
        openInterest: opt.open_interest || 0,
        volume: day.volume || 0,
      };
    });
    
    return { underlyingPrice, options };
  } catch (error: any) {
    console.error(`[Polygon] Error fetching filtered chain for ${symbol}:`, error.message);
    return { underlyingPrice: 0, options: [] };
  }
}

export function filterOptionsByStrategy(
  chain: PolygonOptionsChain,
  filters: StrategyFilters
): FilteredContracts {
  if (filters.direction === "NO_TRADE" || chain.options.length === 0) {
    return { primaryContract: null, alternatives: [] };
  }
  
  const targetType = filters.direction === "BUY_CALL" ? "call" : "put";
  const { minDate, maxDate } = getTargetExpirationDate(filters.preferredExpirationWindow);
  const [minDelta, maxDelta] = filters.targetDeltaRange;
  const underlyingPrice = chain.underlyingPrice;
  
  let filtered = chain.options.filter(opt => {
    if (opt.type !== targetType) return false;
    if (opt.expirationDate < minDate || opt.expirationDate > maxDate) return false;
    if (opt.bid <= 0 && opt.mid <= 0) return false;
    
    const spread = opt.ask - opt.bid;
    const spreadPercent = opt.mid > 0 ? spread / opt.mid : 1;
    if (spreadPercent > 0.25) return false;
    
    return true;
  });
  
  const moneynessTargets: Record<string, [number, number]> = {
    deep_itm: targetType === "call" ? [0.85, 1.0] : [1.0, 1.15],
    itm: targetType === "call" ? [0.95, 1.0] : [1.0, 1.05],
    atm: [0.98, 1.02],
    slightly_otm: targetType === "call" ? [1.0, 1.05] : [0.95, 1.0],
    far_otm: targetType === "call" ? [1.05, 1.15] : [0.85, 0.95],
  };
  
  const [minMoneyness, maxMoneyness] = moneynessTargets[filters.preferredMoneyness] || [0.95, 1.05];
  
  filtered = filtered.filter(opt => {
    const moneyness = opt.strike / underlyingPrice;
    return moneyness >= minMoneyness && moneyness <= maxMoneyness;
  });
  
  filtered = filtered.filter(opt => {
    const absDelta = Math.abs(opt.greeks.delta);
    return absDelta >= minDelta && absDelta <= maxDelta;
  });
  
  if (filtered.length === 0) {
    const relaxedFiltered = chain.options.filter(opt => {
      if (opt.type !== targetType) return false;
      if (opt.bid <= 0 && opt.mid <= 0) return false;
      return true;
    });
    
    relaxedFiltered.sort((a, b) => {
      const aDeltaDiff = Math.abs(Math.abs(a.greeks.delta) - (minDelta + maxDelta) / 2);
      const bDeltaDiff = Math.abs(Math.abs(b.greeks.delta) - (minDelta + maxDelta) / 2);
      return aDeltaDiff - bDeltaDiff;
    });
    
    filtered = relaxedFiltered.slice(0, 5);
  }
  
  filtered.sort((a, b) => {
    const targetDelta = (minDelta + maxDelta) / 2;
    const aDeltaDiff = Math.abs(Math.abs(a.greeks.delta) - targetDelta);
    const bDeltaDiff = Math.abs(Math.abs(b.greeks.delta) - targetDelta);
    
    if (Math.abs(aDeltaDiff - bDeltaDiff) < 0.05) {
      return b.openInterest - a.openInterest;
    }
    return aDeltaDiff - bDeltaDiff;
  });
  
  const primaryContract = filtered[0] || null;
  const alternatives = filtered.slice(1, 4);
  
  if (primaryContract) {
    console.log(`[Polygon] Selected primary: ${primaryContract.symbol} Strike $${primaryContract.strike} Delta ${primaryContract.greeks.delta.toFixed(2)}`);
  }
  
  return { primaryContract, alternatives };
}

export function buildChainSummaryForAI(chain: PolygonOptionsChain): string {
  if (chain.options.length === 0) {
    return "No options data available";
  }
  
  const calls = chain.options.filter(o => o.type === "call");
  const puts = chain.options.filter(o => o.type === "put");
  
  const expirations = [...new Set(chain.options.map(o => o.expirationDate))].sort();
  
  const deltaBands = {
    calls: {
      high: calls.filter(c => Math.abs(c.greeks.delta) >= 0.6).length,
      mid: calls.filter(c => Math.abs(c.greeks.delta) >= 0.3 && Math.abs(c.greeks.delta) < 0.6).length,
      low: calls.filter(c => Math.abs(c.greeks.delta) < 0.3).length,
    },
    puts: {
      high: puts.filter(p => Math.abs(p.greeks.delta) >= 0.6).length,
      mid: puts.filter(p => Math.abs(p.greeks.delta) >= 0.3 && Math.abs(p.greeks.delta) < 0.6).length,
      low: puts.filter(p => Math.abs(p.greeks.delta) < 0.3).length,
    },
  };
  
  return `Options Chain Summary:
- Underlying: $${chain.underlyingPrice.toFixed(2)}
- Available Expirations: ${expirations.slice(0, 5).join(", ")}${expirations.length > 5 ? ` (+${expirations.length - 5} more)` : ""}
- Calls available: ${calls.length} (High delta: ${deltaBands.calls.high}, Mid: ${deltaBands.calls.mid}, Low: ${deltaBands.calls.low})
- Puts available: ${puts.length} (High delta: ${deltaBands.puts.high}, Mid: ${deltaBands.puts.mid}, Low: ${deltaBands.puts.low})`;
}
