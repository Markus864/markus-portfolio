const FRONTEND_BASE_URL = normalizeFrontendUrl();

function normalizeFrontendUrl(): string {
  let url = process.env.FRONTEND_BASE_URL || 'https://www.ironstriketrading.com';
  const lowerUrl = url.toLowerCase();
  
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
    url = 'https://' + url.replace(/^(www\.)/i, 'www.');
  }
  
  url = url.replace(/\/$/, '');
  
  try {
    new URL(url);
  } catch {
    console.error('[Links] Invalid FRONTEND_BASE_URL:', process.env.FRONTEND_BASE_URL, '- falling back to default');
    return 'https://www.ironstriketrading.com';
  }
  
  return url;
}

export function chartUrl(symbol: string): string {
  return `${FRONTEND_BASE_URL}/app/chart?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function newsUrl(symbol?: string): string {
  if (symbol) {
    return `${FRONTEND_BASE_URL}/app/news?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
  }
  return `${FRONTEND_BASE_URL}/app/news`;
}

export function optionsChainUrl(symbol: string): string {
  return `${FRONTEND_BASE_URL}/app/options?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function filingsUrl(symbol: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(symbol.toUpperCase())}&type=&dateb=&owner=include&count=40`;
}

export function signalUrl(signalId: number): string {
  return `${FRONTEND_BASE_URL}/app/live?id=${signalId}`;
}

export function alertsUrl(): string {
  return `${FRONTEND_BASE_URL}/app/alerts`;
}

export function watchlistUrl(): string {
  return `${FRONTEND_BASE_URL}/app/watchlist`;
}

export function portfolioUrl(): string {
  return `${FRONTEND_BASE_URL}/app/portfolio`;
}

export function settingsUrl(): string {
  return `${FRONTEND_BASE_URL}/app/settings`;
}

export function pricingUrl(): string {
  return `${FRONTEND_BASE_URL}/pricing`;
}

export function dashboardUrl(): string {
  return `${FRONTEND_BASE_URL}/app`;
}

export function tradingViewChartUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function yahooFinanceUrl(symbol: string): string {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol.toUpperCase())}`;
}

export function finvizUrl(symbol: string): string {
  return `https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol.toUpperCase())}`;
}

export function barchartOptionsUrl(symbol: string): string {
  return `https://www.barchart.com/stocks/quotes/${encodeURIComponent(symbol.toUpperCase())}/options`;
}

export { FRONTEND_BASE_URL };
