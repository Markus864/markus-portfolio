/**
 * Shared Command Handlers Module
 * Provides reusable command implementations for Discord and Telegram bots
 * Each handler returns structured data that can be formatted per platform
 */

import { getPolygonQuote } from './polygon-quotes';
import { getQuote as getTradierQuote, getOptionsExpirations, getOptionsChain, type OptionsChain, type OptionsContract } from './tradier-service';
import { calculateTechnicalIndicators, type TechnicalIndicators } from './technical-indicators';
import type { SelectTradeJournalEntry } from '@shared/schema';
import { storage } from './storage';
import { getMarketNews, type MarketNewsItem } from './market-data-service';
import OpenAI from 'openai';
import { wrapAIResponse, getSystemPromptRules, STANDARD_DISCLAIMER } from './ai-guardrails';
import type { SelectSignalHistory, SelectTradeExecution } from '@shared/schema';
import * as links from './links';
import { SUPPORT_PORTAL_URL, isSupportIssue, generateSupportGuidance, getTicketCreationErrorMessage } from '@shared/support-utils';

const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://www.ironstriketrading.com';

let openai: OpenAI | null = null;

// Helper to get technical indicators (wraps calculateTechnicalIndicators)
async function getTechnicalIndicators(symbol: string): Promise<TechnicalIndicators | null> {
  try {
    return await calculateTechnicalIndicators(symbol);
  } catch {
    return null;
  }
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!openai && apiKey) {
    openai = new OpenAI({ 
      apiKey,
      baseURL: baseURL || undefined 
    });
  }
  return openai;
}

export interface CommandResult {
  success: boolean;
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  error?: string;
  links?: { label: string; url: string }[];
  color?: 'success' | 'error' | 'warning' | 'info' | 'brand';
}

// ============ FREE TIER: Market Data Commands ============

export async function handleQuoteCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /quote AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const quote = await getTradierQuote(upperSymbol);

    if (!quote) {
      return { 
        success: false, 
        title: 'Quote Unavailable', 
        error: `Could not fetch quote for ${upperSymbol}. This could be an invalid symbol or the market data service is temporarily unavailable.`, 
        color: 'warning',
        links: [
          { label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` }
        ]
      };
    }

    const isPositive = quote.changePercent >= 0;
    const sign = isPositive ? '+' : '';

    return {
      success: true,
      title: `${isPositive ? '📈' : '📉'} ${upperSymbol} - $${quote.price.toFixed(2)}`,
      description: `**${sign}${quote.changePercent.toFixed(2)}%** (${sign}$${quote.change.toFixed(2)})`,
      color: isPositive ? 'success' : 'error',
      fields: [
        { name: '🔓 Open', value: `$${quote.open.toFixed(2)}`, inline: true },
        { name: '📊 High', value: `$${quote.high?.toFixed(2) || 'N/A'}`, inline: true },
        { name: '📉 Low', value: `$${quote.low?.toFixed(2) || 'N/A'}`, inline: true },
        { name: '📦 Volume', value: quote.volume?.toLocaleString() || 'N/A', inline: true },
        { name: '💰 Prev Close', value: `$${quote.prevClose?.toFixed(2) || 'N/A'}`, inline: true },
      ],
      links: [
        { label: '🎯 Generate Signal', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` },
        { label: '📊 View Chart', url: `${FRONTEND_BASE_URL}/app/chart?symbol=${upperSymbol}` }
      ]
    };
  } catch (error) {
    console.error(`[Quote Command] Error fetching quote for ${upperSymbol}:`, error);
    return {
      success: false,
      title: 'Service Temporarily Unavailable',
      error: `Market data service is currently unavailable. Please try again in a moment.`,
      color: 'error',
      links: [
        { label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` }
      ]
    };
  }
}

export async function handleChartCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /chart AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const quote = await getTradierQuote(upperSymbol);

    if (!quote) {
      // Still show chart link even if quote fails
      return {
        success: true,
        title: `📊 ${upperSymbol} Chart`,
        description: `View the interactive chart for ${upperSymbol} on Iron Strike`,
        color: 'brand',
        fields: [
          { name: 'Status', value: 'Quote data temporarily unavailable', inline: true },
        ],
        links: [
          { label: '📈 Open Chart', url: `${FRONTEND_BASE_URL}/app/chart?symbol=${upperSymbol}` }
        ]
      };
    }

    return {
      success: true,
      title: `📊 ${upperSymbol} Chart`,
      description: `View the interactive chart for ${upperSymbol} on Iron Strike`,
      color: 'brand',
      fields: [
        { name: 'Current Price', value: `$${quote.price.toFixed(2)}`, inline: true },
        { name: 'Change', value: `${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%`, inline: true },
      ],
      links: [
        { label: '📈 Open Chart', url: `${FRONTEND_BASE_URL}/app/chart?symbol=${upperSymbol}` }
      ]
    };
  } catch (error) {
    console.error(`[Chart Command] Error fetching data for ${upperSymbol}:`, error);
    // Gracefully fall back - still provide the chart link
    return {
      success: true,
      title: `📊 ${upperSymbol} Chart`,
      description: `View the interactive chart for ${upperSymbol} on Iron Strike`,
      color: 'brand',
      links: [
        { label: '📈 Open Chart', url: `${FRONTEND_BASE_URL}/app/chart?symbol=${upperSymbol}` }
      ]
    };
  }
}

// ============ FREE TIER: Technical Indicators ============

export async function handleRSICommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /rsi AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const rsi = indicators.rsi14;
    
    let interpretation = 'Neutral';
    let color: CommandResult['color'] = 'info';
    if (rsi >= 70) {
      interpretation = '⚠️ Overbought - potential reversal down';
      color = 'warning';
    } else if (rsi <= 30) {
      interpretation = '💡 Oversold - potential reversal up';
      color = 'success';
    } else if (rsi >= 50) {
      interpretation = '📈 Bullish momentum';
      color = 'success';
    } else {
      interpretation = '📉 Bearish momentum';
      color = 'error';
    }

    return {
      success: true,
      title: `📊 RSI(14) for ${upperSymbol}`,
      color,
      fields: [
        { name: 'RSI Value', value: rsi.toFixed(2), inline: true },
        { name: 'Interpretation', value: interpretation, inline: true },
        { name: 'Current Price', value: `$${indicators.currentPrice.toFixed(2)}`, inline: true },
      ],
    };
  } catch (e) {
    console.error(`[RSI Command] Error calculating RSI for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate RSI for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [
        { label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }
      ]
    };
  }
}

export async function handleMACDCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /macd AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const macd = indicators.macd;
    
    let signal = 'Neutral';
    let color: CommandResult['color'] = 'info';
    if (macd.histogram > 0 && macd.macdLine > macd.signalLine) {
      signal = '📈 Bullish - MACD above signal line';
      color = 'success';
    } else if (macd.histogram < 0 && macd.macdLine < macd.signalLine) {
      signal = '📉 Bearish - MACD below signal line';
      color = 'error';
    }

    return {
      success: true,
      title: `📊 MACD for ${upperSymbol}`,
      color,
      fields: [
        { name: 'MACD Line', value: macd.macdLine.toFixed(4), inline: true },
        { name: 'Signal Line', value: macd.signalLine.toFixed(4), inline: true },
        { name: 'Histogram', value: macd.histogram.toFixed(4), inline: true },
        { name: 'Signal', value: signal, inline: false },
      ],
    };
  } catch (e) {
    console.error(`[MACD Command] Error calculating MACD for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate MACD for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [
        { label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }
      ]
    };
  }
}

export async function handleEMACommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /ema AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    
    const ma = indicators.movingAverages;
    let trend = 'Mixed';
    let color: CommandResult['color'] = 'info';
    if (price > ma.ema9 && price > ma.ema21 && ma.ema9 > ma.ema21) {
      trend = '📈 Strong Uptrend - Price above EMAs, EMA9 > EMA21';
      color = 'success';
    } else if (price < ma.ema9 && price < ma.ema21 && ma.ema9 < ma.ema21) {
      trend = '📉 Strong Downtrend - Price below EMAs, EMA9 < EMA21';
      color = 'error';
    }

    return {
      success: true,
      title: `📊 EMA for ${upperSymbol}`,
      color,
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'EMA(9)', value: `$${ma.ema9.toFixed(2)}`, inline: true },
        { name: 'EMA(21)', value: `$${ma.ema21.toFixed(2)}`, inline: true },
        { name: 'Trend', value: trend, inline: false },
      ],
    };
  } catch (e) {
    console.error(`[EMA Command] Error calculating EMA for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate EMA for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [
        { label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }
      ]
    };
  }
}

export async function handleSMACommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /sma AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    
    const ma = indicators.movingAverages;
    return {
      success: true,
      title: `📊 SMA for ${upperSymbol}`,
      color: 'brand',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'SMA(20)', value: `$${ma.sma20.toFixed(2)}`, inline: true },
        { name: 'SMA(50)', value: `$${ma.sma50.toFixed(2)}`, inline: true },
        { name: 'SMA(200)', value: `$${ma.sma200.toFixed(2)}`, inline: true },
        { name: 'Position', value: price > ma.sma200 ? '📈 Above 200 SMA (Bullish)' : '📉 Below 200 SMA (Bearish)', inline: false },
      ],
    };
  } catch (e) {
    console.error(`[SMA Command] Error calculating SMA for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate SMA for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleSupportCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /support AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    const distanceToSupport = ((price - indicators.support) / price * 100).toFixed(2);

    return {
      success: true,
      title: `📉 Support Level for ${upperSymbol}`,
      color: 'brand',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'Support Level', value: `$${indicators.support.toFixed(2)}`, inline: true },
        { name: 'Distance', value: `${distanceToSupport}% above support`, inline: true },
      ],
    };
  } catch (e) {
    console.error(`[Support Command] Error calculating support for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate support levels for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleResistanceCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /resistance AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    const distanceToResistance = ((indicators.resistance - price) / price * 100).toFixed(2);

    return {
      success: true,
      title: `📈 Resistance Level for ${upperSymbol}`,
      color: 'brand',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'Resistance Level', value: `$${indicators.resistance.toFixed(2)}`, inline: true },
        { name: 'Distance', value: `${distanceToResistance}% to resistance`, inline: true },
      ],
    };
  } catch (e) {
    console.error(`[Resistance Command] Error calculating resistance for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Technical Data Unavailable', 
      error: `Could not calculate resistance levels for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }]
    };
  }
}

