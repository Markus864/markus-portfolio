/**
 * Iron Strike Discord Bot - FINAL PRODUCTION VERSION (Fixed)
 * Features:
 * - Full Command Parity (~50 Commands)
 * - Security Guard (Tiers & Cooldowns)
 * - "Brain" Delegation (Uses command-handlers.ts)
 * - Automatic Link Correction
 * - Exported Alert Functions (User & Webhook)
 */

import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  REST, 
  Routes, 
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  type ColorResolvable
} from 'discord.js';
import OpenAI from 'openai';
import * as handlers from './command-handlers';
import { 
  checkCommandAccess, 
  checkCooldown, 
  formatCooldownMessage, 
  formatUpgradeMessage 
} from './command-registry';
import { normalizeTier } from './tier';
import { storage } from './storage';
import { SUPPORT_PORTAL_URL, isSupportIssue, generateSupportGuidance } from '@shared/support-utils';
import { askCoach } from './ai/assistants';
import {
  startScanner,
  stopScanner,
  getScannerStatus,
  triggerManualScan,
  addToWatchlist,
  removeFromWatchlist,
} from './market-scanner';

// --- CONFIGURATION ---
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://www.ironstriketrading.com';

function isDiscordAdmin(userId: string): boolean {
  const ownerIds = process.env.DISCORD_OWNER_ID?.split(',').map(id => id.trim()) || [];
  if (ownerIds.length === 0) {
    console.warn('[Discord Bot] DISCORD_OWNER_ID not configured, admin commands disabled');
    return false;
  }
  return ownerIds.includes(userId);
}

const COLORS = {
  success: 0x00C805,
  error: 0xFF0000,
  warning: 0xFFA500,
  info: 0x3498DB,
  ai: 0x8B5CF6
};

