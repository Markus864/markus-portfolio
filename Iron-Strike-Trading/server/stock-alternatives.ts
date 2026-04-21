// Stock alternatives service - maps expensive stocks to affordable alternatives in the same sector

interface StockInfo {
  symbol: string;
  sector: string;
  industry: string;
  priceRange: "high" | "medium" | "low"; // high: >$200, medium: $50-200, low: <$50
}

// Curated list of popular stocks with sector/industry classification
const stockDatabase: StockInfo[] = [
  // Technology - High Price
  { symbol: "NVDA", sector: "Technology", industry: "Semiconductors", priceRange: "medium" },
  { symbol: "AAPL", sector: "Technology", industry: "Consumer Electronics", priceRange: "high" },
  { symbol: "MSFT", sector: "Technology", industry: "Software", priceRange: "high" },
  { symbol: "GOOGL", sector: "Technology", industry: "Internet Services", priceRange: "medium" },
  { symbol: "AMZN", sector: "Technology", industry: "E-Commerce", priceRange: "medium" },
  { symbol: "META", sector: "Technology", industry: "Social Media", priceRange: "medium" },
  { symbol: "TSLA", sector: "Technology", industry: "Electric Vehicles", priceRange: "high" },
  { symbol: "AVGO", sector: "Technology", industry: "Semiconductors", priceRange: "high" },
  { symbol: "NFLX", sector: "Technology", industry: "Streaming", priceRange: "high" },
  
  // Technology - Medium Price
  { symbol: "AMD", sector: "Technology", industry: "Semiconductors", priceRange: "medium" },
  { symbol: "INTC", sector: "Technology", industry: "Semiconductors", priceRange: "low" },
  { symbol: "MU", sector: "Technology", industry: "Semiconductors", priceRange: "medium" },
  { symbol: "QCOM", sector: "Technology", industry: "Semiconductors", priceRange: "medium" },
  { symbol: "CRM", sector: "Technology", industry: "Software", priceRange: "high" },
  { symbol: "ORCL", sector: "Technology", industry: "Software", priceRange: "medium" },
  { symbol: "CSCO", sector: "Technology", industry: "Networking", priceRange: "low" },
  { symbol: "IBM", sector: "Technology", industry: "Software", priceRange: "high" },
  
  // Technology - Low Price (Good alternatives for small accounts)
  { symbol: "PLTR", sector: "Technology", industry: "Software", priceRange: "low" },
  { symbol: "SOFI", sector: "Technology", industry: "Fintech", priceRange: "low" },
  { symbol: "NIO", sector: "Technology", industry: "Electric Vehicles", priceRange: "low" },
  { symbol: "RIVN", sector: "Technology", industry: "Electric Vehicles", priceRange: "low" },
  { symbol: "LCID", sector: "Technology", industry: "Electric Vehicles", priceRange: "low" },
  { symbol: "F", sector: "Technology", industry: "Electric Vehicles", priceRange: "low" },
  { symbol: "SNAP", sector: "Technology", industry: "Social Media", priceRange: "low" },
  { symbol: "PINS", sector: "Technology", industry: "Social Media", priceRange: "low" },
  { symbol: "ROKU", sector: "Technology", industry: "Streaming", priceRange: "medium" },
  { symbol: "HOOD", sector: "Technology", industry: "Fintech", priceRange: "low" },
  
  // Finance
  { symbol: "JPM", sector: "Finance", industry: "Banking", priceRange: "high" },
  { symbol: "BAC", sector: "Finance", industry: "Banking", priceRange: "low" },
  { symbol: "WFC", sector: "Finance", industry: "Banking", priceRange: "medium" },
  { symbol: "C", sector: "Finance", industry: "Banking", priceRange: "medium" },
  { symbol: "GS", sector: "Finance", industry: "Investment Banking", priceRange: "high" },
  { symbol: "MS", sector: "Finance", industry: "Investment Banking", priceRange: "medium" },
  { symbol: "V", sector: "Finance", industry: "Payments", priceRange: "high" },
  { symbol: "MA", sector: "Finance", industry: "Payments", priceRange: "high" },
  { symbol: "PYPL", sector: "Finance", industry: "Payments", priceRange: "medium" },
  { symbol: "SQ", sector: "Finance", industry: "Payments", priceRange: "medium" },
  { symbol: "COIN", sector: "Finance", industry: "Crypto", priceRange: "high" },
  
  // Healthcare
  { symbol: "UNH", sector: "Healthcare", industry: "Insurance", priceRange: "high" },
  { symbol: "JNJ", sector: "Healthcare", industry: "Pharma", priceRange: "medium" },
  { symbol: "PFE", sector: "Healthcare", industry: "Pharma", priceRange: "low" },
  { symbol: "ABBV", sector: "Healthcare", industry: "Pharma", priceRange: "medium" },
  { symbol: "MRK", sector: "Healthcare", industry: "Pharma", priceRange: "medium" },
  { symbol: "LLY", sector: "Healthcare", industry: "Pharma", priceRange: "high" },
  { symbol: "BMY", sector: "Healthcare", industry: "Pharma", priceRange: "low" },
  { symbol: "MRNA", sector: "Healthcare", industry: "Biotech", priceRange: "low" },
  
  // Consumer
  { symbol: "WMT", sector: "Consumer", industry: "Retail", priceRange: "medium" },
  { symbol: "COST", sector: "Consumer", industry: "Retail", priceRange: "high" },
  { symbol: "TGT", sector: "Consumer", industry: "Retail", priceRange: "medium" },
  { symbol: "HD", sector: "Consumer", industry: "Retail", priceRange: "high" },
  { symbol: "LOW", sector: "Consumer", industry: "Retail", priceRange: "high" },
  { symbol: "NKE", sector: "Consumer", industry: "Apparel", priceRange: "medium" },
  { symbol: "SBUX", sector: "Consumer", industry: "Restaurants", priceRange: "medium" },
  { symbol: "MCD", sector: "Consumer", industry: "Restaurants", priceRange: "high" },
  { symbol: "KO", sector: "Consumer", industry: "Beverages", priceRange: "medium" },
  { symbol: "PEP", sector: "Consumer", industry: "Beverages", priceRange: "medium" },
  { symbol: "DIS", sector: "Consumer", industry: "Entertainment", priceRange: "medium" },
  
  // Energy
  { symbol: "XOM", sector: "Energy", industry: "Oil & Gas", priceRange: "medium" },
  { symbol: "CVX", sector: "Energy", industry: "Oil & Gas", priceRange: "medium" },
  { symbol: "COP", sector: "Energy", industry: "Oil & Gas", priceRange: "medium" },
  { symbol: "OXY", sector: "Energy", industry: "Oil & Gas", priceRange: "low" },
  { symbol: "SLB", sector: "Energy", industry: "Oil Services", priceRange: "low" },
  
  // ETFs (great alternatives for any sector)
  { symbol: "SPY", sector: "ETF", industry: "Broad Market", priceRange: "high" },
  { symbol: "QQQ", sector: "ETF", industry: "Technology", priceRange: "high" },
  { symbol: "IWM", sector: "ETF", industry: "Small Cap", priceRange: "high" },
  { symbol: "XLF", sector: "ETF", industry: "Financials", priceRange: "low" },
  { symbol: "XLK", sector: "ETF", industry: "Technology", priceRange: "high" },
  { symbol: "XLE", sector: "ETF", industry: "Energy", priceRange: "medium" },
  { symbol: "XLV", sector: "ETF", industry: "Healthcare", priceRange: "medium" },
  { symbol: "ARKK", sector: "ETF", industry: "Innovation", priceRange: "low" },
  { symbol: "SOXL", sector: "ETF", industry: "Semiconductors", priceRange: "low" },
  { symbol: "TQQQ", sector: "ETF", industry: "Technology Leveraged", priceRange: "medium" },
];

