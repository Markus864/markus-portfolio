/**
 * Tradier API Service - FALLBACK ONLY
 * 
 * Primary data provider is Polygon.io (paid plan).
 * This service is used as a fallback when Polygon is unavailable.
 */

import { env } from "./config/env";

export interface OptionsExpiration {
  date: string;
}

export interface OptionsContract {
  symbol: string;
  description: string;
  strike: number;
  optionType: 'call' | 'put';
  expirationDate: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  openInterest: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
  impliedVolatility?: number;
}

export interface OptionsChain {
  symbol: string;
  expirationDate: string;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

const TRADIER_BASE_URL = 'https://api.tradier.com/v1';

async function tradierFetch(endpoint: string): Promise<any> {
  const apiKey = env.marketData.tradierApiKey;
  
  if (!apiKey) {
    throw new Error('TRADIER_API_KEY not configured');
  }
  
  const response = await fetch(`${TRADIER_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Tradier API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function getOptionsExpirations(symbol: string): Promise<string[]> {
  try {
    const data = await tradierFetch(`/markets/options/expirations?symbol=${symbol.toUpperCase()}`);
    
    if (data.expirations?.date) {
      return Array.isArray(data.expirations.date) 
        ? data.expirations.date 
        : [data.expirations.date];
    }
    
    return [];
  } catch (error: any) {
    console.error(`Failed to get expirations for ${symbol}:`, error.message);
    return [];
  }
}

export async function getOptionsChain(symbol: string, expiration: string): Promise<OptionsChain> {
  const upperSymbol = symbol.toUpperCase();
  
  try {
    // Fetch options chain with Greeks
    const data = await tradierFetch(
      `/markets/options/chains?symbol=${upperSymbol}&expiration=${expiration}&greeks=true`
    );
    
    const calls: OptionsContract[] = [];
    const puts: OptionsContract[] = [];
    
    if (data.options?.option) {
      const options = Array.isArray(data.options.option) 
        ? data.options.option 
        : [data.options.option];
      
      for (const opt of options) {
        const contract: OptionsContract = {
          symbol: opt.symbol,
          description: opt.description,
          strike: opt.strike,
          optionType: opt.option_type === 'call' ? 'call' : 'put',
          expirationDate: opt.expiration_date,
          bid: opt.bid || 0,
          ask: opt.ask || 0,
          last: opt.last || 0,
          volume: opt.volume || 0,
          openInterest: opt.open_interest || 0,
          delta: opt.greeks?.delta,
          gamma: opt.greeks?.gamma,
          theta: opt.greeks?.theta,
          vega: opt.greeks?.vega,
          rho: opt.greeks?.rho,
          impliedVolatility: opt.greeks?.mid_iv,
        };
        
        if (opt.option_type === 'call') {
          calls.push(contract);
        } else {
          puts.push(contract);
        }
      }
    }
    
    // Sort by strike price
    calls.sort((a, b) => a.strike - b.strike);
    puts.sort((a, b) => a.strike - b.strike);
    
    return {
      symbol: upperSymbol,
      expirationDate: expiration,
      calls,
      puts,
    };
  } catch (error: any) {
    console.error(`Failed to get options chain for ${symbol}:`, error.message);
    return {
      symbol: upperSymbol,
      expirationDate: expiration,
      calls: [],
      puts: [],
    };
  }
}

export async function findOptimalContract(
  symbol: string,
  optionType: 'call' | 'put',
  targetDelta: number = 0.3,
  daysToExpiration: number = 7
): Promise<OptionsContract | null> {
  try {
    // Get available expirations
    const expirations = await getOptionsExpirations(symbol);
    
    if (expirations.length === 0) {
      console.warn(`No expirations found for ${symbol}`);
      return null;
    }
    
    // Find expiration closest to target days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToExpiration);
    
    let bestExpiration = expirations[0];
    let minDiff = Infinity;
    
    for (const exp of expirations) {
      const expDate = new Date(exp);
      const diff = Math.abs(expDate.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        bestExpiration = exp;
      }
    }
    
    // Get the options chain for that expiration
    const chain = await getOptionsChain(symbol, bestExpiration);
    const contracts = optionType === 'call' ? chain.calls : chain.puts;
    
    if (contracts.length === 0) {
      console.warn(`No ${optionType} contracts found for ${symbol}`);
      return null;
    }
    
    // Find contract with delta closest to target
    // For puts, delta is negative, so we compare absolute values
    let bestContract = contracts[0];
    let minDeltaDiff = Infinity;
    
    for (const contract of contracts) {
      if (contract.delta !== undefined && contract.bid > 0) {
        const contractDelta = Math.abs(contract.delta);
        const diff = Math.abs(contractDelta - targetDelta);
        
        if (diff < minDeltaDiff) {
          minDeltaDiff = diff;
          bestContract = contract;
        }
      }
    }
    
    // If no contract with delta found, find one near the money with good liquidity
    if (bestContract.delta === undefined) {
      const liquidContracts = contracts.filter(c => c.bid > 0 && c.openInterest > 10);
      if (liquidContracts.length > 0) {
        // Pick middle one (near the money)
        bestContract = liquidContracts[Math.floor(liquidContracts.length / 2)];
      }
    }
    
    return bestContract;
  } catch (error: any) {
    console.error(`Failed to find optimal contract for ${symbol}:`, error.message);
    return null;
  }
}

export async function getQuote(symbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
} | null> {
  try {
    const data = await tradierFetch(`/markets/quotes?symbols=${symbol.toUpperCase()}`);
    
    if (data.quotes?.quote) {
      const q = data.quotes.quote;
      return {
        price: q.last || q.close || 0,
        change: q.change || 0,
        changePercent: q.change_percentage || 0,
        volume: q.volume || 0,
        high: q.high || q.last || 0,
        low: q.low || q.last || 0,
        open: q.open || q.last || 0,
        prevClose: q.prevclose || q.last || 0,
      };
    }
    
    return null;
  } catch (error: any) {
    console.error(`Failed to get quote for ${symbol}:`, error.message);
    return null;
  }
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  
  // Weekend check
  if (day === 0 || day === 6) return false;
  
  // Convert to ET (approximate - doesn't handle DST perfectly)
  const utcHour = now.getUTCHours();
  const etHour = (utcHour - 5 + 24) % 24;
  
  // Market hours: 9:30 AM - 4:00 PM ET
  if (etHour < 9 || etHour >= 16) return false;
  if (etHour === 9 && now.getUTCMinutes() < 30) return false;
  
  return true;
}

export interface HistoricalBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getHistoricalData(
  symbol: string,
  interval: 'daily' | 'weekly' | 'monthly' = 'daily',
  startDate?: string,
  endDate?: string
): Promise<HistoricalBar[]> {
  const upperSymbol = symbol.toUpperCase();
  
  // Default to last 30 days if no dates provided
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  
  try {
    const data = await tradierFetch(
      `/markets/history?symbol=${upperSymbol}&interval=${interval}&start=${start}&end=${end}`
    );
    
    if (data.history?.day) {
      const days = Array.isArray(data.history.day) ? data.history.day : [data.history.day];
      return days.map((d: any) => ({
        date: new Date(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume || 0,
      }));
    }
    
    return [];
  } catch (error: any) {
    console.error(`Failed to get Tradier historical data for ${symbol}:`, error.message);
    return [];
  }
}
