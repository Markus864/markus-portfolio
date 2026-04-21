import { getOptionsExpirations, getOptionsChain, type OptionsContract, type OptionsChain } from './tradier-service';

export interface LiveOptionSnapshot {
  id: string;
  symbol: string;
  underlyingPrice: number;
  optionSymbol: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;
  daysToExpiry: number;
  bid: number;
  ask: number;
  midPrice: number;
  last: number;
  volume: number;
  openInterest: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
  bidAskSpread: number;
  spreadPercent: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
  fetchedAt: Date;
}

export interface ScannerFilters {
  symbols?: string[];
  sectors?: string[];
  optionType?: 'call' | 'put' | 'both';
  minDelta?: number;
  maxDelta?: number;
  minIV?: number;
  maxIV?: number;
  minVolume?: number;
  minOpenInterest?: number;
  maxPremium?: number;
  minPremium?: number;
  maxDaysToExpiry?: number;
  minDaysToExpiry?: number;
  moneyness?: ('ITM' | 'ATM' | 'OTM')[];
  maxSpreadPercent?: number;
  strategies?: string[];
}

export interface ScanResult {
  options: LiveOptionSnapshot[];
  scannedSymbols: string[];
  totalContracts: number;
  matchingContracts: number;
  lastUpdated: Date;
  dataAge: number;
  cacheHit: boolean;
}

const TECH_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'INTC', 'TSLA', 'AMZN', 'NFLX', 'CRM', 'ADBE', 'ORCL'];
const INDEX_ETFS = ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK'];
const POPULAR_STOCKS = ['BA', 'JPM', 'GS', 'V', 'MA', 'UNH', 'JNJ', 'PFE', 'XOM', 'CVX', 'WMT', 'HD', 'DIS', 'COST'];

const ALL_SCAN_SYMBOLS = Array.from(new Set([...TECH_STOCKS, ...INDEX_ETFS, ...POPULAR_STOCKS]));

const optionsCache: Map<string, { data: LiveOptionSnapshot[], fetchedAt: Date }> = new Map();
const underlyingPrices: Map<string, { price: number, fetchedAt: Date }> = new Map();
const CACHE_TTL_MS = 60000;
const PRICE_CACHE_TTL_MS = 60000;
const MIN_REQUEST_INTERVAL_MS = 600;

let isScanning = false;
let lastScanTime: Date | null = null;
let scanErrors: string[] = [];
let lastRequestTime = 0;
let requestCount = 0;
let requestWindowStart = Date.now();