// Get stock info by symbol
export function getStockInfo(symbol: string): StockInfo | undefined {
  return stockDatabase.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
}

// Find affordable alternatives in the same sector/industry
export function findAffordableAlternatives(
  symbol: string,
  maxPrice: number,
  currentPrices: Map<string, number>
): { symbol: string; sector: string; industry: string; estimatedPrice: number; reason: string }[] {
  const originalStock = getStockInfo(symbol);
  if (!originalStock) {
    // If stock not in database, return general low-price alternatives
    return getGeneralAlternatives(maxPrice, currentPrices);
  }

  const alternatives: { symbol: string; sector: string; industry: string; estimatedPrice: number; reason: string }[] = [];

  // Priority 1: Same industry, lower price
  const sameIndustry = stockDatabase.filter(s => 
    s.symbol !== symbol &&
    s.industry === originalStock.industry &&
    (s.priceRange === "low" || (s.priceRange === "medium" && originalStock.priceRange === "high"))
  );

  for (const alt of sameIndustry) {
    const price = currentPrices.get(alt.symbol);
    if (price && price <= maxPrice) {
      alternatives.push({
        symbol: alt.symbol,
        sector: alt.sector,
        industry: alt.industry,
        estimatedPrice: price,
        reason: `Same industry as ${symbol} (${alt.industry})`
      });
    }
  }

  // Priority 2: Same sector, lower price
  const sameSector = stockDatabase.filter(s => 
    s.symbol !== symbol &&
    s.sector === originalStock.sector &&
    s.industry !== originalStock.industry &&
    (s.priceRange === "low" || (s.priceRange === "medium" && originalStock.priceRange === "high"))
  );

  for (const alt of sameSector) {
    const price = currentPrices.get(alt.symbol);
    if (price && price <= maxPrice && !alternatives.find(a => a.symbol === alt.symbol)) {
      alternatives.push({
        symbol: alt.symbol,
        sector: alt.sector,
        industry: alt.industry,
        estimatedPrice: price,
        reason: `Same sector as ${symbol} (${alt.sector})`
      });
    }
  }

  // Priority 3: ETFs that track the sector
  const sectorETFs = stockDatabase.filter(s => 
    s.sector === "ETF" &&
    (s.industry.toLowerCase().includes(originalStock.sector.toLowerCase()) ||
     s.industry.toLowerCase().includes(originalStock.industry.toLowerCase().split(" ")[0]))
  );

  for (const alt of sectorETFs) {
    const price = currentPrices.get(alt.symbol);
    if (price && price <= maxPrice && !alternatives.find(a => a.symbol === alt.symbol)) {
      alternatives.push({
        symbol: alt.symbol,
        sector: alt.sector,
        industry: alt.industry,
        estimatedPrice: price,
        reason: `ETF with ${originalStock.sector} exposure`
      });
    }
  }

  // Sort by price (lower first) and limit to top 5
  return alternatives
    .sort((a, b) => a.estimatedPrice - b.estimatedPrice)
    .slice(0, 5);
}