// ============ FREE TIER: Education Commands ============

export function handleHelpCommand(): CommandResult {
  return {
    success: true,
    title: '⚡ Iron Strike Command Center',
    color: 'info',
    description: 'Complete list of 50+ commands available across Discord and Telegram.',
    fields: [
      {
        name: '🔍 Market Data (Free/Pro)',
        value: '`/price` `/chart` `/earnings` `/dividends` `/float` `/shortinterest`',
        inline: false
      },
      {
        name: '🤖 AI & Analysis (Premium)',
        value: '`/analyze` `/ask` `/sentiment` `/bias` `/plan` `/explain` `/review`',
        inline: false
      },
      {
        name: '⛓️ Options (Premium)',
        value: '`/options` `/chain` `/iv` `/greeks` `/maxpain` `/openinterest`',
        inline: false
      },
      {
        name: '📈 Technicals (Pro)',
        value: '`/rsi` `/macd` `/ema` `/sma` `/vwap` `/support` `/resistance`',
        inline: false
      },
      {
        name: '🛡️ Risk & Strategy (Pro)',
        value: '`/entry` `/stoploss` `/takeprofit` `/risk` `/position` `/strategy`',
        inline: false
      },
      {
        name: '📡 Signals (Pro)',
        value: '`/signals` `/signal` `/today` `/weekly`',
        inline: false
      },
      {
        name: '💼 Portfolio (Premium)',
        value: '`/portfolio` `/positions` `/pnl` `/winrate` `/journal` `/history` `/stats` `/drawdown` `/expectancy`',
        inline: false
      },
      {
        name: '⚙️ Account',
        value: '`/status` `/connect` `/alerts` `/alert` `/faq` `/help`',
        inline: false
      }
    ],
    links: [
      { label: '📜 Full Command List', url: `${FRONTEND_BASE_URL}/commands` },
      { label: 'Upgrade to Premium', url: `${FRONTEND_BASE_URL}/pricing` }
    ]
  };
}

export function handleRulesCommand(): CommandResult {
  return {
    success: true,
    title: '📜 Community Rules',
    color: 'brand',
    fields: [
      { name: '1. No Financial Advice', value: 'All signals are educational. Do your own research.', inline: false },
      { name: '2. Be Respectful', value: 'Treat all members with respect. No harassment.', inline: false },
      { name: '3. No Spam', value: 'No promotional content or repetitive messages.', inline: false },
      { name: '4. Manage Risk', value: 'Never risk more than you can afford to lose.', inline: false },
      { name: '5. Report Issues', value: 'Report bugs or concerns to the admin team.', inline: false },
    ],
  };
}

export function handleFAQCommand(): CommandResult {
  return {
    success: true,
    title: '❓ Iron Strike FAQ',
    color: 'info',
    description: 'Common questions and troubleshooting:',
    fields: [
      {
        name: '🔗 Links not opening in Telegram?',
        value: 'Telegram\'s built-in browser can be buggy. \n**Fix:** Go to Telegram Settings > Chat Settings > Enable "Open Links Externally" OR Long-press the link, copy it, and paste it into Chrome/Safari.',
        inline: false
      },
      {
        name: '🤖 Why is the bot silent?',
        value: 'If on AWS, the bot may be in Webhook mode. We have forced Polling mode in the latest update. Try `/start` again.',
        inline: false
      },
      {
        name: '🔒 Why are commands locked?',
        value: 'Some commands require a **Pro** or **Premium** subscription. Use `/connect` to link your account.',
        inline: false
      },
      {
        name: 'What is Iron Strike?',
        value: 'An AI-powered options trading signal generator with technical analysis.',
        inline: false
      },
      {
        name: 'Are signals guaranteed?',
        value: 'No. All trading involves risk. Signals are educational tools only.',
        inline: false
      }
    ],
    links: [
      { label: 'View Documentation', url: `${FRONTEND_BASE_URL}/commands` },
      { label: 'Contact Support', url: 'mailto:support@ironstriketrading.com' }
    ]
  };
}

export async function handleTicketCommand(
  subject: string,
  message: string,
  email: string,
  channel: 'telegram' | 'discord',
  userId?: string
): Promise<CommandResult> {
  try {
    // Check Freshdesk configuration first
    const { freshdeskService } = await import("./freshdesk-service");
    const status = freshdeskService.getStatus();
    if (!status.configured) {
      return {
        success: false,
        title: '❌ Support System Unavailable',
        description: 'The support ticket system is not currently configured. Please contact us directly.',
        color: 'error',
        links: [
          { label: 'Email Support', url: 'mailto:support@ironstriketrading.com' }
        ]
      };
    }

    if (!subject || !message) {
      return {
        success: false,
        title: '❌ Missing Information',
        description: 'Please provide both a subject and message for your ticket.',
        color: 'error',
        fields: [
          { name: 'Usage', value: `/ticket <subject> | <message>`, inline: false },
          { name: 'Example', value: `/ticket Login issue | I can't access my account after resetting my password`, inline: false }
        ]
      };
    }

    if (!email || !email.includes('@')) {
      return {
        success: false,
        title: '❌ Email Required',
        description: 'Please link your account first using /connect to submit tickets, or provide a valid email.',
        color: 'warning',
        links: [
          { label: 'Connect Account', url: `${FRONTEND_BASE_URL}/app/settings` }
        ]
      };
    }
    const ticket = await freshdeskService.createTicket({
      email,
      subject,
      description: message,
      priority: 'normal',
      channel,
      userId,
    });

    return {
      success: true,
      title: '✅ Ticket Submitted',
      description: `Your support ticket has been created. We'll respond within 24-48 hours.`,
      color: 'success',
      fields: [
        { name: 'Ticket Number', value: ticket.ticketNumber, inline: true },
        { name: 'Subject', value: subject, inline: true },
        { name: 'Status', value: 'Open', inline: true },
      ],
      links: [
        { label: 'View Support Portal', url: SUPPORT_PORTAL_URL }
      ]
    };
  } catch (error) {
    console.error('[Ticket Command] Error:', error);
    return {
      success: false,
      title: '❌ Ticket Creation Failed',
      description: 'Unable to create your support ticket. Please try again or contact support directly.',
      color: 'error',
      links: [
        { label: 'Email Support', url: 'mailto:support@ironstriketrading.com' }
      ]
    };
  }
}

const glossaryTerms: Record<string, string> = {
  'rsi': 'Relative Strength Index - momentum oscillator (0-100)',
  'macd': 'Moving Average Convergence Divergence - trend indicator',
  'ema': 'Exponential Moving Average - weighted average',
  'sma': 'Simple Moving Average - arithmetic mean',
  'iv': 'Implied Volatility - expected price movement',
  'greeks': 'Delta, Gamma, Theta, Vega - option sensitivities',
  'delta': 'Rate of change in option price per $1 move in underlying',
  'gamma': 'Rate of change in delta per $1 move in underlying',
  'theta': 'Time decay - how much option loses value per day',
  'vega': 'Sensitivity to changes in implied volatility',
  'support': 'Price level where buying pressure increases',
  'resistance': 'Price level where selling pressure increases',
  'atr': 'Average True Range - volatility indicator',
  'vwap': 'Volume Weighted Average Price',
  'bollinger': 'Bollinger Bands - volatility-based channels',
};

export function handleGlossaryCommand(term?: string): CommandResult {
  if (term) {
    const lowerTerm = term.toLowerCase();
    const definition = glossaryTerms[lowerTerm];
    
    if (definition) {
      return {
        success: true,
        title: `📚 ${term.toUpperCase()}`,
        description: definition,
        color: 'brand',
        links: [{ label: '📖 Full Glossary', url: `${FRONTEND_BASE_URL}/methodology` }]
      };
    }
    
    return {
      success: false,
      title: '📚 Term Not Found',
      description: `No definition found for "${term}". Try /glossary for all terms.`,
      color: 'warning',
    };
  }

  return {
    success: true,
    title: '📚 Trading Glossary',
    color: 'brand',
    fields: [
      { name: 'RSI', value: 'Relative Strength Index - momentum oscillator (0-100)', inline: true },
      { name: 'MACD', value: 'Moving Average Convergence Divergence - trend indicator', inline: true },
      { name: 'EMA', value: 'Exponential Moving Average - weighted average', inline: true },
      { name: 'SMA', value: 'Simple Moving Average - arithmetic mean', inline: true },
      { name: 'IV', value: 'Implied Volatility - expected price movement', inline: true },
      { name: 'Greeks', value: 'Delta, Gamma, Theta, Vega - option sensitivities', inline: true },
      { name: 'Support', value: 'Price level where buying pressure increases', inline: true },
      { name: 'Resistance', value: 'Price level where selling pressure increases', inline: true },
    ],
    links: [
      { label: '📖 Full Glossary', url: `${FRONTEND_BASE_URL}/methodology` }
    ]
  };
}

