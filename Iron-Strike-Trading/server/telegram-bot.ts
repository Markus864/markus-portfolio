/**
 * Iron Strike Telegram Bot - FINAL PRODUCTION VERSION
 * Features:
 * - Full Command Parity (~50 Commands)
 * - Security Guard (Tiers & Cooldowns)
 * - "Brain" Delegation (Uses command-handlers.ts)
 * - Automatic Link Correction
 * - Forced Polling for AWS Worker
 */

import OpenAI from 'openai';
import { storage } from './storage';
import { 
  getCommand, 
  checkCommandAccess, 
  checkCooldown,
  UPGRADE_URL_PRO,
  UPGRADE_URL_PREMIUM
} from './command-registry';
import { normalizeTier, type Tier } from './tier';
import * as handlers from './command-handlers';
import { SUPPORT_PORTAL_URL, isSupportIssue, generateSupportGuidance } from '@shared/support-utils';
import { askCoach } from './ai/assistants';

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://www.ironstriketrading.com';

let openai: OpenAI | null = null;
let pollingActive = false;
let lastUpdateId = 0;

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!openai && apiKey) {
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// --- 1. HELPERS & FORMATTERS ---

async function sendMessage(chatId: number | string, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error(`[Telegram Bot] Failed to send message: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Telegram Bot] Error sending message:', error);
    return false;
  }
}

// Converts generic CommandResult to Telegram HTML
async function sendHandlerResult(chatId: number, result: handlers.CommandResult): Promise<void> {
  const emojiMap: Record<string, string> = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    brand: '⚡'
  };

  let message = `${emojiMap[result.color || 'info']} <b>${result.title}</b>\n\n${result.description}`;

  if (result.fields && result.fields.length > 0) {
    message += '\n\n';
    for (const field of result.fields) {
      message += `<b>${field.name}:</b> ${field.value}\n`;
    }
  }

  if (result.links && result.links.length > 0) {
    message += '\n\n<b>Links:</b>\n';
    for (const link of result.links) {
      let url = link.url;
      // Fix relative URLs
      if (url.startsWith('/')) {
        url = `${FRONTEND_BASE_URL}${url}`;
      }
      // FIX: Redirect Chart URL to correct route
      if (link.label.includes("Chart") && url.includes("/app/chart")) {
        url = url.replace("/app/chart", "/app/charts"); 
      }
      message += `👉 <a href="${url}">${link.label}</a>\n`;
    }
  }

  message += '\n\n⚠️ <i>Educational purposes only. Not financial advice.</i>';

  await sendMessage(chatId, message);
}

// --- 2. SPECIAL HANDLERS (Uses Iron Strike Coach Assistant) ---

async function handleAskCommand(chatId: number, question: string): Promise<void> {
  if (!question) {
    await sendMessage(chatId, '⚠️ Please provide a question.\n\nUsage: <code>/ask What is RSI?</code>');
    return;
  }

  await sendMessage(chatId, '🤔 Thinking...');

  try {
    const answer = await askCoach(question, { source: 'telegram' });
    
    // Check if Coach detected a support need
    const needsTicket = answer.includes('[SUPPORT_TICKET_NEEDED]');
    const cleanAnswer = answer.replace('[SUPPORT_TICKET_NEEDED]', '').trim();
    
    let message = `🤖 <b>Iron Strike Coach</b>\n\n${cleanAnswer}\n\n⚠️ <i>Educational purposes only. Not financial advice.</i>`;
    
    // Add support info if needed
    if (needsTicket) {
      message += `\n\n📋 <b>Need Help?</b>\nUse <code>/ticket Subject | Description</code> to create a support ticket.\n\n👉 <a href="${SUPPORT_PORTAL_URL}">Open Support Portal</a>`;
    }
    
    await sendMessage(chatId, message);
  } catch (error: any) {
    console.error('[Telegram /ask] Error:', error.message);
    await sendMessage(chatId, '❌ Iron Strike Coach is temporarily unavailable. Please try again.');
  }
}

async function handleStartCommand(chatId: number, firstName: string | undefined): Promise<void> {
  const greeting = firstName ? `Hello ${firstName}! ` : 'Hello! ';
  const message = `
${greeting}Welcome to <b>Iron Strike</b> ⚡

Your AI-powered options trading companion.

<b>Available Tools:</b>
• <code>/price AAPL</code> - Real-time Quotes
• <code>/chart AAPL</code> - Technical Charts
• <code>/analyze AAPL</code> - AI Analysis
• <code>/options AAPL</code> - Options Chain
• <code>/ask [question]</code> - AI Assistant
• <code>/help</code> - View all 50+ commands

👉 <a href="${FRONTEND_BASE_URL}">Visit Web App</a>
  `.trim();
  await sendMessage(chatId, message);
}

// --- 3. MAIN ROUTER & SECURITY ---

export async function processUpdate(update: any): Promise<void> {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name;
  const username = message.from?.username;
  const telegramUserId = message.from?.id;

  // Parse command
  const parts = text.split(/\s+/);
  const command = parts[0]?.toLowerCase(); // e.g. "/price"
  const argsRaw = parts.slice(1).join(' '); // e.g. "AAPL 150"
  const commandName = command.replace('/', '');

  // Only process actual commands
  if (!command.startsWith('/')) return;

  // --- SECURITY GUARD ---
  try {
    // 1. Check Cooldown
    const cooldownKey = String(chatId || telegramUserId || 'unknown');
    const cooldownCheck = checkCooldown(commandName, cooldownKey);
    if (!cooldownCheck.allowed) {
      await sendMessage(chatId, `⏳ Please wait ${cooldownCheck.remainingSeconds}s before using /${commandName} again.`);
      return;
    }

    // 2. Check Tier Access
    const user = await storage.getUserByTelegramId(String(chatId));
    const userId = user?.id; // Internal DB ID
    const userTier = normalizeTier(user?.role);
    const { isDeveloper } = await import('./config/env');
    const isAdmin = userId ? isDeveloper(userId) : false;

    const accessResult = checkCommandAccess(commandName, userTier, false, isAdmin);

    if (!accessResult.allowed) {
      const upgradeUrl = UPGRADE_URL_PRO; // Default to Pro upgrade link
      const msg = `🔒 <b>Premium Feature</b>\n\nThis command requires <b>${accessResult.requiredTier}</b>.\nYour tier: <b>${userTier}</b>\n\n👉 <a href="${upgradeUrl}">Upgrade Now</a>`;
      await sendMessage(chatId, msg);
      return;
    }

    // --- COMMAND SWITCH ---
    const symbol = parts[1]?.toUpperCase() || '';
    let result: handlers.CommandResult | null = null;

    switch (command) {
      // Core
      case '/start': await handleStartCommand(chatId, firstName); return;
      case '/help': result = handlers.handleHelpCommand(); break;
      case '/faq': result = handlers.handleFAQCommand(); break;
      case '/ticket':
        const ticketText = parts.slice(1).join(' ');
        const ticketParts = ticketText.split('|').map((s: string) => s.trim());
        const ticketSubject = ticketParts[0] || '';
        const ticketMessage = ticketParts[1] || ticketParts[0] || '';
        const ticketEmail = user?.email || '';
        result = await handlers.handleTicketCommand(ticketSubject, ticketMessage, ticketEmail, 'telegram', userId);
        break;
      case '/connect': 
        const connectUrl = `${FRONTEND_BASE_URL}/app/settings?telegram_chat_id=${chatId}`;
        result = { success:true, title:'🔗 Connect Account', description:'Link your Telegram to receive alerts.', links:[{label:'Connect Now', url:connectUrl}], color:'info' }; 
        break;

      // Basic Data
      case '/price': if(!symbol) { await sendMessage(chatId,'⚠️ Usage: /price AAPL'); return; } result = await handlers.handleQuoteCommand(symbol); break;
      case '/chart': if(!symbol) { await sendMessage(chatId,'⚠️ Usage: /chart AAPL'); return; } result = await handlers.handleChartCommand(symbol); break;
      case '/status': result = await handlers.handleStatusCommand(String(chatId)); break;
      case '/health': result = await handlers.handleHealthCommand(); break;

      // Technicals
      case '/rsi': if(!symbol) return; result = await handlers.handleRSICommand(symbol); break;
      case '/macd': if(!symbol) return; result = await handlers.handleMACDCommand(symbol); break;
      case '/ema': if(!symbol) return; result = await handlers.handleEMACommand(symbol); break;
      case '/sma': if(!symbol) return; result = await handlers.handleSMACommand(symbol); break;
      case '/vwap': if(!symbol) return; result = await handlers.handleVWAPCommand(symbol); break;
      case '/support': if(!symbol) return; result = await handlers.handleSupportCommand(symbol); break;
      case '/resistance': if(!symbol) return; result = await handlers.handleResistanceCommand(symbol); break;

      // Options
      case '/options': 
        if(!symbol) return; 
        // Safe fallback
        if ((handlers as any).handleOptionsCommand) result = await (handlers as any).handleOptionsCommand(symbol);
        else result = await handlers.handleQuoteCommand(symbol);
        break;
      case '/chain': if(!symbol) return; result = await handlers.handleChainCommand(symbol); break;
      case '/iv': if(!symbol) return; result = await handlers.handleIVCommand(symbol); break;
      case '/greeks': if(!symbol) return; result = await handlers.handleGreeksCommand(symbol); break;
      case '/maxpain': if(!symbol) return; result = await handlers.handleMaxPainCommand(symbol); break;
      case '/openinterest': if(!symbol) return; result = await handlers.handleOpenInterestCommand(symbol); break;

      // Strategy
      case '/signals': result = { success:true, title:'Premium Signals', description:'Get real-time AI signals.', links:[{label:'View Pricing', url:`${FRONTEND_BASE_URL}/pricing`}], color:'success' }; break;
      case '/signal': if(!symbol) return; result = await handlers.handleSignalCommand(symbol); break;
      case '/today': result = await handlers.handleTodayCommand(); break;
      case '/weekly': result = await handlers.handleWeeklyCommand(); break;
      case '/strategy': if(!symbol) return; result = await handlers.handleStrategyCommand(symbol); break;

      // Risk (Requires Parsing)
      case '/entry': if(!symbol) return; result = await handlers.handleEntryCommand(symbol); break;
      case '/risk': if(!symbol) return; result = await handlers.handleRiskCommand(symbol); break;
      case '/stoploss': {
        const entry = parseFloat(parts[2]);
        if(!symbol || isNaN(entry)) { await sendMessage(chatId,'⚠️ Usage: /stoploss AAPL 150'); return; }
        result = await handlers.handleStopLossCommand(symbol, entry); break;
      }
      case '/takeprofit': {
        const entry = parseFloat(parts[2]);
        if(!symbol || isNaN(entry)) { await sendMessage(chatId,'⚠️ Usage: /takeprofit AAPL 150'); return; }
        result = await handlers.handleTakeProfitCommand(symbol, entry); break;
      }
      case '/position': {
        const account = parseFloat(parts[1]);
        const risk = parseFloat(parts[2]);
        if(isNaN(account) || isNaN(risk)) { await sendMessage(chatId,'⚠️ Usage: /position 10000 2'); return; }
        result = await handlers.handlePositionCommand(account, risk); break;
      }

      // Portfolio
      case '/portfolio': result = await handlers.handlePortfolioCommand(userId); break;
      case '/positions': result = await handlers.handlePositionsCommand(userId); break;
      case '/pnl': result = await handlers.handlePnLCommand(userId); break;
      case '/winrate': result = await handlers.handleWinRateCommand(userId); break;
      case '/journal': result = await handlers.handleJournalCommand(userId); break;
      case '/history': result = await handlers.handleHistoryCommand(userId); break;
      case '/stats': result = await handlers.handleStatsCommand(userId); break;
      case '/drawdown': result = await handlers.handleDrawdownCommand(userId); break;
      case '/expectancy': result = await handlers.handleExpectancyCommand(userId); break;

      // AI
      case '/analyze': if(!symbol) return; result = await handlers.handleAnalyzeCommand(symbol); break;
      case '/sentiment': if(!symbol) return; result = await handlers.handleSentimentCommand(symbol); break;
      case '/bias': if(!symbol) return; result = await handlers.handleBiasCommand(symbol); break;
      case '/plan': if(!symbol) return; result = await handlers.handlePlanCommand(symbol); break;
      case '/explain': if(!argsRaw) return; result = await handlers.handleExplainCommand(argsRaw); break;
      case '/review': if(!argsRaw) return; result = await handlers.handleReviewCommand(argsRaw); break;
      case '/ask': await handleAskCommand(chatId, argsRaw); return;

      // Alerts
      case '/alerts': result = await handlers.handleAlertsCommand(userId); break;
      case '/alert': {
        const price = parseFloat(parts[2]);
        const condition = parts[3]?.toLowerCase(); // "above" or "below"
        if(!symbol || isNaN(price) || !condition) { await sendMessage(chatId, '⚠️ Usage: /alert AAPL 150 above'); return; }
        result = await handlers.handleAlertCommand(userId, symbol, price, condition);
        break;
      }

      default:
        // Silent ignore for unknown commands to prevent spam in groups
        if (message.chat.type === 'private') {
          await sendMessage(chatId, '❓ Unknown command. Use /help.');
        }
    }

    if (result) {
      await sendHandlerResult(chatId, result);
    }

  } catch (error) {
    console.error('[Telegram Bot] Processing Error:', error);
    await sendMessage(chatId, '⚠️ Internal Error');
  }
}

// --- 4. STARTUP LOGIC ---

async function pollUpdates(): Promise<void> {
  if (!pollingActive) return;

  try {
    const url = `${TELEGRAM_API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`[Telegram Bot] Polling error: ${response.status}`);
      setTimeout(pollUpdates, 5000);
      return;
    }

    const data = await response.json();

    if (data.ok && data.result && data.result.length > 0) {
      for (const update of data.result) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        await processUpdate(update);
      }
    }
    setImmediate(pollUpdates);
  } catch (error) {
    console.error('[Telegram Bot] Polling connection error:', error);
    setTimeout(pollUpdates, 5000);
  }
}

