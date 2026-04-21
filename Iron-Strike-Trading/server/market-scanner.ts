import { getQuote, type MarketQuote } from "./market-data-service";

export interface ScannerConfig {
  watchlist: string[];
  scanIntervalMs: number;
  alertThresholds: {
    strongMomentumPercent: number;
    sellingPressurePercent: number;
    quietRangePercent: number;
  };
  webhookUrl?: string;
  enabled: boolean;
}

export interface ScannerAlert {
  type: 'momentum' | 'selling_pressure' | 'watchlist_update';
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  message: string;
  timestamp: Date;
}

const DEFAULT_WATCHLIST = ['IWM', 'SPY', 'QQQ', 'NVDA', 'TSLA', 'AMD', 'AAPL', 'MSFT'];

const DEFAULT_CONFIG: ScannerConfig = {
  watchlist: DEFAULT_WATCHLIST,
  scanIntervalMs: 60000,
  alertThresholds: {
    strongMomentumPercent: 1.5,
    sellingPressurePercent: -1.5,
    quietRangePercent: 0.5,
  },
  webhookUrl: process.env.DISCORD_SCANNER_WEBHOOK,
  enabled: false,
};

let config: ScannerConfig = { ...DEFAULT_CONFIG };
let scannerInterval: NodeJS.Timeout | null = null;
let lastAlerts: Map<string, number> = new Map();
const ALERT_COOLDOWN_MS = 300000;

function analyzeMarketConditions(quote: MarketQuote): ScannerAlert | null {
  const { symbol, price, changePercent, volume } = quote;
  const { strongMomentumPercent, sellingPressurePercent, quietRangePercent } = config.alertThresholds;

  if (changePercent >= strongMomentumPercent) {
    return {
      type: 'momentum',
      symbol,
      price,
      changePercent,
      volume,
      message: `🚀 **ACTION ALERT: ${symbol}** is ripping (+${changePercent.toFixed(2)}%).\n` +
               `> *Coach's Note:* Momentum is high. Watch for a pullback to VWAP before entering calls. Don't chase.`,
      timestamp: new Date(),
    };
  }

  if (changePercent <= sellingPressurePercent) {
    return {
      type: 'selling_pressure',
      symbol,
      price,
      changePercent,
      volume,
      message: `⚠️ **DANGER ZONE: ${symbol}** is dumping (${changePercent.toFixed(2)}%).\n` +
               `> *Coach's Note:* Heavy selling pressure. Look for puts if it breaks the previous low.`,
      timestamp: new Date(),
    };
  }

  if (Math.abs(changePercent) <= quietRangePercent) {
    return null;
  }

  return null;
}

async function sendDiscordAlert(alert: ScannerAlert): Promise<boolean> {
  if (!config.webhookUrl) {
    console.log(`[Market Scanner] No webhook configured, alert logged only:`, alert.message);
    return false;
  }

  const payload = {
    content: alert.message,
    username: "Iron Strike Coach",
    embeds: [{
      color: alert.type === 'momentum' ? 0x22c55e : 0xef4444,
      fields: [
        { name: 'Symbol', value: alert.symbol, inline: true },
        { name: 'Price', value: `$${alert.price.toFixed(2)}`, inline: true },
        { name: 'Change', value: `${alert.changePercent >= 0 ? '+' : ''}${alert.changePercent.toFixed(2)}%`, inline: true },
        { name: 'Volume', value: alert.volume.toLocaleString(), inline: true },
      ],
      footer: { text: 'Iron Strike Market Scanner' },
      timestamp: alert.timestamp.toISOString(),
    }],
  };

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.status === 204 || response.ok) {
      console.log(`[Market Scanner] Alert sent for ${alert.symbol}`);
      return true;
    } else {
      console.error(`[Market Scanner] Webhook failed: ${response.status}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[Market Scanner] Webhook error:`, error.message);
    return false;
  }
}

function shouldSendAlert(symbol: string): boolean {
  const lastAlertTime = lastAlerts.get(symbol);
  if (!lastAlertTime) return true;
  return Date.now() - lastAlertTime >= ALERT_COOLDOWN_MS;
}

async function scanMarket(): Promise<void> {
  console.log(`[Market Scanner] Scanning ${config.watchlist.length} symbols...`);

  for (const symbol of config.watchlist) {
    try {
      const quote = await getQuote(symbol);
      const alert = analyzeMarketConditions(quote);

      if (alert && shouldSendAlert(symbol)) {
        const sent = await sendDiscordAlert(alert);
        if (sent) {
          lastAlerts.set(symbol, Date.now());
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(`[Market Scanner] Error fetching ${symbol}:`, error.message);
    }
  }
}

export function startScanner(): boolean {
  if (scannerInterval) {
    console.log('[Market Scanner] Already running, restarting with current config...');
    stopScanner();
  }

  config.enabled = true;
  console.log(`[Market Scanner] Starting with ${config.watchlist.length} symbols, interval: ${config.scanIntervalMs}ms`);
  
  scanMarket();
  scannerInterval = setInterval(scanMarket, config.scanIntervalMs);
  return true;
}

export function stopScanner(): void {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
  }
  config.enabled = false;
  console.log('[Market Scanner] Stopped');
}

export function getScannerStatus(): {
  enabled: boolean;
  watchlist: string[];
  scanIntervalMs: number;
  lastAlerts: { symbol: string; timestamp: number }[];
} {
  return {
    enabled: config.enabled,
    watchlist: config.watchlist,
    scanIntervalMs: config.scanIntervalMs,
    lastAlerts: Array.from(lastAlerts.entries()).map(([symbol, timestamp]) => ({
      symbol,
      timestamp,
    })),
  };
}

export function updateScannerConfig(updates: Partial<ScannerConfig>): void {
  const wasEnabled = config.enabled;

  if (updates.watchlist) config.watchlist = updates.watchlist;
  if (updates.scanIntervalMs) config.scanIntervalMs = updates.scanIntervalMs;
  if (updates.alertThresholds) config.alertThresholds = { ...config.alertThresholds, ...updates.alertThresholds };
  if (updates.webhookUrl !== undefined) config.webhookUrl = updates.webhookUrl;

  if (wasEnabled && updates.scanIntervalMs) {
    stopScanner();
    startScanner();
  }

  console.log('[Market Scanner] Config updated');
}

export function setWatchlist(symbols: string[]): void {
  config.watchlist = symbols.map(s => s.toUpperCase());
  console.log(`[Market Scanner] Watchlist updated: ${config.watchlist.join(', ')}`);
}

export function addToWatchlist(symbol: string): void {
  const upperSymbol = symbol.toUpperCase();
  if (!config.watchlist.includes(upperSymbol)) {
    config.watchlist.push(upperSymbol);
    console.log(`[Market Scanner] Added ${upperSymbol} to watchlist`);
  }
}

export function removeFromWatchlist(symbol: string): void {
  const upperSymbol = symbol.toUpperCase();
  config.watchlist = config.watchlist.filter(s => s !== upperSymbol);
  console.log(`[Market Scanner] Removed ${upperSymbol} from watchlist`);
}

export async function triggerManualScan(): Promise<ScannerAlert[]> {
  const alerts: ScannerAlert[] = [];

  for (const symbol of config.watchlist) {
    try {
      const quote = await getQuote(symbol);
      const alert = analyzeMarketConditions(quote);
      if (alert) {
        alerts.push(alert);
      }
    } catch (error: any) {
      console.error(`[Market Scanner] Manual scan error for ${symbol}:`, error.message);
    }
  }

  return alerts;
}

export function getScannerConfig(): ScannerConfig {
  return { ...config };
}