export function handleLearnCommand(): CommandResult {
  return {
    success: true,
    title: '🎓 Learning Resources',
    description: 'Start your options trading education journey',
    color: 'brand',
    fields: [
      { name: '📊 Technical Analysis', value: 'Learn RSI, MACD, moving averages, and chart patterns', inline: false },
      { name: '📈 Options Basics', value: 'Understand calls, puts, strikes, and expiration', inline: false },
      { name: '⚖️ Risk Management', value: 'Position sizing, stop losses, and portfolio management', inline: false },
    ],
    links: [
      { label: '📖 How It Works', url: `${FRONTEND_BASE_URL}/how-it-works` },
      { label: '📐 Methodology', url: `${FRONTEND_BASE_URL}/methodology` }
    ]
  };
}

export function handleBeginnerCommand(): CommandResult {
  return {
    success: true,
    title: '🌱 Beginner\'s Guide',
    description: 'Welcome to options trading! Here\'s how to get started.',
    color: 'brand',
    fields: [
      { name: 'Step 1: Learn the Basics', value: 'Understand what options are and how they work', inline: false },
      { name: 'Step 2: Paper Trade', value: 'Practice with a simulator before using real money', inline: false },
      { name: 'Step 3: Start Small', value: 'Begin with small positions as you learn', inline: false },
      { name: 'Step 4: Use Signals as Education', value: 'Learn from AI signals but always do your own research', inline: false },
    ],
    links: [
      { label: '🚀 Get Started', url: `${FRONTEND_BASE_URL}/app/dashboard` }
    ]
  };
}

// ============ FREE TIER: Account Commands ============

export function handleConnectCommand(platform: 'discord' | 'telegram', platformId: string | number): CommandResult {
  const connectUrl = platform === 'discord'
    ? `${FRONTEND_BASE_URL}/app/settings?discord_id=${platformId}`
    : `${FRONTEND_BASE_URL}/app/settings?telegram_chat_id=${platformId}`;

  return {
    success: true,
    title: '🔗 Connect Your Account',
    description: 'Link your account to unlock personalized features',
    color: 'brand',
    fields: [
      { name: 'Step 1', value: 'Click the link below', inline: false },
      { name: 'Step 2', value: 'Sign in to Iron Strike', inline: false },
      { name: 'Step 3', value: 'Your account will be linked automatically', inline: false },
      { name: `Your ${platform === 'discord' ? 'Discord' : 'Telegram'} ID`, value: `\`${platformId}\``, inline: false },
    ],
    links: [
      { label: '🔗 Connect Now', url: connectUrl }
    ]
  };
}

export async function handleStatusCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: true,
      title: '📊 Account Status',
      description: 'You are not linked to an Iron Strike account',
      color: 'warning',
      fields: [
        { name: 'Current Tier', value: 'Free (Unlinked)', inline: true },
      ],
      links: [
        { label: '🔗 Connect Account', url: `${FRONTEND_BASE_URL}/app/settings` }
      ]
    };
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return {
      success: false,
      title: 'User Not Found',
      error: 'Could not find your account',
      color: 'error'
    };
  }

  const tier = user.role || 'free';
  const alertCount = await storage.getUserAlertCount(userId);
  const alertLimit = tier === 'premium' ? 50 : tier === 'pro' ? 20 : 5;

  return {
    success: true,
    title: '📊 Account Status',
    color: 'brand',
    fields: [
      { name: 'Username', value: user.firstName || user.email || 'N/A', inline: true },
      { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1), inline: true },
      { name: 'Active Alerts', value: `${alertCount}/${alertLimit}`, inline: true },
    ],
    links: [
      { label: '⚙️ Settings', url: `${FRONTEND_BASE_URL}/app/settings` },
      { label: '⬆️ Upgrade', url: `${FRONTEND_BASE_URL}/pricing` }
    ]
  };
}

// ============ PRO TIER: Signals Commands ============

export async function handleSignalsCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: 'Account Required',
      error: 'Please link your account to view signals',
      color: 'warning',
      links: [{ label: '🔗 Connect', url: `${FRONTEND_BASE_URL}/app/settings` }]
    };
  }

  // Get signals for popular symbols
  const symbols = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'QQQ'];
  const allSignals: SelectSignalHistory[] = [];
  
  for (const sym of symbols) {
    const symSignals = await storage.getSignalHistoryBySymbol(sym);
    allSignals.push(...symSignals);
  }
  
  // Sort by generatedAt descending and take top 5
  const signals = allSignals
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, 5);

  if (signals.length === 0) {
    return {
      success: true,
      title: '📡 Recent Signals',
      description: 'No signals available. Generate new signals on the dashboard.',
      color: 'info',
      links: [{ label: '🎯 Generate Signal', url: `${FRONTEND_BASE_URL}/app/dashboard` }]
    };
  }

  const fields = signals.map((s: SelectSignalHistory) => ({
    name: `${s.action} ${s.symbol}`,
    value: `Strike: $${s.strikePrice} | Exp: ${s.expirationDate} | Conf: ${(Number(s.confidence) * 100).toFixed(0)}%`,
    inline: false
  }));

  return {
    success: true,
    title: '📡 Recent Signals',
    description: `Showing ${signals.length} most recent signals`,
    color: 'brand',
    fields,
    links: [
      { label: '📊 View All', url: `${FRONTEND_BASE_URL}/app/live` },
      { label: '🎯 Generate New', url: `${FRONTEND_BASE_URL}/app/dashboard` }
    ]
  };
}

export async function handleTodayCommand(): Promise<CommandResult> {
  // Get signals for popular symbols from today
  const symbols = ['SPY', 'AAPL', 'TSLA', 'NVDA', 'QQQ', 'AMZN', 'MSFT', 'META'];
  const allSignals: SelectSignalHistory[] = [];
  
  for (const sym of symbols) {
    const symSignals = await storage.getSignalHistoryBySymbol(sym);
    allSignals.push(...symSignals);
  }
  
  const today = new Date().toDateString();
  const todaySignals = allSignals.filter((s: SelectSignalHistory) => new Date(s.generatedAt).toDateString() === today);

  if (todaySignals.length === 0) {
    return {
      success: true,
      title: '📅 Today\'s Signals',
      description: 'No signals generated today yet',
      color: 'info',
      links: [{ label: '🎯 Generate Signal', url: `${FRONTEND_BASE_URL}/app/dashboard` }]
    };
  }

  const summary = {
    calls: todaySignals.filter((s: SelectSignalHistory) => s.action.includes('CALL')).length,
    puts: todaySignals.filter((s: SelectSignalHistory) => s.action.includes('PUT')).length,
    avgConfidence: Math.round(todaySignals.reduce((a: number, b: SelectSignalHistory) => a + Number(b.confidence) * 100, 0) / todaySignals.length)
  };

  return {
    success: true,
    title: '📅 Today\'s Signals',
    color: 'brand',
    fields: [
      { name: 'Total Signals', value: todaySignals.length.toString(), inline: true },
      { name: 'Calls', value: summary.calls.toString(), inline: true },
      { name: 'Puts', value: summary.puts.toString(), inline: true },
      { name: 'Avg Confidence', value: `${summary.avgConfidence}%`, inline: true },
    ],
    links: [{ label: '📊 View All', url: `${FRONTEND_BASE_URL}/app/live` }]
  };
}

// ============ PRO TIER: Alert Commands ============

export async function handleAlertsListCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: 'Account Required',
      error: 'Please link your account to view alerts',
      color: 'warning'
    };
  }

  const alerts = await storage.getUserAlerts(userId);
  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE');

  if (activeAlerts.length === 0) {
    return {
      success: true,
      title: '🔔 Your Alerts',
      description: 'You have no active alerts',
      color: 'info',
      links: [{ label: '➕ Create Alert', url: `${FRONTEND_BASE_URL}/app/alerts` }]
    };
  }

  const fields = activeAlerts.slice(0, 10).map(a => ({
    name: a.name || `${a.symbol} Alert`,
    value: `${a.symbol} ${a.condition} $${a.targetPrice}`,
    inline: true
  }));

  return {
    success: true,
    title: '🔔 Your Alerts',
    description: `${activeAlerts.length} active alert(s)`,
    color: 'brand',
    fields,
    links: [{ label: '⚙️ Manage Alerts', url: `${FRONTEND_BASE_URL}/app/alerts` }]
  };
}

// ============ PRO TIER: Risk Management Commands ============

