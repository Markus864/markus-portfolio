/**
 * Polygon.io Options Service
 * Fetches real options contracts and selects best matches for AI strategy signals
 */

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE_URL = "https://api.polygon.io";

export interface PolygonOptionContract {
  symbol: string;
  expirationDate: string;
  strike: number;
  type: "call" | "put";
  mid: number;
  bid: number;
  ask: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVolatility: number | null;
  openInterest: number | null;
  volume: number | null;
}

export interface PositionPreview {
  premium: number;
  contractMultiplier: number;
  costPerContract: number;
}

export interface StrategyParams {
  symbol: string;
  optionType: "CALL" | "PUT";
  currentPrice: number;
  preferredExpiry: string | null;
  preferredMoneyness: string | null;
  targetDeltaRange: [number, number] | null;
}

/**
 * Convert preferredExpiry string to approximate target days
 */
function expiryToDays(preferredExpiry: string | null): { minDays: number; maxDays: number } {
  const expiryMap: Record<string, { minDays: number; maxDays: number }> = {
    "0dte": { minDays: 0, maxDays: 1 },
    "1w": { minDays: 5, maxDays: 9 },
    "2w": { minDays: 10, maxDays: 16 },
    "3w": { minDays: 17, maxDays: 23 },
    "1m": { minDays: 24, maxDays: 35 },
    "monthly": { minDays: 24, maxDays: 45 },
  };
  
  if (!preferredExpiry) {
    return { minDays: 14, maxDays: 35 }; // Default to 2-4 weeks
  }
  
  const key = preferredExpiry.toLowerCase().replace(/\s+/g, "");
  return expiryMap[key] || { minDays: 14, maxDays: 35 };
}

/**
 * Calculate ideal strike based on moneyness preference
 */
function calculateTargetStrike(
  currentPrice: number,
  optionType: "CALL" | "PUT",
  moneyness: string | null
): number {
  const moneynessMultipliers: Record<string, number> = {
    "atm": 0,
    "slightly_otm": optionType === "CALL" ? 0.02 : -0.02,
    "otm": optionType === "CALL" ? 0.05 : -0.05,
    "deep_otm": optionType === "CALL" ? 0.10 : -0.10,
    "slightly_itm": optionType === "CALL" ? -0.02 : 0.02,
    "itm": optionType === "CALL" ? -0.05 : 0.05,
  };
  
  const multiplier = moneyness ? (moneynessMultipliers[moneyness.toLowerCase()] || 0) : 0;
  return currentPrice * (1 + multiplier);
}

/**
 * Fetch underlying price snapshot from Polygon
 */