let discordClient: Client;
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!openai && apiKey) {
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// --- 1. COMMAND REGISTRATION (The Big List) ---
const commands = [
  // === CORE ===
  new SlashCommandBuilder().setName('price').setDescription('Get real-time quote').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('chart').setDescription('Get technical chart').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('status').setDescription('Check your account status'),
  new SlashCommandBuilder().setName('health').setDescription('Check system health'),

  // === TECHNICALS ===
  new SlashCommandBuilder().setName('rsi').setDescription('Relative Strength Index').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('macd').setDescription('MACD Indicator').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('ema').setDescription('Exponential Moving Average').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('sma').setDescription('Simple Moving Average').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('vwap').setDescription('VWAP Indicator').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('support').setDescription('Support levels').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('resistance').setDescription('Resistance levels').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),

  // === OPTIONS & GREEKS ===
  new SlashCommandBuilder().setName('options').setDescription('Options Chain Summary').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('chain').setDescription('Detailed Options Chain').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('iv').setDescription('Implied Volatility').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('greeks').setDescription('Delta, Gamma, Theta, Vega').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('maxpain').setDescription('Max Pain Price').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('openinterest').setDescription('Open Interest').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),

  // === SIGNALS & STRATEGY ===
  new SlashCommandBuilder().setName('signals').setDescription('Premium Signals Info'),
  new SlashCommandBuilder().setName('today').setDescription('Today\'s Market Outlook'),
  new SlashCommandBuilder().setName('weekly').setDescription('Weekly Market Outlook'),
  new SlashCommandBuilder().setName('signal').setDescription('Latest signal for symbol').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('strategy').setDescription('Recommended Strategy').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),

  // === RISK MANAGEMENT ===
  new SlashCommandBuilder().setName('entry').setDescription('Calculate Entry Zone').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('risk').setDescription('Risk Analysis').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('stoploss').setDescription('Calculate Stop Loss')
    .addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true))
    .addNumberOption(o=>o.setName('entry').setDescription('Entry Price').setRequired(true)),
  new SlashCommandBuilder().setName('takeprofit').setDescription('Calculate Take Profit')
    .addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true))
    .addNumberOption(o=>o.setName('entry').setDescription('Entry Price').setRequired(true)),
  new SlashCommandBuilder().setName('position').setDescription('Position Sizing Calculator')
    .addNumberOption(o=>o.setName('account').setDescription('Account Size').setRequired(true))
    .addNumberOption(o=>o.setName('risk').setDescription('Risk % (e.g. 2)').setRequired(true)),

  // === PORTFOLIO ===
  new SlashCommandBuilder().setName('portfolio').setDescription('Portfolio Summary'),
  new SlashCommandBuilder().setName('positions').setDescription('Open Positions'),
  new SlashCommandBuilder().setName('pnl').setDescription('Profit & Loss'),
  new SlashCommandBuilder().setName('winrate').setDescription('Win Rate Stats'),
  new SlashCommandBuilder().setName('journal').setDescription('Trading Journal'),
  new SlashCommandBuilder().setName('history').setDescription('Trade History'),
  new SlashCommandBuilder().setName('stats').setDescription('Advanced Stats'),
  new SlashCommandBuilder().setName('drawdown').setDescription('Drawdown Analysis'),
  new SlashCommandBuilder().setName('expectancy').setDescription('Trade Expectancy'),

  // === AI & ANALYSIS ===
  new SlashCommandBuilder().setName('analyze').setDescription('AI Market Analysis').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('sentiment').setDescription('Market Sentiment').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('bias').setDescription('Daily Bias Analysis').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('plan').setDescription('Generate Trading Plan').addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('explain').setDescription('Explain a concept').addStringOption(o=>o.setName('topic').setDescription('Concept').setRequired(true)),
  new SlashCommandBuilder().setName('review').setDescription('Review a trade idea').addStringOption(o=>o.setName('idea').setDescription('Trade Details').setRequired(true)),
  new SlashCommandBuilder().setName('ask').setDescription('Ask AI Assistant').addStringOption(o=>o.setName('question').setDescription('Question').setRequired(true)),

  // === ALERTS ===
  new SlashCommandBuilder().setName('alerts').setDescription('List Active Alerts'),
  new SlashCommandBuilder().setName('alert').setDescription('Set Price Alert')
    .addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true))
    .addNumberOption(o=>o.setName('price').setDescription('Target Price').setRequired(true))
    .addStringOption(o=>o.setName('condition').setDescription('above/below').setRequired(true).addChoices({name:'Above',value:'above'},{name:'Below',value:'below'})),

  // === UTILS ===
  new SlashCommandBuilder().setName('connect').setDescription('Link Account'),
  new SlashCommandBuilder().setName('help').setDescription('Show Commands'),
  new SlashCommandBuilder().setName('faq').setDescription('Common questions & troubleshooting'),
  new SlashCommandBuilder().setName('ticket').setDescription('Submit a support ticket')
    .addStringOption(o=>o.setName('message').setDescription('Subject | Description (separated by |)').setRequired(true)),

  // === MARKET SCANNER (Admin) ===
  new SlashCommandBuilder().setName('scannerstart').setDescription('[Admin] Start market scanner'),
  new SlashCommandBuilder().setName('scannerstop').setDescription('[Admin] Stop market scanner'),
  new SlashCommandBuilder().setName('scannerstatus').setDescription('Check market scanner status'),
  new SlashCommandBuilder().setName('scannerscan').setDescription('[Admin] Trigger manual market scan'),
  new SlashCommandBuilder().setName('scanneradd').setDescription('[Admin] Add symbol to scanner watchlist')
    .addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),
  new SlashCommandBuilder().setName('scannerremove').setDescription('[Admin] Remove symbol from scanner watchlist')
    .addStringOption(o=>o.setName('symbol').setDescription('Ticker').setRequired(true)),

  // === ADMIN UTILITIES ===
  new SlashCommandBuilder().setName('setupsupport').setDescription('[Admin] Post the support portal panel'),
];

async function registerCommands() {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) return;
  const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);
  try {
    console.log(`[Discord Bot] Registering ${commands.length} commands...`);
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
    console.log('[Discord Bot] Commands registered successfully.');
  } catch (error) {
    console.error('[Discord Bot] Registration failed:', error);
  }
}