export async function handleEntryCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /entry AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    
    const conservativeEntry = indicators.support + (price - indicators.support) * 0.3;
    const aggressiveEntry = price * 0.995;

    return {
      success: true,
      title: `🎯 Entry Points for ${upperSymbol}`,
      color: 'brand',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'Support', value: `$${indicators.support.toFixed(2)}`, inline: true },
        { name: 'Resistance', value: `$${indicators.resistance.toFixed(2)}`, inline: true },
        { name: '📉 Conservative Entry', value: `$${conservativeEntry.toFixed(2)} (near support)`, inline: false },
        { name: '📈 Aggressive Entry', value: `$${aggressiveEntry.toFixed(2)} (at market)`, inline: false },
      ],
    };
  } catch (e) {
    console.error(`[Entry Command] Error calculating entry for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Analysis Unavailable', 
      error: `Could not calculate entry points for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/generator?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleStoplossCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /stoploss AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    const atr = indicators.atr14;
    
    const tightStop = price - atr;
    const normalStop = price - (atr * 1.5);
    const wideStop = price - (atr * 2);

    return {
      success: true,
      title: `🛑 Stop Loss Levels for ${upperSymbol}`,
      color: 'warning',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'ATR(14)', value: `$${atr.toFixed(2)}`, inline: true },
        { name: 'Support', value: `$${indicators.support.toFixed(2)}`, inline: true },
        { name: '🔴 Tight Stop (1 ATR)', value: `$${tightStop.toFixed(2)} (-${((price - tightStop) / price * 100).toFixed(1)}%)`, inline: false },
        { name: '🟡 Normal Stop (1.5 ATR)', value: `$${normalStop.toFixed(2)} (-${((price - normalStop) / price * 100).toFixed(1)}%)`, inline: false },
        { name: '🟢 Wide Stop (2 ATR)', value: `$${wideStop.toFixed(2)} (-${((price - wideStop) / price * 100).toFixed(1)}%)`, inline: false },
      ],
    };
  } catch (e) {
    console.error(`[StopLoss Command] Error calculating stop loss for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Analysis Unavailable', 
      error: `Could not calculate stop loss for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/generator?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleTakeprofitCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /takeprofit AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    const atr = indicators.atr14;
    
    const tp1 = price + atr;
    const tp2 = price + (atr * 2);
    const tp3 = indicators.resistance;

    return {
      success: true,
      title: `🎯 Take Profit Levels for ${upperSymbol}`,
      color: 'success',
      fields: [
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'Resistance', value: `$${indicators.resistance.toFixed(2)}`, inline: true },
        { name: 'ATR(14)', value: `$${atr.toFixed(2)}`, inline: true },
        { name: '🟢 TP1 (1 ATR)', value: `$${tp1.toFixed(2)} (+${((tp1 - price) / price * 100).toFixed(1)}%)`, inline: false },
        { name: '🟢 TP2 (2 ATR)', value: `$${tp2.toFixed(2)} (+${((tp2 - price) / price * 100).toFixed(1)}%)`, inline: false },
        { name: '🎯 Resistance Target', value: `$${tp3.toFixed(2)} (+${((tp3 - price) / price * 100).toFixed(1)}%)`, inline: false },
      ],
    };
  } catch (e) {
    console.error(`[TakeProfit Command] Error calculating take profit for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Analysis Unavailable', 
      error: `Could not calculate take profit for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/generator?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleRiskCommand(symbol: string, accountSize?: number): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /risk AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  const account = accountSize || 10000;
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    const price = indicators.currentPrice;
    const atr = indicators.atr14;
    
    const riskPercent = 2;
    const riskAmount = account * (riskPercent / 100);
    const stopDistance = atr * 1.5;
    const positionSize = Math.floor(riskAmount / stopDistance);
    const positionValue = positionSize * price;

    return {
      success: true,
      title: `⚖️ Risk Analysis for ${upperSymbol}`,
      color: 'brand',
      fields: [
        { name: 'Account Size', value: `$${account.toLocaleString()}`, inline: true },
        { name: 'Risk per Trade', value: `${riskPercent}% ($${riskAmount.toFixed(2)})`, inline: true },
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'Stop Distance', value: `$${stopDistance.toFixed(2)} (1.5 ATR)`, inline: true },
        { name: 'Suggested Position', value: `${positionSize} shares`, inline: true },
        { name: 'Position Value', value: `$${positionValue.toFixed(2)}`, inline: true },
      ],
    };
  } catch (e) {
    console.error(`[Risk Command] Error calculating risk for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Analysis Unavailable', 
      error: `Could not calculate risk analysis for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/generator?symbol=${upperSymbol}` }]
    };
  }
}

// Note: bot.ts calls this as handlePositionCommand(account, riskPercent) - both numbers
export async function handlePositionCommand(accountOrSymbol: number | string, riskPercentOrAccount?: number): Promise<CommandResult> {
  // If first arg is a number, it's the new signature: (account, riskPercent)
  if (typeof accountOrSymbol === 'number') {
    const account = accountOrSymbol;
    const riskPercent = riskPercentOrAccount || 2;
    const riskAmount = account * (riskPercent / 100);
    
    return {
      success: true,
      title: '📊 Position Sizing',
      color: 'brand',
      fields: [
        { name: 'Account Size', value: `$${account.toLocaleString()}`, inline: true },
        { name: 'Risk %', value: `${riskPercent}%`, inline: true },
        { name: 'Max Risk Amount', value: `$${riskAmount.toFixed(2)}`, inline: true },
        { name: 'Tip', value: 'Use /stoploss to calculate exact position size based on stop loss distance', inline: false },
      ],
      links: [{ label: '📐 Calculator', url: `${FRONTEND_BASE_URL}/app/calculator` }]
    };
  }
  
  // Otherwise it's old signature: (symbol, accountSize)
  return handleRiskCommand(accountOrSymbol, riskPercentOrAccount);
}

// ============ PREMIUM TIER: Options Commands ============

export async function handleOptionsCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /options AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    const expirations = await getOptionsExpirations(upperSymbol);
    
    if (expirations.length === 0) {
      return {
        success: false,
        title: `Options Unavailable`,
        error: `No options chain found for ${upperSymbol}. This symbol may not have tradable options.`,
        color: 'warning'
      };
    }

    const quote = await getTradierQuote(upperSymbol);
    if (!quote || !quote.price) {
      return { success: false, title: 'Quote Unavailable', error: `Could not fetch current price for ${upperSymbol}`, color: 'warning' };
    }
    const currentPrice = quote.price;
    const chain = await getOptionsChain(upperSymbol, expirations[0]);

    const totalCallOI = chain.calls.reduce((sum, c) => sum + c.openInterest, 0);
    const totalPutOI = chain.puts.reduce((sum, c) => sum + c.openInterest, 0);
    const putCallRatio = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';

    const atmCall = chain.calls
      .filter(c => c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))[0];
    
    const atmPut = chain.puts
      .filter(c => c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))[0];

    return {
      success: true,
      title: `Options Summary: ${upperSymbol}`,
      description: `Price: $${currentPrice.toFixed(2)} | Nearest Exp: ${expirations[0]}`,
      color: 'brand',
      fields: [
        { name: 'Expirations', value: `${expirations.length} available`, inline: true },
        { name: 'Put/Call Ratio', value: putCallRatio.toString(), inline: true },
        { name: 'Total OI', value: (totalCallOI + totalPutOI).toLocaleString(), inline: true },
        { name: 'ATM Call', value: atmCall ? `$${atmCall.strike} @ $${atmCall.bid.toFixed(2)}-$${atmCall.ask.toFixed(2)}` : 'N/A', inline: true },
        { name: 'ATM Put', value: atmPut ? `$${atmPut.strike} @ $${atmPut.bid.toFixed(2)}-$${atmPut.ask.toFixed(2)}` : 'N/A', inline: true },
        { name: 'IV (ATM)', value: atmCall?.impliedVolatility ? `${(atmCall.impliedVolatility * 100).toFixed(1)}%` : 'N/A', inline: true },
      ],
    };
  } catch (error: any) {
    console.error(`[Options Command] Error for ${upperSymbol}:`, error);
    return {
      success: false,
      title: 'Options Data Unavailable',
      error: `Could not fetch options data for ${upperSymbol}. Please try again.`,
      color: 'error'
    };
  }
}

export async function handleIVCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /iv AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    // Calculate IV approximation from ATR (higher volatility = higher IV)
    const atrPercent = (indicators.atr14 / indicators.currentPrice) * 100;
    const iv = Math.min(100, atrPercent * 10); // Rough approximation

    let interpretation = 'Average volatility';
    let color: CommandResult['color'] = 'info';
    if (iv >= 50) {
      interpretation = '🔥 High Volatility - consider selling premium';
      color = 'warning';
    } else if (iv <= 20) {
      interpretation = '❄️ Low Volatility - consider buying premium';
      color = 'success';
    }

    return {
      success: true,
      title: `📊 Volatility for ${upperSymbol}`,
      color,
      fields: [
        { name: 'ATR %', value: `${atrPercent.toFixed(2)}%`, inline: true },
        { name: 'Current Price', value: `$${indicators.currentPrice.toFixed(2)}`, inline: true },
        { name: 'Interpretation', value: interpretation, inline: false },
      ],
      links: [{ label: '📈 Full Options Chain', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` }]
    };
  } catch (e) {
    console.error(`[IV Command] Error getting IV for ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'Volatility Data Unavailable', 
      error: `Could not fetch volatility data for ${upperSymbol}. Market data service may be temporarily unavailable.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/screener?symbol=${upperSymbol}` }]
    };
  }
}

// ============ PREMIUM TIER: Portfolio Commands ============

export async function handlePortfolioCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: 'Account Required',
      error: 'Please link your account to view portfolio',
      color: 'warning'
    };
  }

  const trades = await storage.getAllTrades();
  const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
  const closedTrades = userTrades.filter((t: SelectTradeExecution) => t.status === 'closed');
  
  if (closedTrades.length === 0) {
    return {
      success: true,
      title: '💼 Portfolio Summary',
      description: 'No closed trades yet. Start tracking your trades!',
      color: 'info',
      links: [{ label: '📊 Open Portfolio', url: `${FRONTEND_BASE_URL}/app/portfolio` }]
    };
  }

  const totalPnL = closedTrades.reduce((sum: number, t: SelectTradeExecution) => sum + parseFloat(t.profitLoss || "0"), 0);
  const winningTrades = closedTrades.filter((t: SelectTradeExecution) => parseFloat(t.profitLoss || "0") > 0);
  const winRate = (winningTrades.length / closedTrades.length * 100).toFixed(1);

  return {
    success: true,
    title: '💼 Portfolio Summary',
    color: totalPnL >= 0 ? 'success' : 'error',
    fields: [
      { name: 'Total Trades', value: closedTrades.length.toString(), inline: true },
      { name: 'Win Rate', value: `${winRate}%`, inline: true },
      { name: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, inline: true },
    ],
    links: [{ label: '📊 Full Analytics', url: `${FRONTEND_BASE_URL}/app/portfolio` }]
  };
}

export async function handlePnLCommand(userId: string | undefined): Promise<CommandResult> {
  return handlePortfolioCommand(userId);
}

// ============ PREMIUM TIER: AI Commands ============

export async function handleAIAnalyzeCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /analyze AAPL', color: 'warning' };
  }

  const client = getOpenAI();
  if (!client) {
    return { success: false, title: 'AI Unavailable', error: 'AI service is not configured', color: 'error' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const indicators = await calculateTechnicalIndicators(upperSymbol);
    
    const ma = indicators.movingAverages;
    const prompt = `Analyze ${upperSymbol} based on these technicals:
Price: $${indicators.currentPrice.toFixed(2)}
RSI(14): ${indicators.rsi14.toFixed(2)}
MACD: ${indicators.macd.macdLine.toFixed(4)} (Signal: ${indicators.macd.signalLine.toFixed(4)})
Support: $${indicators.support.toFixed(2)} | Resistance: $${indicators.resistance.toFixed(2)}
SMA(50): $${ma.sma50.toFixed(2)} | SMA(200): $${ma.sma200.toFixed(2)}

Provide a brief technical analysis with bullish/bearish outlook. Keep it under 500 characters.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: getSystemPromptRules() },
        { role: 'user', content: prompt }
      ],
    });

    const analysis = response.choices[0]?.message?.content || 'Analysis unavailable';

    return {
      success: true,
      title: `🤖 AI Analysis for ${upperSymbol}`,
      description: wrapAIResponse(analysis),
      color: 'brand',
      links: [{ label: '📊 Full Analysis', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` }]
    };
  } catch (e) {
    console.error(`[AI Analyze Command] Error analyzing ${upperSymbol}:`, e);
    return { 
      success: false, 
      title: 'AI Analysis Unavailable', 
      error: `Could not complete AI analysis for ${upperSymbol}. The service may be temporarily unavailable. Please try again in a moment.`, 
      color: 'warning',
      links: [{ label: '📊 Try Web App', url: `${FRONTEND_BASE_URL}/app/dashboard?symbol=${upperSymbol}` }]
    };
  }
}

export async function handleSentimentCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /sentiment AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  const news = await getMarketNews(upperSymbol);

  if (!news || news.length === 0) {
    return {
      success: true,
      title: `📰 Sentiment for ${upperSymbol}`,
      description: 'No recent news available for sentiment analysis',
      color: 'info'
    };
  }

  // Simple sentiment analysis based on headline keywords
  let positiveCount = 0;
  let negativeCount = 0;
  
  const positiveWords = ['surge', 'jump', 'gain', 'rise', 'soar', 'rally', 'beat', 'upgrade', 'bullish', 'growth', 'strong'];
  const negativeWords = ['fall', 'drop', 'decline', 'plunge', 'crash', 'miss', 'downgrade', 'bearish', 'weak', 'concern', 'warning'];
  
  for (const item of news) {
    const headline = item.headline.toLowerCase();
    if (positiveWords.some(word => headline.includes(word))) {
      positiveCount++;
    } else if (negativeWords.some(word => headline.includes(word))) {
      negativeCount++;
    }
  }
  
  const neutralCount = news.length - positiveCount - negativeCount;

  let overallSentiment = 'Neutral';
  let color: CommandResult['color'] = 'info';
  if (positiveCount > negativeCount * 1.5) {
    overallSentiment = '📈 Bullish';
    color = 'success';
  } else if (negativeCount > positiveCount * 1.5) {
    overallSentiment = '📉 Bearish';
    color = 'error';
  }

  return {
    success: true,
    title: `📰 Sentiment for ${upperSymbol}`,
    color,
    fields: [
      { name: 'Overall', value: overallSentiment, inline: true },
      { name: 'Positive', value: positiveCount.toString(), inline: true },
      { name: 'Negative', value: negativeCount.toString(), inline: true },
      { name: 'Neutral', value: neutralCount.toString(), inline: true },
      { name: 'Headlines Analyzed', value: news.length.toString(), inline: true },
    ],
    links: [{ label: '📰 View News', url: `${FRONTEND_BASE_URL}/app/news` }]
  };
}

// ============ ADMIN: System Commands ============

export async function handleHealthCommand(): Promise<CommandResult> {
  const dbCheck = await storage.getSignalHistoryBySymbol('SPY').then(() => true).catch(() => false);
  
  return {
    success: true,
    title: '🏥 System Health',
    color: dbCheck ? 'success' : 'error',
    fields: [
      { name: 'Database', value: dbCheck ? '✅ Connected' : '❌ Error', inline: true },
      { name: 'AI Service', value: getOpenAI() ? '✅ Available' : '⚠️ Not configured', inline: true },
      { name: 'Uptime', value: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`, inline: true },
    ],
  };
}