export async function fetchUnderlyingPrice(symbol: string): Promise<number | null> {
  if (!POLYGON_API_KEY) {
    console.error("[Polygon] POLYGON_API_KEY is not set");
    return null;
  }

  try {
    const url = `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`;
    const response = await fetch(`${url}?apiKey=${POLYGON_API_KEY}`);
    
    if (!response.ok) {
      console.error(`[Polygon] Failed to fetch price for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Use last trade price, or midpoint of bid/ask
    if (data.ticker?.lastTrade?.p) {
      return data.ticker.lastTrade.p;
    }
    if (data.ticker?.lastQuote?.P && data.ticker?.lastQuote?.p) {
      return (data.ticker.lastQuote.P + data.ticker.lastQuote.p) / 2;
    }
    
    return null;
  } catch (error) {
    console.error(`[Polygon] Error fetching price for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch options contracts for a symbol from Polygon
 */
export async function fetchOptionsContracts(
  symbol: string,
  optionType: "CALL" | "PUT",
  minExpDate?: string,
  maxExpDate?: string
): Promise<PolygonOptionContract[]> {
  if (!POLYGON_API_KEY) {
    console.error("[Polygon] POLYGON_API_KEY is not set");
    return [];
  }

  try {
    // Build query params
    const params = new URLSearchParams({
      apiKey: POLYGON_API_KEY,
      underlying_ticker: symbol,
      contract_type: optionType.toLowerCase(),
      order: "asc",
      limit: "100",
      sort: "expiration_date",
    });
    
    if (minExpDate) {
      params.append("expiration_date.gte", minExpDate);
    }
    if (maxExpDate) {
      params.append("expiration_date.lte", maxExpDate);
    }

    const url = `${POLYGON_BASE_URL}/v3/reference/options/contracts?${params.toString()}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Polygon] Failed to fetch options for ${symbol}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    // Fetch snapshot data for the contracts to get current prices and greeks
    const contracts = data.results.slice(0, 50); // Limit to first 50 contracts
    const contractsWithData = await enrichContractsWithSnapshot(contracts);
    
    return contractsWithData;
  } catch (error) {
    console.error(`[Polygon] Error fetching options for ${symbol}:`, error);
    return [];
  }
}

/**
 * Enrich contracts with snapshot data (quotes and greeks)
 */
async function enrichContractsWithSnapshot(
  contracts: any[]
): Promise<PolygonOptionContract[]> {
  if (!POLYGON_API_KEY || contracts.length === 0) {
    return [];
  }

  const enrichedContracts: PolygonOptionContract[] = [];

  // Batch fetch snapshots - Polygon has a snapshot endpoint for options
  for (const contract of contracts) {
    try {
      const ticker = contract.ticker;
      const url = `${POLYGON_BASE_URL}/v3/snapshot/options/${encodeURIComponent(contract.underlying_ticker)}/${encodeURIComponent(ticker)}?apiKey=${POLYGON_API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // If snapshot fails, still include contract with basic info
        enrichedContracts.push({
          symbol: ticker,
          expirationDate: contract.expiration_date,
          strike: contract.strike_price,
          type: contract.contract_type as "call" | "put",
          mid: 0,
          bid: 0,
          ask: 0,
          delta: null,
          gamma: null,
          theta: null,
          vega: null,
          impliedVolatility: null,
          openInterest: null,
          volume: null,
        });
        continue;
      }
      
      const data = await response.json();
      const result = data.results;
      
      if (result) {
        const bid = result.last_quote?.bid || 0;
        const ask = result.last_quote?.ask || 0;
        const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : result.day?.close || 0;
        
        enrichedContracts.push({
          symbol: ticker,
          expirationDate: contract.expiration_date,
          strike: contract.strike_price,
          type: contract.contract_type as "call" | "put",
          mid: Math.round(mid * 100) / 100,
          bid: Math.round(bid * 100) / 100,
          ask: Math.round(ask * 100) / 100,
          delta: result.greeks?.delta ?? null,
          gamma: result.greeks?.gamma ?? null,
          theta: result.greeks?.theta ?? null,
          vega: result.greeks?.vega ?? null,
          impliedVolatility: result.implied_volatility ?? null,
          openInterest: result.open_interest ?? null,
          volume: result.day?.volume ?? null,
        });
      }
      
      // Rate limiting - Polygon free tier has limits
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[Polygon] Error fetching snapshot for contract:`, error);
    }
  }

  return enrichedContracts;
}

/**
 * Select the best contract matching the AI strategy parameters
 */
export function selectBestContractForStrategy(
  contracts: PolygonOptionContract[],
  strategy: StrategyParams
): PolygonOptionContract | null {
  if (contracts.length === 0) {
    return null;
  }

  const targetStrike = calculateTargetStrike(
    strategy.currentPrice,
    strategy.optionType,
    strategy.preferredMoneyness
  );
  
  const [minDelta, maxDelta] = strategy.targetDeltaRange || [0.25, 0.45];

  // Score each contract
  const scoredContracts = contracts
    .filter(c => c.mid > 0 || c.ask > 0) // Must have pricing
    .map(contract => {
      let score = 0;
      
      // Strike distance score (closer to target = higher score)
      const strikeDiff = Math.abs(contract.strike - targetStrike);
      const strikeScore = Math.max(0, 100 - (strikeDiff / strategy.currentPrice) * 500);
      score += strikeScore * 2;
      
      // Delta score (within target range = bonus)
      if (contract.delta !== null) {
        const absDelta = Math.abs(contract.delta);
        if (absDelta >= minDelta && absDelta <= maxDelta) {
          score += 50; // Perfect delta range
        } else {
          // Penalize based on distance from range
          const deltaDistance = absDelta < minDelta 
            ? minDelta - absDelta 
            : absDelta - maxDelta;
          score += Math.max(0, 30 - deltaDistance * 100);
        }
      }
      
      // Liquidity score
      if (contract.openInterest && contract.openInterest > 100) {
        score += 20;
      }
      if (contract.volume && contract.volume > 10) {
        score += 15;
      }
      
      // Spread score (tighter = better)
      if (contract.bid > 0 && contract.ask > 0) {
        const spreadPercent = (contract.ask - contract.bid) / contract.mid;
        if (spreadPercent < 0.05) {
          score += 20;
        } else if (spreadPercent < 0.10) {
          score += 10;
        }
      }
      
      return { contract, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scoredContracts.length === 0) {
    return null;
  }

  return scoredContracts[0].contract;
}

/**
 * Main function: Fetch and select best contract for a strategy signal
 */
export async function getContractForStrategy(
  strategy: StrategyParams
): Promise<{ selectedContract: PolygonOptionContract | null; positionPreview: PositionPreview | null }> {
  if (!POLYGON_API_KEY) {
    console.warn("[Polygon] POLYGON_API_KEY not configured - skipping contract selection");
    return { selectedContract: null, positionPreview: null };
  }

  try {
    // Calculate date range based on preferred expiry
    const { minDays, maxDays } = expiryToDays(strategy.preferredExpiry);
    const today = new Date();
    const minDate = new Date(today.getTime() + minDays * 24 * 60 * 60 * 1000);
    const maxDate = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
    
    const minExpDate = minDate.toISOString().split("T")[0];
    const maxExpDate = maxDate.toISOString().split("T")[0];

    // Fetch options contracts
    const contracts = await fetchOptionsContracts(
      strategy.symbol,
      strategy.optionType,
      minExpDate,
      maxExpDate
    );

    if (contracts.length === 0) {
      console.warn(`[Polygon] No contracts found for ${strategy.symbol} ${strategy.optionType}`);
      return { selectedContract: null, positionPreview: null };
    }

    // Select best matching contract
    const selectedContract = selectBestContractForStrategy(contracts, strategy);

    if (!selectedContract) {
      console.warn(`[Polygon] Could not select suitable contract for ${strategy.symbol}`);
      return { selectedContract: null, positionPreview: null };
    }

    // Build position preview
    const premium = selectedContract.mid > 0 ? selectedContract.mid : (selectedContract.ask + selectedContract.bid) / 2;
    const positionPreview: PositionPreview = {
      premium: Math.round(premium * 100) / 100,
      contractMultiplier: 100,
      costPerContract: Math.round(premium * 100 * 100) / 100,
    };

    console.log(`[Polygon] Selected contract for ${strategy.symbol}: ${selectedContract.symbol} @ $${premium.toFixed(2)}`);

    return { selectedContract, positionPreview };
  } catch (error) {
    console.error(`[Polygon] Error getting contract for ${strategy.symbol}:`, error);
    return { selectedContract: null, positionPreview: null };
  }
}