// --- 2. HELPER: FORMATTER ---
async function sendHandlerResult(interaction: ChatInputCommandInteraction, result: handlers.CommandResult) {
  const colorHex = COLORS[result.color as keyof typeof COLORS] || COLORS.info;

  const embed = new EmbedBuilder()
    .setTitle(result.title)
    .setDescription(result.description || '')
    .setColor(colorHex as ColorResolvable);

  if (result.fields) {
    result.fields.forEach(f => {
      embed.addFields({ name: f.name, value: f.value, inline: f.inline ?? true });
    });
  }

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (result.links && result.links.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    result.links.forEach((link) => {
      let url = link.url;
      // Fix relative URLs
      if (url.startsWith('/')) {
        url = `${FRONTEND_BASE_URL}${url}`;
      }
      // Fix Chart URL (Redirect to Dashboard Charts)
      if (link.label.includes("Chart") && url.includes("/app/chart")) {
        url = url.replace("/app/chart", "/app/charts"); 
      }
      row.addComponents(new ButtonBuilder().setLabel(link.label).setURL(url).setStyle(ButtonStyle.Link));
    });
    rows.push(row);
  }

  embed.setFooter({ text: 'Iron Strike Trading • Not Financial Advice' });
  embed.setTimestamp();
  await interaction.editReply({ embeds: [embed], components: rows });
}

// --- 3. SPECIAL HANDLER: ASK AI (Uses Iron Strike Coach Assistant) ---
async function handleAskCommand(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString('question');
  if (!question) return;

  try {
    const answer = await askCoach(question, { source: 'discord' });
    
    // Check if Coach detected a support need
    const needsTicket = answer.includes('[SUPPORT_TICKET_NEEDED]');
    const cleanAnswer = answer.replace('[SUPPORT_TICKET_NEEDED]', '').trim();
    
    const embed = new EmbedBuilder()
      .setTitle('🤖 Iron Strike Coach')
      .setDescription(cleanAnswer.substring(0, 4000))
      .setColor(COLORS.ai as ColorResolvable)
      .setFooter({ text: 'Not Financial Advice' });
    
    // Add support ticket button if needed
    if (needsTicket) {
      embed.addFields({ 
        name: '📋 Need Help?', 
        value: 'Use `/ticket Subject | Description` to create a support ticket, or visit our support portal.',
        inline: false 
      });
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Open Support Portal')
          .setURL(SUPPORT_PORTAL_URL)
          .setStyle(ButtonStyle.Link)
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed] });
    }
  } catch (error: any) {
    console.error('[Discord /ask] Error:', error.message);
    await interaction.editReply('❌ Iron Strike Coach is temporarily unavailable. Please try again.');
  }
}

// --- 4. MAIN ROUTER & SECURITY ---

// Helper to safely execute a command handler with timeout protection
async function safeExecuteHandler<T>(
  handler: () => Promise<T>,
  commandName: string,
  timeoutMs: number = 25000
): Promise<T | null> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`[Discord Bot] Command ${commandName} timed out after ${timeoutMs}ms`);
        resolve(null); // Resolve with null instead of rejecting to avoid unhandled rejections
      }, timeoutMs);
    });
    
    const result = await Promise.race([handler(), timeoutPromise]);
    
    // Clear timeout if handler resolved first
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    return result;
  } catch (error: any) {
    // Clear timeout on error as well
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    console.error(`[Discord Bot] Handler error for ${commandName}:`, error.message || error);
    return null;
  }
}

