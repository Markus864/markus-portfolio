import { Tier, hasTierAccess, getTierDisplayName, TIER_HIERARCHY } from "./tier";

export type ExecutionMode = "deterministic" | "ai";
export type CommandTier = Tier | "staff" | "admin";

export interface CommandDefinition {
  name: string;
  description: string;
  requiredTier: CommandTier;
  executionMode: ExecutionMode;
  cooldownSeconds: number;
  category: string;
  aliases?: string[];
}

export interface CommandAccessResult {
  allowed: boolean;
  reason?: string;
  upgradeUrl?: string;
  requiredTier?: CommandTier;
  currentTier?: Tier;
}

export const UPGRADE_URL_PRO = process.env.UPGRADE_URL_PRO || "https://www.ironstriketrading.com/pricing";
export const UPGRADE_URL_PREMIUM = process.env.UPGRADE_URL_PREMIUM || "https://www.ironstriketrading.com/pricing";
export const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://www.ironstriketrading.com/app";

// --- COMMAND DEFINITIONS (The Security Rules) ---
const COMMANDS: Record<string, CommandDefinition> = {
  // === CORE (Free) ===
  price: { name: 'price', description: 'Get real-time quote', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 2, category: 'Core' },
  chart: { name: 'chart', description: 'Get technical chart', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Core' },
  quote: { name: 'quote', description: 'Get quote (alias)', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 2, category: 'Core' },
  help: { name: 'help', description: 'Show commands', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 2, category: 'Core' },
  start: { name: 'start', description: 'Bot start', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 2, category: 'Core' },
  connect: { name: 'connect', description: 'Link account', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 0, category: 'Core' },
  status: { name: 'status', description: 'Account status', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 2, category: 'Core' },
  health: { name: 'health', description: 'System health', requiredTier: 'admin', executionMode: 'deterministic', cooldownSeconds: 0, category: 'System' },
  faq: { name: 'faq', description: 'Common questions & troubleshooting', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 5, category: 'System' },
  ticket: { name: 'ticket', description: 'Submit support ticket', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 60, category: 'Support' },

  // === TECHNICALS (Pro) ===
  rsi: { name: 'rsi', description: 'RSI Indicator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  macd: { name: 'macd', description: 'MACD Indicator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  ema: { name: 'ema', description: 'EMA Indicator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  sma: { name: 'sma', description: 'SMA Indicator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  vwap: { name: 'vwap', description: 'VWAP Indicator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  support: { name: 'support', description: 'Support Levels', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },
  resistance: { name: 'resistance', description: 'Resistance Levels', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Technicals' },

  // === STRATEGY & RISK (Pro) ===
  signals: { name: 'signals', description: 'Premium Signals', requiredTier: 'free', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Strategy' }, // Info is free
  signal: { name: 'signal', description: 'Latest Signal', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Strategy' },
  today: { name: 'today', description: 'Daily Outlook', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Strategy' },
  weekly: { name: 'weekly', description: 'Weekly Outlook', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Strategy' },
  strategy: { name: 'strategy', description: 'Strategy Finder', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Strategy' },
  entry: { name: 'entry', description: 'Entry Calculator', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Risk' },
  stoploss: { name: 'stoploss', description: 'Stop Loss Calc', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Risk' },
  takeprofit: { name: 'takeprofit', description: 'Take Profit Calc', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Risk' },
  risk: { name: 'risk', description: 'Risk Analysis', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Risk' },
  position: { name: 'position', description: 'Position Sizing', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Risk' },
  alerts: { name: 'alerts', description: 'Manage Alerts', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Alerts' },
  alert: { name: 'alert', description: 'Set Alert', requiredTier: 'pro', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Alerts' },

  // === PREMIUM & AI (Premium) ===
  options: { name: 'options', description: 'Options Chain', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },
  chain: { name: 'chain', description: 'Full Chain', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },
  iv: { name: 'iv', description: 'Implied Volatility', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },
  greeks: { name: 'greeks', description: 'The Greeks', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },
  maxpain: { name: 'maxpain', description: 'Max Pain', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },
  openinterest: { name: 'openinterest', description: 'Open Interest', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 10, category: 'Options' },

  analyze: { name: 'analyze', description: 'AI Analysis', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  sentiment: { name: 'sentiment', description: 'AI Sentiment', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  bias: { name: 'bias', description: 'AI Bias', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  plan: { name: 'plan', description: 'AI Plan', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  explain: { name: 'explain', description: 'AI Explain', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  review: { name: 'review', description: 'AI Review', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 30, category: 'AI' },
  ask: { name: 'ask', description: 'AI Chat', requiredTier: 'premium', executionMode: 'ai', cooldownSeconds: 15, category: 'AI' },

  // === PORTFOLIO (Premium) ===
  portfolio: { name: 'portfolio', description: 'Portfolio View', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  positions: { name: 'positions', description: 'Open Positions', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  pnl: { name: 'pnl', description: 'PnL Stats', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  winrate: { name: 'winrate', description: 'Win Rate', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  journal: { name: 'journal', description: 'Journal', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  history: { name: 'history', description: 'History', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  stats: { name: 'stats', description: 'Advanced Stats', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  drawdown: { name: 'drawdown', description: 'Drawdown', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
  expectancy: { name: 'expectancy', description: 'Expectancy', requiredTier: 'premium', executionMode: 'deterministic', cooldownSeconds: 5, category: 'Portfolio' },
};

// --- LOGIC ---

function hasCommandTierAccess(userTier: Tier, requiredTier: CommandTier, isStaff: boolean = false, isAdmin: boolean = false): boolean {
  if (requiredTier === "admin") return isAdmin;
  if (requiredTier === "staff") return isStaff || isAdmin;
  return hasTierAccess(userTier, requiredTier as Tier);
}

export function getCommand(name: string): CommandDefinition | undefined {
  return COMMANDS[name.toLowerCase()];
}

export function checkCommandAccess(
  commandName: string, 
  userTier: Tier = "free", 
  isStaff: boolean = false,
  isAdmin: boolean = false
): CommandAccessResult {
  const command = getCommand(commandName);

  if (!command) {
    // If command is not in registry, default to allowed (safe fallback for basic commands)
    return { allowed: true };
  }

  if (!hasCommandTierAccess(userTier, command.requiredTier, isStaff, isAdmin)) {
    return {
      allowed: false,
      reason: "Upgrade Required",
      upgradeUrl: command.requiredTier === "premium" ? UPGRADE_URL_PREMIUM : UPGRADE_URL_PRO,
      requiredTier: command.requiredTier,
      currentTier: userTier,
    };
  }

  return { allowed: true };
}

export function formatUpgradeMessage(result: CommandAccessResult): string {
  if (result.allowed) return "";

  const tierDisplay = result.requiredTier 
    ? String(result.requiredTier).charAt(0).toUpperCase() + String(result.requiredTier).slice(1)
    : "Premium";

  return `🔒 **${tierDisplay} Feature**\n\nThis command requires **${tierDisplay}** access.\nYour current tier: **${getTierDisplayName(result.currentTier || "free")}**`;
}

// --- COOLDOWN SYSTEM ---
const cooldowns: Map<string, Map<string, number>> = new Map();

export function checkCooldown(commandName: string, userId: string): { allowed: boolean; remainingSeconds?: number } {
  const command = getCommand(commandName);
  if (!command || command.cooldownSeconds === 0) {
    return { allowed: true };
  }

  const commandCooldowns = cooldowns.get(commandName) || new Map();
  const lastUsed = commandCooldowns.get(userId);
  const now = Date.now();

  if (lastUsed) {
    const elapsed = (now - lastUsed) / 1000;
    if (elapsed < command.cooldownSeconds) {
      return { allowed: false, remainingSeconds: Math.ceil(command.cooldownSeconds - elapsed) };
    }
  }

  commandCooldowns.set(userId, now);
  cooldowns.set(commandName, commandCooldowns);

  return { allowed: true };
}

export function formatCooldownMessage(seconds: number): string {
  return `⏳ **Cooldown**\n\nPlease wait ${seconds} seconds before using this command again.`;
}