async function throttledRequest(): Promise<void> {
  const now = Date.now();
  
  if (now - requestWindowStart > 60000) {
    requestCount = 0;
    requestWindowStart = now;
  }
  
  if (requestCount >= 100) {
    const waitTime = 60000 - (now - requestWindowStart);
    if (waitTime > 0) {
      console.log(`[Scanner] Rate limit protection: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      requestCount = 0;
      requestWindowStart = Date.now();
    }
  }
  
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLast));
  }
  
  lastRequestTime = Date.now();
  requestCount++;
}

export function getCacheStatus(): { 
  cachedSymbols: number; 
  totalContracts: number; 
  lastScan: Date | null;
  isScanning: boolean;
  errors: string[];
  supportedSymbols: string[];
  cacheExpiry: number;
} {
  let totalContracts = 0;
  optionsCache.forEach(entry => {
    totalContracts += entry.data.length;
  });
  
  return {
    cachedSymbols: optionsCache.size,
    totalContracts,
    lastScan: lastScanTime,
    isScanning,
    errors: scanErrors.slice(-5),
    supportedSymbols: ALL_SCAN_SYMBOLS,
    cacheExpiry: CACHE_TTL_MS / 1000
  };
}

async function getUnderlyingPrice(symbol: string): Promise<number> {
  const cached = underlyingPrices.get(symbol);
  const now = new Date();
  
  if (cached && (now.getTime() - cached.fetchedAt.getTime()) < PRICE_CACHE_TTL_MS) {
    return cached.price;
  }
  
  try {
    await throttledRequest();
    
    const apiKey = process.env.TRADIER_API_KEY;
    if (!apiKey) throw new Error('TRADIER_API_KEY not configured');
    
    const response = await fetch(
      `https://api.tradier.com/v1/markets/quotes?symbols=${symbol}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );
    
    if (response.status === 429) {
      console.log(`[Scanner] Rate limited on quote for ${symbol}, using cached price`);
      return cached?.price || 0;
    }
    
    if (!response.ok) throw new Error(`Quote fetch failed: ${response.status}`);
    
    const data = await response.json();
    const quote = data.quotes?.quote;
    const price = quote?.last || quote?.close || 0;
    
    if (price > 0) {
      underlyingPrices.set(symbol, { price, fetchedAt: new Date() });
    }
    
    return price;
  } catch (error) {
    console.error(`[Scanner] Failed to get price for ${symbol}:`, error);
    return cached?.price || 0;
  }
}

function calculateMoneyness(strike: number, underlyingPrice: number, optionType: 'call' | 'put'): 'ITM' | 'ATM' | 'OTM' {
  const percentDiff = Math.abs((strike - underlyingPrice) / underlyingPrice);
  
  if (percentDiff < 0.02) return 'ATM';
  
  if (optionType === 'call') {
    return strike < underlyingPrice ? 'ITM' : 'OTM';
  } else {
    return strike > underlyingPrice ? 'ITM' : 'OTM';
  }
}

function calculateDaysToExpiry(expirationDate: string): number {
  const expiry = new Date(expirationDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

async function getThrottledOptionsExpirations(symbol: string): Promise<string[]> {
  await throttledRequest();
  return getOptionsExpirations(symbol);
}

async function getThrottledOptionsChain(symbol: string, expiration: string): Promise<{ calls: OptionsContract[], puts: OptionsContract[], symbol: string, expirationDate: string }> {
  await throttledRequest();
  return getOptionsChain(symbol, expiration);
}

async function scanSymbol(symbol: string): Promise<LiveOptionSnapshot[]> {
  const snapshots: LiveOptionSnapshot[] = [];
  
  try {
    const expirations = await getThrottledOptionsExpirations(symbol);
    
    if (!expirations.length) {
      return [];
    }
    
    const underlyingPrice = await getUnderlyingPrice(symbol);
    if (!underlyingPrice) {
      return [];
    }
    
    const nearTermExpirations = expirations.slice(0, 2);
    
    for (const expiration of nearTermExpirations) {
      try {
        const chain = await getThrottledOptionsChain(symbol, expiration);
        const daysToExpiry = calculateDaysToExpiry(expiration);
        
        const processContract = (contract: OptionsContract, type: 'call' | 'put') => {
          const midPrice = (contract.bid + contract.ask) / 2;
          const bidAskSpread = contract.ask - contract.bid;
          const spreadPercent = midPrice > 0 ? (bidAskSpread / midPrice) * 100 : 100;
          
          if (contract.bid <= 0 && contract.ask <= 0) return;
          if (midPrice < 0.01) return;
          
          snapshots.push({
            id: `${contract.symbol}-${Date.now()}`,
            symbol: symbol,
            underlyingPrice,
            optionSymbol: contract.symbol,
            optionType: type,
            strike: contract.strike,
            expiration: expiration,
            daysToExpiry,
            bid: contract.bid,
            ask: contract.ask,
            midPrice,
            last: contract.last,
            volume: contract.volume,
            openInterest: contract.openInterest,
            delta: contract.delta ?? null,
            gamma: contract.gamma ?? null,
            theta: contract.theta ?? null,
            vega: contract.vega ?? null,
            iv: contract.impliedVolatility ?? null,
            bidAskSpread,
            spreadPercent,
            moneyness: calculateMoneyness(contract.strike, underlyingPrice, type),
            fetchedAt: new Date()
          });
        };
        
        chain.calls.forEach(c => processContract(c, 'call'));
        chain.puts.forEach(p => processContract(p, 'put'));
        
      } catch (chainError) {
        console.error(`[Scanner] Error fetching chain ${symbol} ${expiration}:`, chainError);
      }
    }
    
    optionsCache.set(symbol, { data: snapshots, fetchedAt: new Date() });
    console.log(`[Scanner] Cached ${snapshots.length} contracts for ${symbol}`);
    
  } catch (error) {
    console.error(`[Scanner] Error scanning ${symbol}:`, error);
    scanErrors.push(`${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return snapshots;
}

export async function runFullScan(symbols?: string[]): Promise<void> {
  if (isScanning) {
    console.log('[Scanner] Scan already in progress, skipping...');
    return;
  }
  
  isScanning = true;
  scanErrors = [];
  const symbolsToScan = symbols || ALL_SCAN_SYMBOLS;
  
  console.log(`[Scanner] Starting full scan of ${symbolsToScan.length} symbols (throttled)...`);
  
  try {
    for (const symbol of symbolsToScan) {
      await scanSymbol(symbol);
    }
    
    lastScanTime = new Date();
    console.log(`[Scanner] Full scan complete. Cached ${optionsCache.size} symbols.`);
    
  } catch (error) {
    console.error('[Scanner] Full scan failed:', error);
    scanErrors.push(`Full scan: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    isScanning = false;
  }
}

export async function scanSymbolOnDemand(symbol: string): Promise<LiveOptionSnapshot[]> {
  const cached = optionsCache.get(symbol.toUpperCase());
  const now = new Date();
  
  if (cached && (now.getTime() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    return cached.data;
  }
  
  return scanSymbol(symbol.toUpperCase());
}

export function parseNaturalLanguageQuery(query: string): ScannerFilters {
  const filters: ScannerFilters = {};
  const q = query.toLowerCase();
  
  if (q.includes('tech') || q.includes('technology')) {
    filters.symbols = TECH_STOCKS;
    filters.sectors = ['technology'];
  }
  if (q.includes('index') || q.includes('etf') || q.includes('spy') || q.includes('qqq')) {
    filters.symbols = filters.symbols ? [...filters.symbols, ...INDEX_ETFS] : INDEX_ETFS;
  }
  
  if (q.includes('call') && !q.includes('put')) {
    filters.optionType = 'call';
  } else if (q.includes('put') && !q.includes('call')) {
    filters.optionType = 'put';
  }
  
  if (q.includes('high iv') || q.includes('high volatility')) {
    filters.minIV = 50;
  }
  if (q.includes('low iv') || q.includes('low volatility')) {
    filters.maxIV = 30;
  }
  
  const ivMatch = q.match(/iv\s*(above|over|>)\s*(\d+)/);
  if (ivMatch) {
    filters.minIV = parseInt(ivMatch[2]);
  }
  const ivMaxMatch = q.match(/iv\s*(below|under|<)\s*(\d+)/);
  if (ivMaxMatch) {
    filters.maxIV = parseInt(ivMaxMatch[2]);
  }
  
  if (q.includes('high delta') || q.includes('deep itm')) {
    filters.minDelta = 0.6;
  }
  if (q.includes('low delta') || q.includes('far otm')) {
    filters.maxDelta = 0.3;
  }
  
  const deltaMatch = q.match(/delta\s*(above|over|>)\s*([0-9.]+)/);
  if (deltaMatch) {
    filters.minDelta = parseFloat(deltaMatch[2]);
  }
  const deltaMaxMatch = q.match(/delta\s*(below|under|<)\s*([0-9.]+)/);
  if (deltaMaxMatch) {
    filters.maxDelta = parseFloat(deltaMaxMatch[2]);
  }
  
  const premiumMatch = q.match(/premium\s*(under|below|<)\s*\$?(\d+)/);
  if (premiumMatch) {
    filters.maxPremium = parseFloat(premiumMatch[2]);
  }
  const premiumMinMatch = q.match(/premium\s*(over|above|>)\s*\$?(\d+)/);
  if (premiumMinMatch) {
    filters.minPremium = parseFloat(premiumMinMatch[2]);
  }
  
  if (q.includes('weekly') || q.includes('this week')) {
    filters.maxDaysToExpiry = 7;
  }
  if (q.includes('0dte') || q.includes('same day') || q.includes('today')) {
    filters.maxDaysToExpiry = 0;
  }
  if (q.includes('monthly') || q.includes('month')) {
    filters.minDaysToExpiry = 20;
    filters.maxDaysToExpiry = 45;
  }
  
  if (q.includes('high volume') || q.includes('liquid')) {
    filters.minVolume = 100;
    filters.minOpenInterest = 500;
  }
  
  const volumeMatch = q.match(/volume\s*(over|above|>)\s*(\d+)/);
  if (volumeMatch) {
    filters.minVolume = parseInt(volumeMatch[2]);
  }
  
  if (q.includes('itm') || q.includes('in the money')) {
    filters.moneyness = ['ITM'];
  }
  if (q.includes('otm') || q.includes('out of the money')) {
    filters.moneyness = ['OTM'];
  }
  if (q.includes('atm') || q.includes('at the money')) {
    filters.moneyness = ['ATM'];
  }
  
  if (q.includes('tight spread') || q.includes('low spread')) {
    filters.maxSpreadPercent = 10;
  }
  
  const symbolMatches = q.match(/\b([A-Z]{1,5})\b/g);
  if (symbolMatches) {
    const validSymbols = symbolMatches.filter(s => 
      ALL_SCAN_SYMBOLS.includes(s) || s.length >= 2
    );
    if (validSymbols.length > 0 && !filters.symbols) {
      filters.symbols = validSymbols;
    }
  }
  
  return filters;
}

function applyFilters(options: LiveOptionSnapshot[], filters: ScannerFilters): LiveOptionSnapshot[] {
  return options.filter(opt => {
    if (filters.symbols && filters.symbols.length > 0) {
      if (!filters.symbols.includes(opt.symbol)) return false;
    }
    
    if (filters.optionType && filters.optionType !== 'both') {
      if (opt.optionType !== filters.optionType) return false;
    }
    
    if (filters.minDelta !== undefined && opt.delta !== null) {
      if (Math.abs(opt.delta) < filters.minDelta) return false;
    }
    if (filters.maxDelta !== undefined && opt.delta !== null) {
      if (Math.abs(opt.delta) > filters.maxDelta) return false;
    }
    
    if (filters.minIV !== undefined && opt.iv !== null) {
      if (opt.iv < filters.minIV) return false;
    }
    if (filters.maxIV !== undefined && opt.iv !== null) {
      if (opt.iv > filters.maxIV) return false;
    }
    
    if (filters.minVolume !== undefined) {
      if (opt.volume < filters.minVolume) return false;
    }
    if (filters.minOpenInterest !== undefined) {
      if (opt.openInterest < filters.minOpenInterest) return false;
    }
    
    if (filters.maxPremium !== undefined) {
      if (opt.midPrice > filters.maxPremium) return false;
    }
    if (filters.minPremium !== undefined) {
      if (opt.midPrice < filters.minPremium) return false;
    }
    
    if (filters.maxDaysToExpiry !== undefined) {
      if (opt.daysToExpiry > filters.maxDaysToExpiry) return false;
    }
    if (filters.minDaysToExpiry !== undefined) {
      if (opt.daysToExpiry < filters.minDaysToExpiry) return false;
    }
    
    if (filters.moneyness && filters.moneyness.length > 0) {
      if (!filters.moneyness.includes(opt.moneyness)) return false;
    }
    
    if (filters.maxSpreadPercent !== undefined) {
      if (opt.spreadPercent > filters.maxSpreadPercent) return false;
    }
    
    return true;
  });
}

export async function searchLiveOptions(query: string, limit: number = 50): Promise<ScanResult> {
  const filters = parseNaturalLanguageQuery(query);
  
  let symbolsToSearch = filters.symbols || ALL_SCAN_SYMBOLS;
  const now = new Date();
  let allOptions: LiveOptionSnapshot[] = [];
  let cacheHit = true;
  const scannedSymbols: string[] = [];
  
  for (const symbol of symbolsToSearch) {
    const cached = optionsCache.get(symbol.toUpperCase());
    
    if (cached && (now.getTime() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
      allOptions.push(...cached.data);
      scannedSymbols.push(symbol);
    } else {
      cacheHit = false;
      const freshData = await scanSymbolOnDemand(symbol);
      allOptions.push(...freshData);
      scannedSymbols.push(symbol);
    }
  }
  
  const filtered = applyFilters(allOptions, filters);
  
  const sorted = filtered.sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    if (b.openInterest !== a.openInterest) return b.openInterest - a.openInterest;
    return (b.iv || 0) - (a.iv || 0);
  });
  
  const oldestFetch = allOptions.reduce((oldest, opt) => {
    return opt.fetchedAt < oldest ? opt.fetchedAt : oldest;
  }, now);
  
  return {
    options: sorted.slice(0, limit),
    scannedSymbols,
    totalContracts: allOptions.length,
    matchingContracts: filtered.length,
    lastUpdated: oldestFetch,
    dataAge: Math.round((now.getTime() - oldestFetch.getTime()) / 1000),
    cacheHit
  };
}

export { TECH_STOCKS, INDEX_ETFS, POPULAR_STOCKS, ALL_SCAN_SYMBOLS };