export async function startTelegramBot(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram Bot] No Token - skipping.');
    return;
  }

  if (process.env.DISABLE_TELEGRAM_BOT === 'true') return;

  // AWS DETECTION & FORCED POLLING
  const explicitPolling = process.env.TELEGRAM_USE_WEBHOOK === 'false';
  const isAWS = !!(process.env.ECS_CONTAINER_METADATA_URI || process.env.AWS_EXECUTION_ENV);
  const useWebhook = !explicitPolling && isAWS; // Default to webhook on AWS unless forced false

  if (useWebhook) {
    console.log('[Telegram Bot] Webhook Mode Active (Polling Disabled)');
    return;
  }

  try {
    console.log('[Telegram Bot] 🚀 Starting in POLLING mode (Worker Configuration)');

    // Register Commands Menu
    const commands = [
      { command: 'start', description: 'Main Menu' },
      { command: 'price', description: 'Get Quote' },
      { command: 'chart', description: 'View Chart' },
      { command: 'analyze', description: 'AI Analysis' },
      { command: 'options', description: 'Options Chain' },
      { command: 'ask', description: 'AI Assistant' },
      { command: 'portfolio', description: 'My Portfolio' },
      { command: 'alerts', description: 'Manage Alerts' },
      { command: 'help', description: 'All Commands' }
    ];

    await fetch(`${TELEGRAM_API_URL}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    });

    // Verify Login
    const meResponse = await fetch(`${TELEGRAM_API_URL}/getMe`);
    const meData = await meResponse.json();
    if (meData.ok) {
      console.log(`[Telegram Bot] Logged in as @${meData.result.username}`);
    }

    // Start Loop
    pollingActive = true;
    pollUpdates();

  } catch (error) {
    console.error('[Telegram Bot] Failed to start:', error);
  }
}

export async function stopTelegramBot(): Promise<void> {
  pollingActive = false;
  console.log('[Telegram Bot] Stopped');
}

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  return sendMessage(chatId, text);
}