async function handleInteraction(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;
  const startTime = Date.now();
  
  // Wrap deferReply in try-catch to handle expired interactions
  try {
    await interaction.deferReply();
  } catch (error: any) {
    // Interaction expired or unknown - silently ignore
    if (error.code === 10062 || error.code === 'InteractionAlreadyReplied') {
      console.warn(`[Discord Bot] Interaction expired for command: ${commandName}`);
      return;
    }
    console.error(`[Discord Bot] Failed to defer reply for ${commandName}:`, error.message);
    return;
  }

  try {
    // --- SECURITY GUARD ---
    const discordId = interaction.user.id;
    let user = null;
    try {
        user = await storage.getUserByDiscordId(discordId);
    } catch (e) { 
      console.warn('[Discord Bot] User lookup failed, assuming free tier'); 
    }

    const userTier = normalizeTier(user?.role);
    const isAdmin = user ? (user.role === 'admin') : false;

    // Check Cooldowns
    const cooldownCheck = checkCooldown(commandName, discordId);
    if (!cooldownCheck.allowed) {
      await interaction.editReply({ content: formatCooldownMessage(cooldownCheck.remainingSeconds || 0) });
      return;
    }

    // Check Tier Access
    const accessCheck = checkCommandAccess(commandName, userTier, false, isAdmin);
    if (!accessCheck.allowed) {
      const upgradeMsg = formatUpgradeMessage(accessCheck);
      const embed = new EmbedBuilder().setTitle('🔒 Premium Feature').setDescription(upgradeMsg).setColor(COLORS.warning as ColorResolvable);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel('Upgrade Now').setURL(`${FRONTEND_BASE_URL}/pricing`).setStyle(ButtonStyle.Link));
      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }
    // --- END SECURITY GUARD ---

    const symbol = interaction.options.getString('symbol')?.toUpperCase() || '';
    const userId = user?.id; // Pass internal DB ID to handlers

    // Map commands to handlers
    let result: handlers.CommandResult | null = null;

    switch (commandName) {
      // Core
      case 'price': 
        result = await safeExecuteHandler(() => handlers.handleQuoteCommand(symbol), commandName); 
        break;
      case 'chart': 
        result = await safeExecuteHandler(() => handlers.handleChartCommand(symbol), commandName); 
        break;
      case 'status': 
        result = await safeExecuteHandler(() => handlers.handleStatusCommand(userId || ''), commandName); 
        break;
      case 'health': 
        result = await safeExecuteHandler(() => handlers.handleHealthCommand(), commandName); 
        break;

      // Market Data
      // Technicals
      case 'rsi': 
        result = await safeExecuteHandler(() => handlers.handleRSICommand(symbol), commandName); 
        break;
      case 'macd': 
        result = await safeExecuteHandler(() => handlers.handleMACDCommand(symbol), commandName); 
        break;
      case 'ema': 
        result = await safeExecuteHandler(() => handlers.handleEMACommand(symbol), commandName); 
        break;
      case 'sma': 
        result = await safeExecuteHandler(() => handlers.handleSMACommand(symbol), commandName); 
        break;
      case 'vwap': 
        result = await safeExecuteHandler(() => handlers.handleVWAPCommand(symbol), commandName); 
        break;
      case 'support': 
        result = await safeExecuteHandler(() => handlers.handleSupportCommand(symbol), commandName); 
        break;
      case 'resistance': 
        result = await safeExecuteHandler(() => handlers.handleResistanceCommand(symbol), commandName); 
        break;

      // Options
      case 'options': 
        if ((handlers as any).handleOptionsCommand) {
          result = await safeExecuteHandler(() => (handlers as any).handleOptionsCommand(symbol), commandName);
        } else {
          result = await safeExecuteHandler(() => handlers.handleQuoteCommand(symbol), commandName);
        }
        break;
      case 'chain': 
        result = await safeExecuteHandler(() => handlers.handleChainCommand(symbol), commandName); 
        break;
      case 'iv': 
        result = await safeExecuteHandler(() => handlers.handleIVCommand(symbol), commandName); 
        break;
      case 'greeks': 
        result = await safeExecuteHandler(() => handlers.handleGreeksCommand(symbol), commandName); 
        break;
      case 'maxpain': 
        result = await safeExecuteHandler(() => handlers.handleMaxPainCommand(symbol), commandName); 
        break;
      case 'openinterest': 
        result = await safeExecuteHandler(() => handlers.handleOpenInterestCommand(symbol), commandName); 
        break;

      // Strategy
      case 'signals': 
        result = { success:true, title:'Premium Signals', description:'Visit Dashboard', links:[{label:'View',url:'/pricing'}] }; 
        break; 
      case 'signal': 
        result = await safeExecuteHandler(() => handlers.handleSignalCommand(symbol), commandName); 
        break;
      case 'today': 
        result = await safeExecuteHandler(() => handlers.handleTodayCommand(), commandName); 
        break;
      case 'weekly': 
        result = await safeExecuteHandler(() => handlers.handleWeeklyCommand(), commandName); 
        break;
      case 'strategy': 
        result = await safeExecuteHandler(() => handlers.handleStrategyCommand(symbol), commandName); 
        break;

      // Risk
      case 'entry': 
        result = await safeExecuteHandler(() => handlers.handleEntryCommand(symbol), commandName); 
        break;
      case 'risk': 
        result = await safeExecuteHandler(() => handlers.handleRiskCommand(symbol), commandName); 
        break;
      case 'stoploss': 
        result = await safeExecuteHandler(
          () => handlers.handleStopLossCommand(symbol, interaction.options.getNumber('entry')!), 
          commandName
        ); 
        break;
      case 'takeprofit': 
        result = await safeExecuteHandler(
          () => handlers.handleTakeProfitCommand(symbol, interaction.options.getNumber('entry')!), 
          commandName
        ); 
        break;
      case 'position': 
        result = await safeExecuteHandler(
          () => handlers.handlePositionCommand(interaction.options.getNumber('account')!, interaction.options.getNumber('risk')!), 
          commandName
        ); 
        break;

      // Portfolio
      case 'portfolio': 
        result = await safeExecuteHandler(() => handlers.handlePortfolioCommand(userId), commandName); 
        break;
      case 'positions': 
        result = await safeExecuteHandler(() => handlers.handlePositionsCommand(userId), commandName); 
        break;
      case 'pnl': 
        result = await safeExecuteHandler(() => handlers.handlePnLCommand(userId), commandName); 
        break;
      case 'winrate': 
        result = await safeExecuteHandler(() => handlers.handleWinRateCommand(userId), commandName); 
        break;
      case 'journal': 
        result = await safeExecuteHandler(() => handlers.handleJournalCommand(userId), commandName); 
        break;
      case 'history': 
        result = await safeExecuteHandler(() => handlers.handleHistoryCommand(userId), commandName); 
        break;
      case 'stats': 
        result = await safeExecuteHandler(() => handlers.handleStatsCommand(userId), commandName); 
        break;
      case 'drawdown': 
        result = await safeExecuteHandler(() => handlers.handleDrawdownCommand(userId), commandName); 
        break;
      case 'expectancy': 
        result = await safeExecuteHandler(() => handlers.handleExpectancyCommand(userId), commandName); 
        break;

      // AI
      case 'analyze': 
        result = await safeExecuteHandler(() => handlers.handleAnalyzeCommand(symbol), commandName, 30000); 
        break;
      case 'sentiment': 
        result = await safeExecuteHandler(() => handlers.handleSentimentCommand(symbol), commandName); 
        break;
      case 'bias': 
        result = await safeExecuteHandler(() => handlers.handleBiasCommand(symbol), commandName); 
        break;
      case 'plan': 
        result = await safeExecuteHandler(() => handlers.handlePlanCommand(symbol), commandName); 
        break;
      case 'explain': 
        result = await safeExecuteHandler(
          () => handlers.handleExplainCommand(interaction.options.getString('topic')!), 
          commandName, 
          30000
        ); 
        break;
      case 'review': 
        result = await safeExecuteHandler(
          () => handlers.handleReviewCommand(interaction.options.getString('idea')!), 
          commandName, 
          30000
        ); 
        break;
      case 'ask': 
        await handleAskCommand(interaction); 
        return; 

      // Alerts
      case 'alerts': 
        result = await safeExecuteHandler(() => handlers.handleAlertsCommand(userId), commandName); 
        break;
      case 'alert': 
        result = await safeExecuteHandler(
          () => handlers.handleAlertCommand(
            userId, 
            symbol, 
            interaction.options.getNumber('price')!, 
            interaction.options.getString('condition')!
          ), 
          commandName
        ); 
        break;

      // Utils
      case 'connect': 
        const url = `${FRONTEND_BASE_URL}/app/settings?discord_user_id=${interaction.user.id}`;
        result = { success:true, title:'Link Account', description:'Click below to link.', links:[{label:'Connect',url}] };
        break;
      case 'help': 
        result = handlers.handleHelpCommand();
        break;
      case 'faq':
        result = handlers.handleFAQCommand();
        break;
      case 'ticket':
        const ticketInput = interaction.options.getString('message') || '';
        const ticketParts = ticketInput.split('|').map(s => s.trim());
        const ticketSubject = ticketParts[0] || '';
        const ticketMessage = ticketParts[1] || ticketParts[0] || '';
        const ticketUserEmail = user?.email || '';
        result = await safeExecuteHandler(
          () => handlers.handleTicketCommand(ticketSubject, ticketMessage, ticketUserEmail, 'discord', interaction.user.id), 
          commandName
        );
        break;

      // Market Scanner Commands
      case 'scannerstart':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can control the scanner.', color: 'error' };
        } else {
          startScanner();
          result = { success: true, title: '🚀 Scanner Started', description: 'The market scanner is now running and will send alerts when conditions are met.', color: 'success' };
        }
        break;
      case 'scannerstop':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can control the scanner.', color: 'error' };
        } else {
          stopScanner();
          result = { success: true, title: '⏹️ Scanner Stopped', description: 'The market scanner has been stopped.', color: 'success' };
        }
        break;
      case 'scannerstatus':
        const scannerStatusData = getScannerStatus();
        result = {
          success: true,
          title: '📊 Scanner Status',
          description: scannerStatusData.enabled ? '🟢 Scanner is **RUNNING**' : '🔴 Scanner is **STOPPED**',
          fields: [
            { name: 'Watchlist', value: scannerStatusData.watchlist.join(', ') || 'None', inline: false },
            { name: 'Scan Interval', value: `${Math.round(scannerStatusData.scanIntervalMs / 1000)}s`, inline: true },
            { name: 'Recent Alerts', value: scannerStatusData.lastAlerts.length.toString(), inline: true },
          ],
          color: 'info'
        };
        break;
      case 'scannerscan':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can trigger scans.', color: 'error' };
        } else {
          const scanAlerts = await triggerManualScan();
          if (scanAlerts.length === 0) {
            result = { success: true, title: '📊 Scan Complete', description: 'No alerts triggered. Market conditions are within normal range.', color: 'info' };
          } else {
            result = { 
              success: true, 
              title: `🚨 ${scanAlerts.length} Alert(s) Found`, 
              description: scanAlerts.map(a => `**${a.symbol}**: ${a.changePercent >= 0 ? '+' : ''}${a.changePercent.toFixed(2)}%`).join('\n'), 
              color: 'warning' 
            };
          }
        }
        break;
      case 'scanneradd':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can modify the watchlist.', color: 'error' };
        } else {
          const addSymbol = interaction.options.getString('symbol')?.toUpperCase() || '';
          addToWatchlist(addSymbol);
          result = { success: true, title: '➕ Symbol Added', description: `**${addSymbol}** has been added to the scanner watchlist.`, color: 'success' };
        }
        break;
      case 'scannerremove':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can modify the watchlist.', color: 'error' };
        } else {
          const removeSymbol = interaction.options.getString('symbol')?.toUpperCase() || '';
          removeFromWatchlist(removeSymbol);
          result = { success: true, title: '➖ Symbol Removed', description: `**${removeSymbol}** has been removed from the scanner watchlist.`, color: 'success' };
        }
        break;

      // === ADMIN: Setup Support Panel ===
      case 'setupsupport':
        if (!isDiscordAdmin(interaction.user.id)) {
          result = { success: false, title: '🔒 Admin Only', description: 'Only administrators can post support panels.', color: 'error' };
        } else {
          const supportEmbed = new EmbedBuilder()
            .setTitle('🎫 Iron Strike Support Portal')
            .setDescription(
              "**Need help with your subscription, the bot, or the community?**\n\n" +
              "We use a dedicated portal to ensure no request gets lost.\n" +
              "Click the button below to open a ticket directly with our staff."
            )
            .setColor(COLORS.success as ColorResolvable)
            .setFooter({ text: 'Iron Strike Trading • Support Team' });

          const supportRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('Open Support Ticket')
              .setURL('https://ironstriketrading.freshdesk.com/widgets/feedback_widget/new?&widgetType=embedded')
              .setStyle(ButtonStyle.Link)
          );

          // Send to channel and delete the command reply so only the panel remains
          if (interaction.channel && 'send' in interaction.channel) {
            await interaction.channel.send({ embeds: [supportEmbed], components: [supportRow] });
            await interaction.deleteReply();
          } else {
            await interaction.editReply({ embeds: [supportEmbed], components: [supportRow] });
          }
          return; // Early return since we handled the reply
        }
        break;

      default: 
        await interaction.editReply('Unknown command.'); 
        return;
    }

    // Handle null result from timeout or error
    if (result === null) {
      result = {
        success: false,
        title: '⚠️ Command Failed',
        description: 'The command could not be completed. Please try again in a moment.',
        color: 'error',
        links: [{ label: '📋 Report Issue', url: `${FRONTEND_BASE_URL}/support` }]
      };
    }

    await sendHandlerResult(interaction, result);
    
    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      console.log(`[Discord Bot] Slow command: ${commandName} took ${elapsed}ms`);
    }

  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Discord Bot] Error in ${commandName} after ${elapsed}ms:`, error.message || error);
    console.error(`[Discord Bot] Full error stack:`, error.stack || 'No stack trace');
    
    // Try to send error response, but handle case where interaction is already replied/expired
    try {
      await interaction.editReply(`⚠️ Something went wrong processing /${commandName}. Please try again.`);
    } catch (replyError: any) {
      // Interaction may have expired or already been replied to
      if (replyError.code !== 10062 && replyError.code !== 'InteractionAlreadyReplied') {
        console.error(`[Discord Bot] Failed to send error reply:`, replyError.message);
      }
    }
  }
}

// --- 5. ROLE SYNCHRONIZATION (The Bridge) ---
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const ROLE_IDS = {
  PRO: process.env.DISCORD_ROLE_PRO_ID,       // The ID for 'Strike Team'
  PREMIUM: process.env.DISCORD_ROLE_PREMIUM_ID // The ID for 'Iron Council'
};

/**
 * PUSH: Called by Stripe Webhook when user pays on Website.
 * Assigns the correct Discord Role to the user.
 */
export async function assignUserRole(discordUserId: string, tier: 'pro' | 'premium' | 'free', retryCount = 0) {
  if (!GUILD_ID) {
    // GUILD_ID not configured - role sync is disabled (expected in dev)
    return;
  }
  
  if (!discordClient?.isReady()) {
    // Bot still connecting - retry up to 3 times with increasing delay
    if (retryCount < 3) {
      const delay = (retryCount + 1) * 5000; // 5s, 10s, 15s
      console.log(`[Role Sync] Bot not ready - will retry in ${delay / 1000}s (attempt ${retryCount + 1}/3)`);
      setTimeout(() => assignUserRole(discordUserId, tier, retryCount + 1), delay);
      return;
    }
    console.warn(`[Role Sync] Bot still not ready after 3 retries - ${tier} role for ${discordUserId} may need manual sync.`);
    return;
  }
  
  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordUserId);
    if (!member) {
      console.log(`[Role Sync] Member ${discordUserId} not found in guild`);
      return;
    }

    // Remove old roles first (to prevent double tiers)
    if (ROLE_IDS.PRO) await member.roles.remove(ROLE_IDS.PRO).catch(() => {});
    if (ROLE_IDS.PREMIUM) await member.roles.remove(ROLE_IDS.PREMIUM).catch(() => {});

    // Add new role
    if (tier === 'pro' && ROLE_IDS.PRO) {
      await member.roles.add(ROLE_IDS.PRO);
      console.log(`[Role Sync] Assigned STRIKE TEAM to ${member.user.tag}`);
    } else if (tier === 'premium' && ROLE_IDS.PREMIUM) {
      await member.roles.add(ROLE_IDS.PREMIUM);
      console.log(`[Role Sync] Assigned IRON COUNCIL to ${member.user.tag}`);
    } else if (tier === 'free') {
      console.log(`[Role Sync] Removed paid roles from ${member.user.tag}`);
    }
  } catch (error) {
    console.error(`[Role Sync] Failed to assign role:`, error);
  }
}

/**
 * PULL: Listen for Role updates in Discord (e.g. User pays via MEE6/Discord).
 * Updates the Website Database to match.
 */
function startRoleListener() {
  if (!GUILD_ID) {
    console.log('[Role Sync] DISCORD_GUILD_ID not configured - role listener disabled');
    return;
  }
  if (!ROLE_IDS.PRO && !ROLE_IDS.PREMIUM) {
    console.log('[Role Sync] No role IDs configured - role listener disabled');
    return;
  }
  
  discordClient.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    // Skip if roles didn't actually change
    if (oldMember.roles.cache.size === newMember.roles.cache.size) {
      const oldIds = Array.from(oldMember.roles.cache.keys()).sort().join(',');
      const newIds = Array.from(newMember.roles.cache.keys()).sort().join(',');
      if (oldIds === newIds) return;
    }
    
    const newRoles = newMember.roles.cache;
    
    // Determine current tier based on roles (Premium > Pro > Free)
    let tier: 'free' | 'pro' | 'premium' = 'free';
    if (ROLE_IDS.PREMIUM && newRoles.has(ROLE_IDS.PREMIUM)) tier = 'premium';
    else if (ROLE_IDS.PRO && newRoles.has(ROLE_IDS.PRO)) tier = 'pro';

    try {
      const user = await storage.getUserByDiscordId(newMember.id);
      if (user && user.role !== tier) {
        console.log(`[Sync Down] User ${user.email || user.id} has role ${tier} in Discord. Syncing DB...`);
        await storage.upsertUser({ ...user, role: tier });
      }
    } catch (e) {
      console.error('[Sync Down] Error syncing role to DB', e);
    }
  });
  
  console.log('[Role Sync] Role listener started - watching for Discord role changes');
}

// --- 6. STARTUP ---
export async function startDiscordBot() {
  if (!DISCORD_BOT_TOKEN) return console.warn('[Discord] No Token');
  if (process.env.DISABLE_BOTS === 'true') return;

  const ownerIds = process.env.DISCORD_OWNER_ID?.split(',').map(id => id.trim()).filter(Boolean) || [];
  if (ownerIds.length === 0) {
    console.warn('[Discord Bot] WARNING: DISCORD_OWNER_ID not configured - admin commands will be disabled');
  } else {
    console.log(`[Discord Bot] Configured with ${ownerIds.length} admin(s)`);
  }

  discordClient = new Client({ 
    intents: [
      GatewayIntentBits.Guilds, 
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMembers // Required for role sync
    ] 
  });
  discordClient.once(Events.ClientReady, async (c) => {
    console.log(`[Discord] Logged in as ${c.user.tag}`);
    await registerCommands();
    startRoleListener(); // Start listening for Discord role changes
  });
  discordClient.on(Events.InteractionCreate, async (i) => {
    if (i.isChatInputCommand()) await handleInteraction(i);
  });
  await discordClient.login(DISCORD_BOT_TOKEN);
}

// Exported for Alerts Service
export async function sendUserAlert(discordUserId: string, message: string, title: string = "Alert"): Promise<boolean> {
  if (!discordClient?.isReady()) return false;
  try {
    const user = await discordClient.users.fetch(discordUserId);
    await user.send({ embeds: [{ title, description: message, color: COLORS.success, timestamp: new Date().toISOString() }] });
    return true;
  } catch (e) { return false; }
}

export async function sendWebhookAlert(webhookUrl: string, message: string, title: string = "Alert"): Promise<boolean> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title,
          description: message,
          color: COLORS.success,
          timestamp: new Date().toISOString()
        }]
      })
    });
    return true;
  } catch (e) {
    console.error('[Discord] Webhook failed', e);
    return false;
  }
}

// --- 6. MONETIZATION: TEASER ALERTS ---
export async function sendTeaserAlert(channelId: string, signal: { direction: string; confidence: number; action: string }): Promise<boolean> {
  if (!discordClient?.isReady()) return false;

  try {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !('send' in channel)) return false;

    const confidencePercent = Math.round(signal.confidence * 100);
    const confidenceLabel = confidencePercent >= 90 ? '🔥 Very High' : confidencePercent >= 80 ? '⚡ High' : '📈 Moderate';

    const teaserEmbed = new EmbedBuilder()
      .setTitle(`🚨 High Confidence Signal Detected`)
      .setDescription(`The Iron Strike Algo just flagged a **${signal.direction}** setup on a Major Ticker.`)
      .addFields(
        { name: 'Confidence', value: `${confidenceLabel} (${confidencePercent}%)`, inline: true },
        { name: 'Ticker', value: '🔒 **[LOCKED]**', inline: true },
        { name: 'Entry Zone', value: '🔒 **[LOCKED]**', inline: true },
        { name: 'Profit Target', value: '🚀 +25% Potential', inline: true }
      )
      .setColor(0xFFD700) // Gold color
      .setFooter({ text: 'Upgrade to Strike Team to see this ticker instantly.' })
      .setTimestamp();

    const upgradeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('🔓 Unlock Signal')
        .setURL(`${FRONTEND_BASE_URL}/pricing`)
        .setStyle(ButtonStyle.Link)
    );

    await channel.send({ embeds: [teaserEmbed], components: [upgradeRow] });
    console.log(`[Discord Bot] Teaser alert sent for ${signal.direction} signal`);
    return true;
  } catch (error) {
    console.error('[Discord Bot] Failed to send teaser:', error);
    return false;
  }
}