export function handleUptimeCommand(): CommandResult {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  return {
    success: true,
    title: '⏱️ System Uptime',
    color: 'brand',
    fields: [
      { name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
      { name: 'Started', value: new Date(Date.now() - uptime * 1000).toISOString(), inline: true },
    ],
  };
}

// ============ ALIASES & ADDITIONAL HANDLERS ============
// These provide compatibility with bot.ts expected function names

// Wrapper for stoploss (accepts optional entry price for compatibility)
export async function handleStopLossCommand(symbol: string, _entry?: number): Promise<CommandResult> {
  return handleStoplossCommand(symbol);
}

// Wrapper for takeprofit (accepts optional entry price for compatibility)
export async function handleTakeProfitCommand(symbol: string, _entry?: number): Promise<CommandResult> {
  return handleTakeprofitCommand(symbol);
}

// Alias for alerts list
export const handleAlertsCommand = handleAlertsListCommand;

// Alias for AI analyze
export const handleAnalyzeCommand = handleAIAnalyzeCommand;

// VWAP command
export async function handleVWAPCommand(symbol: string): Promise<CommandResult> {
  const upperSymbol = symbol.toUpperCase();
  const indicators = await getTechnicalIndicators(upperSymbol);
  
  if (!indicators) {
    return {
      success: false,
      title: `❌ VWAP Error`,
      color: 'error',
      description: `Could not calculate VWAP for ${upperSymbol}. Please try again.`
    };
  }

  return {
    success: true,
    title: `📊 VWAP for ${upperSymbol}`,
    color: 'brand',
    fields: [
      { name: 'Last Price', value: `$${indicators.currentPrice?.toFixed(2) || 'N/A'}`, inline: true },
      { name: 'Volume', value: indicators.volume ? indicators.volume.toLocaleString() : 'N/A', inline: true },
    ],
    links: [{ label: '📈 View Chart', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }]
  };
}

// Signal command (for single symbol signal)
export async function handleSignalCommand(symbol: string): Promise<CommandResult> {
  const upperSymbol = symbol.toUpperCase();
  const signals = await storage.getSignalHistoryBySymbol(upperSymbol);
  
  if (!signals || signals.length === 0) {
    return {
      success: false,
      title: `📡 No Signals for ${upperSymbol}`,
      color: 'warning',
      description: `No recent signals found for ${upperSymbol}. Generate one on our web app!`,
      links: [{ label: '🎯 Generate Signal', url: `${FRONTEND_BASE_URL}/app/generator` }]
    };
  }

  const latest = signals[0];
  const direction = latest.action?.toUpperCase() || 'NEUTRAL';
  const isCall = direction.includes('CALL');
  const confidence = parseFloat(latest.confidence) || 0;
  
  return {
    success: true,
    title: `📡 Signal: ${upperSymbol}`,
    color: isCall ? 'success' : 'error',
    fields: [
      { name: 'Direction', value: direction, inline: true },
      { name: 'Confidence', value: `${(confidence * 100).toFixed(0)}%`, inline: true },
      { name: 'Strike', value: latest.strikePrice ? `$${latest.strikePrice}` : 'N/A', inline: true },
      { name: 'Expiration', value: latest.expirationDate || 'N/A', inline: true },
    ],
    links: [{ label: '📊 View Details', url: `${FRONTEND_BASE_URL}/app/live` }]
  };
}

// Weekly command
export async function handleWeeklyCommand(): Promise<CommandResult> {
  // Get signals for a few popular symbols as a sample
  const popularSymbols = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA'];
  const allSignals: SelectSignalHistory[] = [];
  
  for (const sym of popularSymbols) {
    const signals = await storage.getSignalHistoryBySymbol(sym);
    if (signals && signals.length > 0) {
      allSignals.push(...signals.slice(0, 3));
    }
  }
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const weeklySignals = allSignals.filter(s => new Date(s.generatedAt || 0) >= weekAgo);
  
  return {
    success: true,
    title: '📅 Weekly Signals Summary',
    color: 'brand',
    description: `Found ${weeklySignals.length} signals generated this week.`,
    fields: weeklySignals.slice(0, 5).map(s => ({
      name: s.symbol || 'Unknown',
      value: `${s.action} | ${(parseFloat(s.confidence) * 100).toFixed(0)}% confidence`,
      inline: true
    })),
    links: [{ label: '📊 View All', url: `${FRONTEND_BASE_URL}/app/history` }]
  };
}

// Strategy command
export async function handleStrategyCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /strategy AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const quote = await getTradierQuote(upperSymbol);
    if (!quote) {
      return { success: false, title: 'Symbol Not Found', error: `Could not find ${upperSymbol}`, color: 'warning' };
    }

    const expirations = await getOptionsExpirations(upperSymbol);
    const chain = expirations.length > 0 ? await getOptionsChain(upperSymbol, expirations[0]) : null;
    
    const totalCallOI = chain?.calls.reduce((sum, c) => sum + c.openInterest, 0) || 0;
    const totalPutOI = chain?.puts.reduce((sum, c) => sum + c.openInterest, 0) || 0;
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;
    
    let strategy = 'Neutral - Spread strategies recommended';
    let color: CommandResult['color'] = 'info';
    
    if (quote.changePercent > 2) {
      strategy = 'BULLISH Momentum - Consider call spreads or cash-secured puts';
      color = 'success';
    } else if (quote.changePercent < -2) {
      strategy = 'BEARISH Momentum - Consider put spreads or covered calls';
      color = 'error';
    } else if (pcr > 1.5) {
      strategy = 'High Put OI - Contrarian bullish setup possible';
      color = 'success';
    } else if (pcr < 0.5) {
      strategy = 'High Call OI - Contrarian bearish setup possible';
      color = 'warning';
    }

    return {
      success: true,
      title: `🎯 Strategy: ${upperSymbol}`,
      description: `Price: $${quote.price.toFixed(2)} | ${quote.changePercent >= 0 ? '▲' : '▼'} ${Math.abs(quote.changePercent).toFixed(2)}%`,
      color,
      fields: [
        { name: 'Suggested Approach', value: strategy, inline: false },
        { name: 'Put/Call Ratio', value: pcr.toFixed(2), inline: true },
        { name: 'Volume', value: quote.volume?.toLocaleString() || 'N/A', inline: true },
        { name: 'Next Steps', value: 'Use /signal to generate a specific trade signal, or /ask for AI strategy advice.', inline: false },
      ]
    };
  } catch (error: any) {
    console.error(`[Strategy Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not generate strategy', color: 'error' };
  }
}

// Alert command (create alert)
export async function handleAlertCommand(
  userId: string | undefined, 
  symbol: string, 
  price: number, 
  direction: string
): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }

  const upperSymbol = symbol.toUpperCase();
  const directionLower = direction.toLowerCase();
  
  if (!['above', 'below'].includes(directionLower)) {
    return {
      success: false,
      title: '❌ Invalid Direction',
      color: 'error',
      description: 'Direction must be "above" or "below".',
    };
  }

  try {
    await storage.createAlert({
      userId,
      symbol: upperSymbol,
      targetPrice: price,
      condition: directionLower,
    });

    return {
      success: true,
      title: '✅ Alert Created',
      color: 'success',
      description: `Alert set for ${upperSymbol} when price goes ${directionLower} $${price.toFixed(2)}.`,
    };
  } catch (error) {
    return {
      success: false,
      title: '❌ Alert Error',
      color: 'error',
      description: 'Could not create alert. Please try again.',
    };
  }
}

// Chain command
export async function handleChainCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /chain AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const expirations = await getOptionsExpirations(upperSymbol);
    
    if (expirations.length === 0) {
      return {
        success: false,
        title: `Options Unavailable`,
        error: `No options chain found for ${upperSymbol}. This symbol may not have tradable options.`,
        color: 'warning'
      };
    }

    const nearestExp = expirations[0];
    const chain = await getOptionsChain(upperSymbol, nearestExp);
    
    if (chain.calls.length === 0 && chain.puts.length === 0) {
      return {
        success: false,
        title: `Chain Empty`,
        error: `Options chain for ${upperSymbol} returned no contracts.`,
        color: 'warning'
      };
    }

    const quote = await getTradierQuote(upperSymbol);
    if (!quote || !quote.price) {
      return { success: false, title: 'Quote Unavailable', error: `Could not fetch current price for ${upperSymbol}`, color: 'warning' };
    }
    const currentPrice = quote.price;
    
    const atmCalls = chain.calls
      .filter(c => c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))
      .slice(0, 3);
    
    const atmPuts = chain.puts
      .filter(c => c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))
      .slice(0, 3);

    const formatContract = (c: OptionsContract) => 
      `$${c.strike} | $${c.bid.toFixed(2)}-$${c.ask.toFixed(2)} | Δ${c.delta?.toFixed(2) || 'N/A'} | OI:${c.openInterest}`;

    const callsStr = atmCalls.length > 0 
      ? atmCalls.map(formatContract).join('\n') 
      : 'No liquid calls';
    
    const putsStr = atmPuts.length > 0 
      ? atmPuts.map(formatContract).join('\n') 
      : 'No liquid puts';

    return {
      success: true,
      title: `⛓️ ${upperSymbol} Options Chain`,
      description: `Exp: ${nearestExp} | Current: $${currentPrice.toFixed(2)}`,
      color: 'brand',
      fields: [
        { name: '📈 CALLS (Strike | Bid-Ask | Delta | OI)', value: callsStr, inline: false },
        { name: '📉 PUTS (Strike | Bid-Ask | Delta | OI)', value: putsStr, inline: false },
        { name: '📅 Available Expirations', value: expirations.slice(0, 5).join(', '), inline: false },
      ],
    };
  } catch (error: any) {
    console.error(`[Chain Command] Error for ${upperSymbol}:`, error);
    return {
      success: false,
      title: 'Options Data Unavailable',
      error: `Could not fetch options chain for ${upperSymbol}. Please try again.`,
      color: 'error'
    };
  }
}

// Greeks command
export async function handleGreeksCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /greeks AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const expirations = await getOptionsExpirations(upperSymbol);
    if (expirations.length === 0) {
      return { success: false, title: 'Options Unavailable', error: `No options found for ${upperSymbol}`, color: 'warning' };
    }

    const quote = await getTradierQuote(upperSymbol);
    if (!quote || !quote.price) {
      return { success: false, title: 'Quote Unavailable', error: `Could not fetch current price for ${upperSymbol}`, color: 'warning' };
    }
    const currentPrice = quote.price;
    const chain = await getOptionsChain(upperSymbol, expirations[0]);

    const atmCall = chain.calls
      .filter(c => c.delta !== undefined && c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))[0];
    
    const atmPut = chain.puts
      .filter(c => c.delta !== undefined && c.bid > 0)
      .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))[0];

    if (!atmCall && !atmPut) {
      return { success: false, title: 'No Greeks Available', error: `Could not find options with Greeks for ${upperSymbol}`, color: 'warning' };
    }

    const fields = [];
    
    if (atmCall) {
      fields.push({ name: `CALL $${atmCall.strike}`, value: 
        `Δ Delta: ${atmCall.delta?.toFixed(3) || 'N/A'}\n` +
        `Γ Gamma: ${atmCall.gamma?.toFixed(4) || 'N/A'}\n` +
        `Θ Theta: ${atmCall.theta?.toFixed(3) || 'N/A'}\n` +
        `ν Vega: ${atmCall.vega?.toFixed(3) || 'N/A'}`, inline: true });
    }
    
    if (atmPut) {
      fields.push({ name: `PUT $${atmPut.strike}`, value: 
        `Δ Delta: ${atmPut.delta?.toFixed(3) || 'N/A'}\n` +
        `Γ Gamma: ${atmPut.gamma?.toFixed(4) || 'N/A'}\n` +
        `Θ Theta: ${atmPut.theta?.toFixed(3) || 'N/A'}\n` +
        `ν Vega: ${atmPut.vega?.toFixed(3) || 'N/A'}`, inline: true });
    }

    return {
      success: true,
      title: `🔢 Greeks for ${upperSymbol}`,
      description: `ATM Options | Exp: ${expirations[0]} | Price: $${currentPrice.toFixed(2)}`,
      color: 'brand',
      fields
    };
  } catch (error: any) {
    console.error(`[Greeks Command] Error for ${upperSymbol}:`, error);
    return { success: false, title: 'Greeks Unavailable', error: `Could not fetch Greeks for ${upperSymbol}`, color: 'error' };
  }
}

// Max pain command
export async function handleMaxPainCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /maxpain AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const expirations = await getOptionsExpirations(upperSymbol);
    if (expirations.length === 0) {
      return { success: false, title: 'Options Unavailable', error: `No options found for ${upperSymbol}`, color: 'warning' };
    }

    const quote = await getTradierQuote(upperSymbol);
    if (!quote || !quote.price) {
      return { success: false, title: 'Quote Unavailable', error: `Could not fetch current price for ${upperSymbol}`, color: 'warning' };
    }
    const currentPrice = quote.price;
    const chain = await getOptionsChain(upperSymbol, expirations[0]);

    const allContracts = [...chain.calls, ...chain.puts];
    if (allContracts.length === 0) {
      return { success: false, title: 'No Data', error: `No options contracts found for ${upperSymbol}`, color: 'warning' };
    }

    const strikes = [...new Set(allContracts.map(c => c.strike))].sort((a, b) => a - b);
    
    let maxPainStrike = strikes[0];
    let minPain = Infinity;

    for (const strike of strikes) {
      let totalPain = 0;
      for (const call of chain.calls) {
        if (strike > call.strike) {
          totalPain += (strike - call.strike) * call.openInterest * 100;
        }
      }
      for (const put of chain.puts) {
        if (strike < put.strike) {
          totalPain += (put.strike - strike) * put.openInterest * 100;
        }
      }
      if (totalPain < minPain) {
        minPain = totalPain;
        maxPainStrike = strike;
      }
    }

    const distanceFromCurrent = ((maxPainStrike - currentPrice) / currentPrice * 100).toFixed(2);
    const direction = maxPainStrike > currentPrice ? '📈 Above' : maxPainStrike < currentPrice ? '📉 Below' : '➡️ At';

    return {
      success: true,
      title: `📍 Max Pain: ${upperSymbol}`,
      description: `Expiration: ${expirations[0]}`,
      color: 'brand',
      fields: [
        { name: 'Max Pain Strike', value: `$${maxPainStrike.toFixed(2)}`, inline: true },
        { name: 'Current Price', value: `$${currentPrice.toFixed(2)}`, inline: true },
        { name: 'Distance', value: `${direction} (${distanceFromCurrent}%)`, inline: true },
        { name: 'Interpretation', value: maxPainStrike > currentPrice 
          ? 'Price may gravitate higher toward max pain by expiration'
          : maxPainStrike < currentPrice 
            ? 'Price may gravitate lower toward max pain by expiration'
            : 'Price is at max pain level', inline: false },
      ]
    };
  } catch (error: any) {
    console.error(`[MaxPain Command] Error for ${upperSymbol}:`, error);
    return { success: false, title: 'Max Pain Unavailable', error: `Could not calculate max pain for ${upperSymbol}`, color: 'error' };
  }
}

// Open interest command
export async function handleOpenInterestCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /openinterest AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const expirations = await getOptionsExpirations(upperSymbol);
    if (expirations.length === 0) {
      return { success: false, title: 'Options Unavailable', error: `No options found for ${upperSymbol}`, color: 'warning' };
    }

    const quote = await getTradierQuote(upperSymbol);
    if (!quote || !quote.price) {
      return { success: false, title: 'Quote Unavailable', error: `Could not fetch current price for ${upperSymbol}`, color: 'warning' };
    }
    const currentPrice = quote.price;
    const chain = await getOptionsChain(upperSymbol, expirations[0]);

    const totalCallOI = chain.calls.reduce((sum, c) => sum + c.openInterest, 0);
    const totalPutOI = chain.puts.reduce((sum, c) => sum + c.openInterest, 0);
    const totalOI = totalCallOI + totalPutOI;
    const putCallRatio = totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : 'N/A';

    const topCallStrikes = chain.calls
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 3)
      .map(c => `$${c.strike}: ${c.openInterest.toLocaleString()}`).join('\n');

    const topPutStrikes = chain.puts
      .sort((a, b) => b.openInterest - a.openInterest)
      .slice(0, 3)
      .map(c => `$${c.strike}: ${c.openInterest.toLocaleString()}`).join('\n');

    let sentiment = 'Neutral';
    let color: CommandResult['color'] = 'info';
    const pcr = parseFloat(putCallRatio as string);
    if (!isNaN(pcr)) {
      if (pcr > 1.2) { sentiment = '🐻 Bearish (High Put OI)'; color = 'error'; }
      else if (pcr < 0.7) { sentiment = '🐂 Bullish (High Call OI)'; color = 'success'; }
    }

    return {
      success: true,
      title: `📊 Open Interest: ${upperSymbol}`,
      description: `Exp: ${expirations[0]} | Price: $${currentPrice.toFixed(2)}`,
      color,
      fields: [
        { name: 'Total Call OI', value: totalCallOI.toLocaleString(), inline: true },
        { name: 'Total Put OI', value: totalPutOI.toLocaleString(), inline: true },
        { name: 'Put/Call Ratio', value: putCallRatio.toString(), inline: true },
        { name: 'Sentiment', value: sentiment, inline: false },
        { name: 'Top Call Strikes', value: topCallStrikes || 'N/A', inline: true },
        { name: 'Top Put Strikes', value: topPutStrikes || 'N/A', inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[OpenInterest Command] Error for ${upperSymbol}:`, error);
    return { success: false, title: 'OI Unavailable', error: `Could not fetch open interest for ${upperSymbol}`, color: 'error' };
  }
}