// Get general low-price alternatives for unknown stocks
function getGeneralAlternatives(
  maxPrice: number,
  currentPrices: Map<string, number>
): { symbol: string; sector: string; industry: string; estimatedPrice: number; reason: string }[] {
  const lowPriceStocks = stockDatabase.filter(s => s.priceRange === "low");
  const alternatives: { symbol: string; sector: string; industry: string; estimatedPrice: number; reason: string }[] = [];

  for (const stock of lowPriceStocks) {
    const price = currentPrices.get(stock.symbol);
    if (price && price <= maxPrice) {
      alternatives.push({
        symbol: stock.symbol,
        sector: stock.sector,
        industry: stock.industry,
        estimatedPrice: price,
        reason: `Popular ${stock.sector} stock within your budget`
      });
    }
  }

  return alternatives.sort((a, b) => a.estimatedPrice - b.estimatedPrice).slice(0, 5);
}

// Get list of popular low-price symbols for batch price fetching
export function getLowPriceSymbols(): string[] {
  return stockDatabase
    .filter(s => s.priceRange === "low" || s.priceRange === "medium")
    .map(s => s.symbol);
}

// Calculate max affordable stock price based on account size and action
export function calculateMaxAffordablePrice(
  accountSize: number,
  action: "BUY_CALL" | "BUY_PUT" | "SELL_CALL" | "SELL_PUT",
  riskPerTrade: number = 0.02
): number {
  // For LONG options (BUY_CALL, BUY_PUT):
  // - Typical premium is 2-5% of stock price for 30 delta options
  // - Need at least 1 contract affordable
  // - Premium per contract = stockPrice * 0.03 * 100 (rough estimate)
  // - maxStockPrice = accountSize * riskPerTrade / (0.03 * 100)
  
  // For SHORT PUT (cash-secured):
  // - Need strike * 100 cash per contract
  // - maxStockPrice ≈ accountSize / 100
  
  // For SHORT CALL (covered):
  // - Need to own 100 shares OR have margin
  // - With margin (~20%), maxStockPrice ≈ accountSize / 20
  
  switch (action) {
    case "BUY_CALL":
    case "BUY_PUT":
      // Premium-based: assume 3% of stock price as typical premium
      return (accountSize * riskPerTrade) / 3; // Can afford options on stocks up to this price
    case "SELL_PUT":
      // Cash-secured: need full strike value
      return accountSize / 100;
    case "SELL_CALL":
      // Covered call with margin
      return accountSize / 20;
    default:
      return accountSize / 100;
  }
}

// Get all alternative symbols that might be needed
export function getAlternativeSymbolsForSector(sector: string): string[] {
  return stockDatabase
    .filter(s => s.sector === sector || s.sector === "ETF")
    .map(s => s.symbol);
}