// Positions command
export async function handlePositionsCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const trades = await storage.getAllTrades();
    const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
    const openPositions = userTrades.filter((t: SelectTradeExecution) => t.status === 'open' || t.status === 'active');

    if (openPositions.length === 0) {
      return {
        success: true,
        title: '📂 Open Positions',
        description: 'You have no open positions currently.',
        color: 'info',
      };
    }

    const positionsList = openPositions.slice(0, 5).map((t: SelectTradeExecution) => {
      const pnl = parseFloat(t.profitLoss || '0');
      const pnlSign = pnl >= 0 ? '+' : '';
      return `${t.symbol} ${t.optionType} $${t.strikePrice} | ${t.contracts} contracts | P&L: ${pnlSign}$${pnl.toFixed(2)}`;
    }).join('\n');

    return {
      success: true,
      title: `📂 Open Positions (${openPositions.length})`,
      color: 'brand',
      fields: [
        { name: 'Your Positions', value: positionsList, inline: false },
      ]
    };
  } catch (error: any) {
    console.error(`[Positions Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not fetch positions', color: 'error' };
  }
}

// Win rate command
export async function handleWinRateCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const trades = await storage.getAllTrades();
    const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
    const closedTrades = userTrades.filter((t: SelectTradeExecution) => t.status === 'closed');

    if (closedTrades.length === 0) {
      return {
        success: true,
        title: '🏆 Win Rate',
        description: 'No closed trades yet. Complete some trades to see your win rate!',
        color: 'info',
      };
    }

    const winners = closedTrades.filter((t: SelectTradeExecution) => parseFloat(t.profitLoss || '0') > 0);
    const losers = closedTrades.filter((t: SelectTradeExecution) => parseFloat(t.profitLoss || '0') < 0);
    const breakeven = closedTrades.filter((t: SelectTradeExecution) => parseFloat(t.profitLoss || '0') === 0);
    
    const winRate = (winners.length / closedTrades.length * 100).toFixed(1);
    const totalPnL = closedTrades.reduce((sum: number, t: SelectTradeExecution) => sum + parseFloat(t.profitLoss || '0'), 0);
    const avgWin = winners.length > 0 
      ? (winners.reduce((sum: number, t: SelectTradeExecution) => sum + parseFloat(t.profitLoss || '0'), 0) / winners.length).toFixed(2)
      : '0';
    const avgLoss = losers.length > 0
      ? (losers.reduce((sum: number, t: SelectTradeExecution) => sum + parseFloat(t.profitLoss || '0'), 0) / losers.length).toFixed(2)
      : '0';

    return {
      success: true,
      title: `🏆 Win Rate: ${winRate}%`,
      color: parseFloat(winRate) >= 50 ? 'success' : 'warning',
      fields: [
        { name: 'Total Trades', value: closedTrades.length.toString(), inline: true },
        { name: 'Winners', value: `${winners.length} (${winRate}%)`, inline: true },
        { name: 'Losers', value: losers.length.toString(), inline: true },
        { name: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, inline: true },
        { name: 'Avg Win', value: `+$${avgWin}`, inline: true },
        { name: 'Avg Loss', value: `$${avgLoss}`, inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[WinRate Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not calculate win rate', color: 'error' };
  }
}

// Journal command
export async function handleJournalCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const entries = await storage.getJournalEntriesByUserId(userId);
    
    if (!entries || entries.length === 0) {
      return {
        success: true,
        title: '📔 Trading Journal',
        description: 'No journal entries yet. Start logging your trades to track your progress!',
        color: 'info',
      };
    }

    const recentEntries = entries.slice(0, 5).map((e: SelectTradeJournalEntry) => {
      const pnl = e.profitLoss ? parseFloat(e.profitLoss) : 0;
      const pnlStr = pnl !== 0 ? ` | ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '';
      const date = new Date(e.createdAt).toLocaleDateString();
      return `${date}: ${e.symbol || 'N/A'} ${e.action || ''}${pnlStr}`;
    }).join('\n');

    const totalPnL = entries.reduce((sum: number, e: SelectTradeJournalEntry) => 
      sum + (e.profitLoss ? parseFloat(e.profitLoss) : 0), 0);

    return {
      success: true,
      title: `📔 Trading Journal (${entries.length} entries)`,
      color: 'brand',
      fields: [
        { name: 'Recent Entries', value: recentEntries, inline: false },
        { name: 'Total Journal P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[Journal Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not fetch journal entries', color: 'error' };
  }
}

// History command
export async function handleHistoryCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const history = await storage.getSignalHistoryByUserId(userId);
    
    if (!history || history.length === 0) {
      return {
        success: true,
        title: '📜 Signal History',
        description: 'No signals generated yet. Generate your first signal to start building history!',
        color: 'info',
      };
    }

    const recentSignals = history.slice(0, 5).map((s: SelectSignalHistory) => {
      const date = new Date(s.createdAt).toLocaleDateString();
      const conf = s.confidence ? `${(parseFloat(s.confidence) * 100).toFixed(0)}%` : 'N/A';
      return `${date}: ${s.symbol} ${s.action} | Conf: ${conf}`;
    }).join('\n');

    return {
      success: true,
      title: `📜 Signal History (${history.length} signals)`,
      color: 'brand',
      fields: [
        { name: 'Recent Signals', value: recentSignals, inline: false },
        { name: 'Total Generated', value: history.length.toString(), inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[History Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not fetch signal history', color: 'error' };
  }
}

// Stats command
export async function handleStatsCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const trades = await storage.getAllTrades();
    const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
    const closedTrades = userTrades.filter((t: SelectTradeExecution) => t.status === 'closed');

    if (closedTrades.length === 0) {
      return {
        success: true,
        title: '📊 Performance Stats',
        description: 'No closed trades yet. Complete some trades to see your stats!',
        color: 'info',
      };
    }

    const pnlValues = closedTrades.map((t: SelectTradeExecution) => parseFloat(t.profitLoss || '0'));
    const totalPnL = pnlValues.reduce((sum, pnl) => sum + pnl, 0);
    const avgPnL = totalPnL / closedTrades.length;
    const maxWin = Math.max(...pnlValues);
    const maxLoss = Math.min(...pnlValues);
    
    const winners = pnlValues.filter(p => p > 0);
    const losers = pnlValues.filter(p => p < 0);
    const winRate = (winners.length / closedTrades.length * 100).toFixed(1);
    const profitFactor = losers.length > 0 && Math.abs(losers.reduce((a, b) => a + b, 0)) > 0
      ? (winners.reduce((a, b) => a + b, 0) / Math.abs(losers.reduce((a, b) => a + b, 0))).toFixed(2)
      : 'N/A';

    return {
      success: true,
      title: `📊 Performance Stats`,
      color: totalPnL >= 0 ? 'success' : 'error',
      fields: [
        { name: 'Total Trades', value: closedTrades.length.toString(), inline: true },
        { name: 'Win Rate', value: `${winRate}%`, inline: true },
        { name: 'Profit Factor', value: profitFactor.toString(), inline: true },
        { name: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`, inline: true },
        { name: 'Avg P&L', value: `${avgPnL >= 0 ? '+' : ''}$${avgPnL.toFixed(2)}`, inline: true },
        { name: 'Best/Worst', value: `+$${maxWin.toFixed(2)} / $${maxLoss.toFixed(2)}`, inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[Stats Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not fetch stats', color: 'error' };
  }
}

// Drawdown command
export async function handleDrawdownCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const trades = await storage.getAllTrades();
    const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
    const closedTrades = userTrades
      .filter((t: SelectTradeExecution) => t.status === 'closed')
      .sort((a: SelectTradeExecution, b: SelectTradeExecution) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (closedTrades.length === 0) {
      return {
        success: true,
        title: '📉 Drawdown Analysis',
        description: 'No closed trades yet. Complete some trades to see drawdown metrics!',
        color: 'info',
      };
    }

    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    let currentDrawdown = 0;

    for (const trade of closedTrades) {
      runningPnL += parseFloat(trade.profitLoss || '0');
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      currentDrawdown = peak - runningPnL;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
    }

    const recoveryNeeded = maxDrawdown > 0 && peak > 0 
      ? ((maxDrawdown / (peak - maxDrawdown)) * 100).toFixed(1)
      : '0';

    return {
      success: true,
      title: `📉 Drawdown Analysis`,
      color: maxDrawdown > 0 ? 'warning' : 'success',
      fields: [
        { name: 'Max Drawdown', value: `$${maxDrawdown.toFixed(2)}`, inline: true },
        { name: 'Current Drawdown', value: `$${currentDrawdown.toFixed(2)}`, inline: true },
        { name: 'Peak P&L', value: `$${peak.toFixed(2)}`, inline: true },
        { name: 'Current P&L', value: `$${runningPnL.toFixed(2)}`, inline: true },
        { name: 'Recovery Needed', value: `${recoveryNeeded}%`, inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[Drawdown Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not calculate drawdown', color: 'error' };
  }
}

// Expectancy command
export async function handleExpectancyCommand(userId: string | undefined): Promise<CommandResult> {
  if (!userId) {
    return {
      success: false,
      title: '❌ Not Connected',
      color: 'error',
      description: 'Please connect your account first using /connect.',
    };
  }
  
  try {
    const trades = await storage.getAllTrades();
    const userTrades = trades.filter((t: SelectTradeExecution) => t.userId === userId);
    const closedTrades = userTrades.filter((t: SelectTradeExecution) => t.status === 'closed');

    if (closedTrades.length === 0) {
      return {
        success: true,
        title: '📈 Trading Expectancy',
        description: 'No closed trades yet. Complete some trades to calculate expectancy!',
        color: 'info',
      };
    }

    const pnlValues = closedTrades.map((t: SelectTradeExecution) => parseFloat(t.profitLoss || '0'));
    const winners = pnlValues.filter(p => p > 0);
    const losers = pnlValues.filter(p => p < 0);
    
    const winRate = winners.length / closedTrades.length;
    const avgWin = winners.length > 0 ? winners.reduce((a, b) => a + b, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((a, b) => a + b, 0) / losers.length) : 0;
    
    const expectancy = (winRate * avgWin) - ((1 - winRate) * avgLoss);
    const rMultiple = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      success: true,
      title: `📈 Trading Expectancy`,
      color: expectancy >= 0 ? 'success' : 'error',
      fields: [
        { name: 'Expectancy', value: `${expectancy >= 0 ? '+' : ''}$${expectancy.toFixed(2)}/trade`, inline: true },
        { name: 'R-Multiple', value: rMultiple.toFixed(2), inline: true },
        { name: 'Win Rate', value: `${(winRate * 100).toFixed(1)}%`, inline: true },
        { name: 'Avg Win', value: `+$${avgWin.toFixed(2)}`, inline: true },
        { name: 'Avg Loss', value: `-$${avgLoss.toFixed(2)}`, inline: true },
        { name: 'Total Trades', value: closedTrades.length.toString(), inline: true },
      ]
    };
  } catch (error: any) {
    console.error(`[Expectancy Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not calculate expectancy', color: 'error' };
  }
}

// Bias command
export async function handleBiasCommand(symbol: string): Promise<CommandResult> {
  const upperSymbol = symbol.toUpperCase();
  const indicators = await getTechnicalIndicators(upperSymbol);
  
  if (!indicators) {
    return {
      success: false,
      title: `❌ Bias Error`,
      color: 'error',
      description: `Could not analyze bias for ${upperSymbol}.`
    };
  }

  let bias = 'Neutral';
  let color: CommandResult['color'] = 'warning';
  const rsi = indicators.rsi14;
  
  if (rsi) {
    if (rsi > 70) {
      bias = 'Overbought (Bearish Bias)';
      color = 'error';
    } else if (rsi < 30) {
      bias = 'Oversold (Bullish Bias)';
      color = 'success';
    } else if (rsi > 55) {
      bias = 'Bullish';
      color = 'success';
    } else if (rsi < 45) {
      bias = 'Bearish';
      color = 'error';
    }
  }

  return {
    success: true,
    title: `🧭 Market Bias: ${upperSymbol}`,
    color,
    fields: [
      { name: 'Bias', value: bias, inline: true },
      { name: 'RSI', value: rsi?.toFixed(1) || 'N/A', inline: true },
    ],
    links: [{ label: '📊 Full Analysis', url: `${FRONTEND_BASE_URL}/app/charts?symbol=${upperSymbol}` }]
  };
}

// Explain command
export async function handleExplainCommand(topic: string): Promise<CommandResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      success: false,
      title: '❌ AI Not Available',
      color: 'error',
      description: 'AI service is currently unavailable.',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an options trading educator. Explain trading concepts clearly and concisely in 2-3 sentences. Always include a practical example.' },
        { role: 'user', content: `Explain: ${topic}` }
      ],
      max_tokens: 200,
    });

    const explanation = response.choices[0]?.message?.content || 'Unable to generate explanation.';

    return {
      success: true,
      title: `📚 ${topic}`,
      color: 'brand',
      description: explanation,
      links: [{ label: '📖 Learn More', url: `${FRONTEND_BASE_URL}/app/learn` }]
    };
  } catch {
    return {
      success: false,
      title: '❌ Explain Error',
      color: 'error',
      description: 'Could not generate explanation. Please try again.',
    };
  }
}

// Plan command
export async function handlePlanCommand(symbol: string): Promise<CommandResult> {
  if (!symbol) {
    return { success: false, title: 'Missing Symbol', error: 'Please provide a symbol. Usage: /plan AAPL', color: 'warning' };
  }

  const upperSymbol = symbol.toUpperCase();
  
  try {
    const quote = await getTradierQuote(upperSymbol);
    if (!quote) {
      return { success: false, title: 'Symbol Not Found', error: `Could not find ${upperSymbol}`, color: 'warning' };
    }

    const indicators = await getTechnicalIndicators(upperSymbol);
    if (!indicators) {
      return { success: false, title: 'Data Unavailable', error: `Could not calculate indicators for ${upperSymbol}`, color: 'warning' };
    }

    const price = quote.price;
    const atr = indicators.atr14 || (price * 0.02);
    const stopDistance = atr * 1.5;
    const targetDistance = atr * 2.5;
    
    let direction = 'NEUTRAL';
    let stopLoss = price - stopDistance;
    let target1 = price + targetDistance;
    let target2 = price + (targetDistance * 1.5);
    
    if (indicators.rsi14 && indicators.rsi14 < 30) {
      direction = 'BULLISH (Oversold)';
    } else if (indicators.rsi14 && indicators.rsi14 > 70) {
      direction = 'BEARISH (Overbought)';
      stopLoss = price + stopDistance;
      target1 = price - targetDistance;
      target2 = price - (targetDistance * 1.5);
    } else if (quote.changePercent > 1) {
      direction = 'BULLISH';
    } else if (quote.changePercent < -1) {
      direction = 'BEARISH';
      stopLoss = price + stopDistance;
      target1 = price - targetDistance;
      target2 = price - (targetDistance * 1.5);
    }

    const riskReward = (targetDistance / stopDistance).toFixed(1);

    return {
      success: true,
      title: `📋 Trading Plan: ${upperSymbol}`,
      description: `Bias: ${direction}`,
      color: direction.includes('BULLISH') ? 'success' : direction.includes('BEARISH') ? 'error' : 'info',
      fields: [
        { name: 'Entry Zone', value: `$${(price * 0.99).toFixed(2)} - $${(price * 1.01).toFixed(2)}`, inline: true },
        { name: 'Current Price', value: `$${price.toFixed(2)}`, inline: true },
        { name: 'RSI', value: indicators.rsi14?.toFixed(0) || 'N/A', inline: true },
        { name: 'Stop Loss', value: `$${stopLoss.toFixed(2)}`, inline: true },
        { name: 'Target 1', value: `$${target1.toFixed(2)}`, inline: true },
        { name: 'Target 2', value: `$${target2.toFixed(2)}`, inline: true },
        { name: 'R:R Ratio', value: `1:${riskReward}`, inline: true },
        { name: 'ATR (14)', value: `$${atr.toFixed(2)}`, inline: true },
        { name: 'Disclaimer', value: 'This is educational analysis only, not financial advice. Always do your own research.', inline: false },
      ]
    };
  } catch (error: any) {
    console.error(`[Plan Command] Error:`, error);
    return { success: false, title: 'Error', error: 'Could not generate trading plan', color: 'error' };
  }
}

// Review command
export async function handleReviewCommand(tradeIdea: string): Promise<CommandResult> {
  const openai = getOpenAI();
  if (!openai) {
    return {
      success: false,
      title: '❌ AI Not Available',
      color: 'error',
      description: 'AI service is currently unavailable.',
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an options trading coach. Briefly review the trade idea and provide 1-2 specific improvements or risks to consider. Be concise.' },
        { role: 'user', content: `Review this trade idea: ${tradeIdea}` }
      ],
      max_tokens: 200,
    });

    const review = response.choices[0]?.message?.content || 'Unable to generate review.';

    return {
      success: true,
      title: `📝 Trade Review`,
      color: 'brand',
      description: review,
    };
  } catch {
    return {
      success: false,
      title: '❌ Review Error',
      color: 'error',
      description: 'Could not generate review. Please try again.',
    };
  }
}
