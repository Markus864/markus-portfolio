// Storage interface for AI Trading Assistant
import { db } from "./db";
import { formatTicketNumber } from "@shared/support-utils";
import { 
  signalHistory, 
  InsertSignalHistory, 
  SelectSignalHistory,
  tradeExecutions,
  InsertTradeExecution,
  SelectTradeExecution,
  PerformanceMetrics,
  tradingStrategies,
  InsertTradingStrategy,
  SelectTradingStrategy,
  Strategy,
  ConditionGroup,
  tradeJournalEntries,
  InsertTradeJournalEntry,
  SelectTradeJournalEntry,
  PortfolioSummary,
  signalOutcomes,
  InsertSignalOutcome,
  SelectSignalOutcome,
  watchlist,
  InsertWatchlist,
  SelectWatchlist,
  priceAlerts,
  InsertPriceAlert,
  SelectPriceAlert,
  supportTickets,
  InsertSupportTicket,
  SelectSupportTicket,
  users,
  User,
  UpsertUser,
  imports,
  InsertImport,
  SelectImport
} from "@shared/schema";
import { desc, eq, isNull, isNotNull, sql, and } from "drizzle-orm";
import { getQuote, getMultipleQuotes, getHistoricalData, MarketQuote, HistoricalDataPoint } from "./market-data-service";

// Custom validation error class for 400 responses
export class ValidationError extends Error {
  public statusCode: number = 400;
  public field?: string;
  
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export interface IStorage {
  // Market data methods (now using real Yahoo Finance data)
  getLatestPrice(symbol: string): Promise<number>;
  getQuote(symbol: string): Promise<MarketQuote>;
  getMultipleQuotes(symbols: string[]): Promise<MarketQuote[]>;
  getHistoricalData(symbol: string, period?: string, interval?: string): Promise<HistoricalDataPoint[]>;
  
  // Signal history methods
  saveSignalHistory(signal: InsertSignalHistory): Promise<SelectSignalHistory>;
  getAllSignalHistory(): Promise<SelectSignalHistory[]>;
  getUserSignalHistory(userId: string): Promise<SelectSignalHistory[]>;
  getSignalHistoryBySymbol(symbol: string): Promise<SelectSignalHistory[]>;
  
  // Trade execution methods (options-based)
  executeTrade(trade: InsertTradeExecution): Promise<SelectTradeExecution>;
  createManualTrade(trade: InsertTradeExecution): Promise<SelectTradeExecution>;
  closeTrade(id: number, exitPremium: number, notes?: string, entryPremium?: number): Promise<SelectTradeExecution>;
  updateTradeJournal(id: number, updates: { strategyTag?: string; tagList?: string[]; sessionTag?: string; emotionalState?: string; whatWentWell?: string; whatWentWrong?: string; lessonLearned?: string; screenshotUrl?: string; notes?: string; plannedRiskPerTrade?: string | number; plannedStopPrice?: string | number; plannedTakeProfitPrice?: string | number }): Promise<SelectTradeExecution>;
  getAllTrades(): Promise<SelectTradeExecution[]>;
  getTradesWithFilters(filters: { symbol?: string; status?: string; source?: string; strategyTag?: string; from?: string; to?: string; userId?: string }): Promise<SelectTradeExecution[]>;
  getOpenTrades(): Promise<SelectTradeExecution[]>;
  getClosedTrades(): Promise<SelectTradeExecution[]>;
  getUserOpenTrades(userId: string): Promise<SelectTradeExecution[]>;
  getUserClosedTrades(userId: string): Promise<SelectTradeExecution[]>;
  getTradeById(id: number): Promise<SelectTradeExecution | undefined>;
  deleteTrade(id: number): Promise<void>;
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
  getUserTrades(userId: string): Promise<SelectTradeExecution[]>;
  
  // Trading strategy methods
  createStrategy(strategy: Strategy): Promise<SelectTradingStrategy>;
  updateStrategy(id: number, strategy: Partial<Strategy>): Promise<SelectTradingStrategy>;
  deleteStrategy(id: number): Promise<void>;
  getAllStrategies(): Promise<SelectTradingStrategy[]>;
  getStrategyById(id: number): Promise<SelectTradingStrategy | undefined>;
  getEnabledStrategies(): Promise<SelectTradingStrategy[]>;
  
  // Trade journal methods
  createJournalEntry(entry: InsertTradeJournalEntry): Promise<SelectTradeJournalEntry>;
  getJournalEntriesForTrade(tradeId: number): Promise<SelectTradeJournalEntry[]>;
  getJournalEntriesForTradeWithOwnerCheck(tradeId: number, userId: string): Promise<SelectTradeJournalEntry[]>;
  getAllJournalEntries(): Promise<SelectTradeJournalEntry[]>;
  getUserJournalEntries(userId: string): Promise<SelectTradeJournalEntry[]>;
  deleteJournalEntry(id: number): Promise<void>;
  
  // Portfolio methods
  getPortfolioSummary(): Promise<PortfolioSummary>;
  
  // Adaptive learning / signal outcomes methods
  createSignalOutcome(outcome: InsertSignalOutcome): Promise<SelectSignalOutcome>;
  getSignalOutcomes(symbol: string): Promise<SelectSignalOutcome[]>;
  getSignalOutcomeById(id: number): Promise<SelectSignalOutcome | undefined>;
  updateSignalOutcome(id: number, updates: Partial<SelectSignalOutcome>): Promise<SelectSignalOutcome | undefined>;
  getDistinctSymbolsFromOutcomes(): Promise<string[]>;
  
  // Watchlist methods
  getUserWatchlist(userId: string): Promise<SelectWatchlist[]>;
  addToWatchlist(symbol: string, userId: string): Promise<SelectWatchlist>;
  removeFromWatchlist(id: number, userId: string): Promise<void>;
  
  // Price alerts methods
  getAlerts(): Promise<SelectPriceAlert[]>;
  getUserAlerts(userId: string): Promise<SelectPriceAlert[]>;
  getUserAlertCount(userId: string): Promise<number>;
  createAlert(alert: { name?: string; symbol: string; targetPrice: number; condition: string; userId?: string; notifyEmail?: boolean; notifyTelegram?: boolean; notifyDiscord?: boolean }): Promise<SelectPriceAlert>;
  checkDuplicateAlert(userId: string, symbol: string, targetPrice: number, condition: string, excludeAlertId?: number): Promise<boolean>;
  deleteAlert(id: number): Promise<void>;
  markAlertTriggered(id: number): Promise<void>;
  updateAlert(id: number, updates: { name?: string | null; symbol?: string; targetPrice?: number; condition?: string; notifyEmail?: boolean; notifyTelegram?: boolean; notifyDiscord?: boolean; status?: string }): Promise<SelectPriceAlert>;
  toggleAlertStatus(id: number): Promise<SelectPriceAlert>;
  
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  getUserByTelegramId(telegramChatId: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Imports (screenshot parsing provenance)
  createImport(data: InsertImport): Promise<SelectImport>;
  
  // Support tickets methods
  createTicket(ticket: { email: string; name?: string; subject: string; message: string; priority?: string; channel?: string; userId?: string }): Promise<SelectSupportTicket>;
  getTickets(filters?: { status?: string; priority?: string; channel?: string }): Promise<SelectSupportTicket[]>;
  getTicketById(id: number): Promise<SelectSupportTicket | undefined>;
  getTicketByNumber(ticketNumber: string): Promise<SelectSupportTicket | undefined>;
  updateTicket(id: number, updates: { status?: string; priority?: string; assignedTo?: string | null }): Promise<SelectSupportTicket>;
  getUserTickets(userId: string): Promise<SelectSupportTicket[]>;
}

export class MemStorage implements IStorage {
  private useRealData: boolean = true;

  constructor() {}

  async getLatestPrice(symbol: string): Promise<number> {
    if (this.useRealData) {
      try {
        const quote = await getQuote(symbol);
        return quote.price;
      } catch (error) {
        console.warn(`Failed to get real price for ${symbol}, falling back to mock data`);
        return this.getMockPrice(symbol);
      }
    }
    return this.getMockPrice(symbol);
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    return await getQuote(symbol);
  }

  async getMultipleQuotes(symbols: string[]): Promise<MarketQuote[]> {
    return await getMultipleQuotes(symbols);
  }

  async getHistoricalData(symbol: string, period: string = "1mo", interval?: string): Promise<HistoricalDataPoint[]> {
    return await getHistoricalData(symbol, period as any, interval as any);
  }

  private getMockPrice(symbol: string): number {
    const hash = this.hashSymbol(symbol);
    const basePrice = 10 + (hash % 500);
    const volatility = 1 + (Math.random() - 0.5) * 0.04;
    return Number((basePrice * volatility).toFixed(2));
  }

  async saveSignalHistory(signal: InsertSignalHistory): Promise<SelectSignalHistory> {
    const [saved] = await db.insert(signalHistory).values(signal).returning();
    return saved;
  }

  async getAllSignalHistory(): Promise<SelectSignalHistory[]> {
    return await db.select().from(signalHistory).orderBy(desc(signalHistory.generatedAt));
  }

  async getUserSignalHistory(userId: string): Promise<SelectSignalHistory[]> {
    return await db.select().from(signalHistory)
      .where(eq(signalHistory.userId, userId))
      .orderBy(desc(signalHistory.generatedAt));
  }

  async getSignalHistoryBySymbol(symbol: string): Promise<SelectSignalHistory[]> {
    return await db.select().from(signalHistory)
      .where(eq(signalHistory.symbol, symbol))
      .orderBy(desc(signalHistory.generatedAt));
  }

  private hashSymbol(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      const char = symbol.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async executeTrade(trade: InsertTradeExecution): Promise<SelectTradeExecution> {
    const entryPremium = Number(trade.entryPremium);
    const contracts = typeof trade.contracts === 'number' ? trade.contracts : parseInt(String(trade.contracts));
    const strikePrice = Number(trade.strikePrice);
    const totalCost = Number(trade.totalCost);
    const targetPremiumPercent = Number(trade.targetPremiumPercent);
    const stopLossPremiumPercent = Number(trade.stopLossPremiumPercent);
    const contractMultiplier = Number(trade.contractMultiplier) || 100;
    
    if (!Number.isFinite(entryPremium) || entryPremium <= 0) {
      throw new ValidationError("must be a positive number", "entryPremium");
    }
    if (!Number.isFinite(contracts) || contracts <= 0) {
      throw new ValidationError("must be a positive integer", "contracts");
    }
    if (!Number.isFinite(strikePrice) || strikePrice <= 0) {
      throw new ValidationError("must be a positive number", "strikePrice");
    }
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      throw new ValidationError("must be a positive number", "totalCost");
    }
    
    const normalizedTrade = {
      signalId: trade.signalId,
      symbol: trade.symbol.toUpperCase(),
      action: trade.action,
      optionType: trade.optionType,
      optionSide: trade.optionSide,
      strikePrice: strikePrice.toFixed(2),
      expirationDate: trade.expirationDate,
      entryPremium: entryPremium.toFixed(4),
      contracts: Math.floor(contracts),
      contractMultiplier: Math.floor(contractMultiplier),
      totalCost: totalCost.toFixed(2),
      targetPremiumPercent: Math.floor(targetPremiumPercent).toString(),
      stopLossPremiumPercent: Math.floor(stopLossPremiumPercent).toString(),
      status: "open" as const,
      notes: trade.notes || null,
    };
    
    const [executed] = await db.insert(tradeExecutions).values(normalizedTrade).returning();
    return executed;
  }

  async closeTrade(id: number, exitPremium: number, notes?: string, updatedEntryPremium?: number): Promise<SelectTradeExecution> {
    const trade = await this.getTradeById(id);
    if (!trade) {
      throw new ValidationError(`Trade with id ${id} not found`, "id");
    }
    
    if (trade.status !== "open") {
      throw new ValidationError(`Trade ${id} is already closed`, "status");
    }
    
    if (!Number.isFinite(exitPremium)) {
      throw new ValidationError("must be a valid number", "exitPremium");
    }

    // Use updated entry premium if provided (for correcting AI parser mistakes), otherwise use existing
    const entryPremium = updatedEntryPremium !== undefined ? updatedEntryPremium : parseFloat(trade.entryPremium);
    if (!Number.isFinite(entryPremium)) {
      throw new ValidationError("Trade has invalid entry premium", "entryPremium");
    }
    
    const contracts = trade.contracts;
    const contractMultiplier = trade.contractMultiplier;
    const optionSide = trade.optionSide;

    // Use absolute values for calculations to ensure correct P/L regardless of how values were entered
    const absEntry = Math.abs(entryPremium);
    const absExit = Math.abs(exitPremium);
    
    let profitLoss: number;
    if (optionSide === "LONG") {
      // LONG: Buy at entry, sell at exit. Profit when exit > entry
      profitLoss = (absExit - absEntry) * contracts * contractMultiplier;
    } else {
      // SHORT: Sell at entry (credit), buy back at exit (debit). Profit when entry > exit
      profitLoss = (absEntry - absExit) * contracts * contractMultiplier;
    }
    
    // Calculate percentage based on initial investment (absolute entry premium)
    const profitLossPercent = absEntry > 0 
      ? (profitLoss / (absEntry * contracts * contractMultiplier)) * 100
      : (profitLoss !== 0 ? Infinity : 0);

    // Calculate R-multiple if planned risk is defined
    let realizedRMultiple: string | null = null;
    if (trade.plannedRiskPerTrade) {
      const plannedRisk = parseFloat(trade.plannedRiskPerTrade);
      if (Number.isFinite(plannedRisk) && plannedRisk > 0) {
        realizedRMultiple = (profitLoss / plannedRisk).toFixed(4);
      }
    }

    // Build update object, including entry premium if it was updated
    const updateData: Record<string, any> = {
      exitPremium: exitPremium.toFixed(4),
      status: profitLoss >= 0 ? "won" : "lost",
      profitLoss: profitLoss.toFixed(2),
      profitLossPercent: Number.isFinite(profitLossPercent) ? profitLossPercent.toFixed(4) : "0",
      closedAt: new Date(),
      notes: notes || trade.notes,
      realizedRMultiple,
    };
    
    // If entry premium was updated, also update it and recalculate total cost
    if (updatedEntryPremium !== undefined) {
      updateData.entryPremium = entryPremium.toFixed(4);
      updateData.totalCost = (Math.abs(entryPremium) * contracts * contractMultiplier).toFixed(2);
    }

    const [closed] = await db.update(tradeExecutions)
      .set(updateData)
      .where(eq(tradeExecutions.id, id))
      .returning();
    return closed;
  }

  async createManualTrade(trade: InsertTradeExecution): Promise<SelectTradeExecution> {
    const [created] = await db.insert(tradeExecutions).values({
      ...trade,
      source: "manual",
      status: "open",
    }).returning();
    return created;
  }

  async updateTradeJournal(id: number, updates: { strategyTag?: string; tagList?: string[]; sessionTag?: string; emotionalState?: string; whatWentWell?: string; whatWentWrong?: string; lessonLearned?: string; screenshotUrl?: string; notes?: string; plannedRiskPerTrade?: string | number; plannedStopPrice?: string | number; plannedTakeProfitPrice?: string | number }): Promise<SelectTradeExecution> {
    const trade = await this.getTradeById(id);
    if (!trade) {
      throw new ValidationError(`Trade with id ${id} not found`, "id");
    }
    
    const parseDecimal = (val: string | number | undefined, decimals: number): string | null => {
      if (val === undefined || val === null || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return Number.isFinite(num) ? num.toFixed(decimals) : null;
    };
    
    const updateData: Record<string, any> = {};
    if (updates.strategyTag !== undefined) updateData.strategyTag = updates.strategyTag;
    if (updates.tagList !== undefined) updateData.tagList = JSON.stringify(updates.tagList);
    if (updates.sessionTag !== undefined) updateData.sessionTag = updates.sessionTag;
    if (updates.emotionalState !== undefined) updateData.emotionalState = updates.emotionalState;
    if (updates.whatWentWell !== undefined) updateData.whatWentWell = updates.whatWentWell;
    if (updates.whatWentWrong !== undefined) updateData.whatWentWrong = updates.whatWentWrong;
    if (updates.lessonLearned !== undefined) updateData.lessonLearned = updates.lessonLearned;
    if (updates.screenshotUrl !== undefined) updateData.screenshotUrl = updates.screenshotUrl || null;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.plannedRiskPerTrade !== undefined) updateData.plannedRiskPerTrade = parseDecimal(updates.plannedRiskPerTrade, 2);
    if (updates.plannedStopPrice !== undefined) updateData.plannedStopPrice = parseDecimal(updates.plannedStopPrice, 4);
    if (updates.plannedTakeProfitPrice !== undefined) updateData.plannedTakeProfitPrice = parseDecimal(updates.plannedTakeProfitPrice, 4);
    
    const [updated] = await db.update(tradeExecutions)
      .set(updateData)
      .where(eq(tradeExecutions.id, id))
      .returning();
    return updated;
  }

  async getAllTrades(): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions).orderBy(desc(tradeExecutions.executedAt));
  }

  async getTradesWithFilters(filters: { symbol?: string; status?: string; source?: string; strategyTag?: string; from?: string; to?: string; userId?: string }): Promise<SelectTradeExecution[]> {
    const conditions = [];
    
    if (filters.symbol) {
      conditions.push(eq(tradeExecutions.symbol, filters.symbol.toUpperCase()));
    }
    if (filters.status && filters.status !== "all") {
      if (filters.status === "closed") {
        conditions.push(isNotNull(tradeExecutions.closedAt));
      } else if (filters.status === "open") {
        conditions.push(eq(tradeExecutions.status, "open"));
      }
    }
    if (filters.source) {
      conditions.push(eq(tradeExecutions.source, filters.source));
    }
    if (filters.strategyTag) {
      conditions.push(eq(tradeExecutions.strategyTag, filters.strategyTag));
    }
    if (filters.userId) {
      conditions.push(eq(tradeExecutions.userId, filters.userId));
    }
    if (filters.from) {
      conditions.push(sql`${tradeExecutions.executedAt} >= ${new Date(filters.from)}`);
    }
    if (filters.to) {
      conditions.push(sql`${tradeExecutions.executedAt} <= ${new Date(filters.to)}`);
    }
    
    if (conditions.length === 0) {
      return await db.select().from(tradeExecutions).orderBy(desc(tradeExecutions.executedAt));
    }
    
    return await db.select().from(tradeExecutions)
      .where(and(...conditions))
      .orderBy(desc(tradeExecutions.executedAt));
  }

  async getUserTrades(userId: string): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(eq(tradeExecutions.userId, userId))
      .orderBy(desc(tradeExecutions.executedAt));
  }

  async getOpenTrades(): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(eq(tradeExecutions.status, "open"))
      .orderBy(desc(tradeExecutions.executedAt));
  }

  async getClosedTrades(): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(isNotNull(tradeExecutions.closedAt))
      .orderBy(desc(tradeExecutions.closedAt));
  }

  async getUserOpenTrades(userId: string): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(and(eq(tradeExecutions.userId, userId), eq(tradeExecutions.status, "open")))
      .orderBy(desc(tradeExecutions.executedAt));
  }

  async getUserClosedTrades(userId: string): Promise<SelectTradeExecution[]> {
    return await db.select().from(tradeExecutions)
      .where(and(eq(tradeExecutions.userId, userId), isNotNull(tradeExecutions.closedAt)))
      .orderBy(desc(tradeExecutions.closedAt));
  }

  async getUserJournalEntries(userId: string): Promise<SelectTradeJournalEntry[]> {
    const userTrades = await this.getUserTrades(userId);
    const userTradeIds = userTrades.map(t => t.id);
    if (userTradeIds.length === 0) return [];
    return await db.select().from(tradeJournalEntries)
      .where(sql`${tradeJournalEntries.tradeId} IN (${sql.join(userTradeIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(tradeJournalEntries.createdAt));
  }

  async getJournalEntriesForTradeWithOwnerCheck(tradeId: number, userId: string): Promise<SelectTradeJournalEntry[]> {
    const trade = await this.getTradeById(tradeId);
    if (!trade || trade.userId !== userId) {
      return [];
    }
    return await db.select().from(tradeJournalEntries)
      .where(eq(tradeJournalEntries.tradeId, tradeId))
      .orderBy(desc(tradeJournalEntries.createdAt));
  }

  async getTradeById(id: number): Promise<SelectTradeExecution | undefined> {
    const [trade] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, id));
    return trade;
  }

  async deleteTrade(id: number): Promise<void> {
    await db.delete(tradeJournalEntries).where(eq(tradeJournalEntries.tradeId, id));
    await db.delete(tradeExecutions).where(eq(tradeExecutions.id, id));
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const allTrades = await this.getAllTrades();
    const closedTrades = allTrades.filter(t => t.closedAt !== null);
    const openTrades = allTrades.filter(t => t.closedAt === null);
    
    const winningTrades = closedTrades.filter(t => parseFloat(t.profitLoss || "0") > 0);
    const losingTrades = closedTrades.filter(t => parseFloat(t.profitLoss || "0") < 0);
    
    const totalProfit = winningTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss || "0"), 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss || "0"), 0));
    const totalProfitLoss = closedTrades.reduce((sum, t) => sum + parseFloat(t.profitLoss || "0"), 0);
    
    const averageProfit = winningTrades.length > 0 ? totalProfit / winningTrades.length : 0;
    const averageLoss = losingTrades.length > 0 ? totalLoss / losingTrades.length : 0;
    
    let bestTrade = null;
    let worstTrade = null;
    
    if (closedTrades.length > 0) {
      const sorted = [...closedTrades].sort((a, b) => 
        parseFloat(b.profitLossPercent || "0") - parseFloat(a.profitLossPercent || "0")
      );
      bestTrade = {
        symbol: sorted[0].symbol,
        profitLossPercent: parseFloat(sorted[0].profitLossPercent || "0"),
      };
      worstTrade = {
        symbol: sorted[sorted.length - 1].symbol,
        profitLossPercent: parseFloat(sorted[sorted.length - 1].profitLossPercent || "0"),
      };
    }
    
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    const expectancy = closedTrades.length > 0
      ? (winRate / 100 * averageProfit) - ((100 - winRate) / 100 * averageLoss)
      : 0;
    
    return {
      totalTrades: allTrades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      averageProfit,
      averageLoss,
      totalProfitLoss,
      bestTrade,
      worstTrade,
      profitFactor: profitFactor === Infinity ? 999 : profitFactor,
      expectancy,
    };
  }

  // ============ Trading Strategy Methods ============
  
  async createStrategy(strategy: Strategy): Promise<SelectTradingStrategy> {
    if (!strategy.name || strategy.name.trim().length === 0) {
      throw new ValidationError("Strategy name is required", "name");
    }
    const validActions = ["BUY_CALL", "BUY_PUT", "SELL_CALL", "SELL_PUT", "HOLD"];
    if (!strategy.action || !validActions.includes(strategy.action)) {
      throw new ValidationError("Action must be BUY_CALL, BUY_PUT, SELL_CALL, SELL_PUT, or HOLD", "action");
    }
    if (!strategy.conditionGroups || strategy.conditionGroups.length === 0) {
      throw new ValidationError("At least one condition group is required", "conditionGroups");
    }
    
    const dbStrategy: InsertTradingStrategy = {
      name: strategy.name.trim(),
      description: strategy.description || null,
      action: strategy.action,
      conditionGroups: JSON.stringify(strategy.conditionGroups),
      enabled: strategy.enabled ? 1 : 0,
      priority: strategy.priority || 50,
    };
    
    const [created] = await db.insert(tradingStrategies).values(dbStrategy).returning();
    return created;
  }
  
  async updateStrategy(id: number, strategyUpdate: Partial<Strategy>): Promise<SelectTradingStrategy> {
    const existing = await this.getStrategyById(id);
    if (!existing) {
      throw new ValidationError(`Strategy with id ${id} not found`, "id");
    }
    
    const updateData: Record<string, unknown> = {};
    
    if (strategyUpdate.name !== undefined) {
      if (!strategyUpdate.name || strategyUpdate.name.trim().length === 0) {
        throw new ValidationError("Strategy name cannot be empty", "name");
      }
      updateData.name = strategyUpdate.name.trim();
    }
    if (strategyUpdate.description !== undefined) {
      updateData.description = strategyUpdate.description || null;
    }
    if (strategyUpdate.action !== undefined) {
      const validActions = ["BUY_CALL", "BUY_PUT", "SELL_CALL", "SELL_PUT", "HOLD"];
      if (!validActions.includes(strategyUpdate.action)) {
        throw new ValidationError("Action must be BUY_CALL, BUY_PUT, SELL_CALL, SELL_PUT, or HOLD", "action");
      }
      updateData.action = strategyUpdate.action;
    }
    if (strategyUpdate.conditionGroups !== undefined) {
      if (strategyUpdate.conditionGroups.length === 0) {
        throw new ValidationError("At least one condition group is required", "conditionGroups");
      }
      updateData.conditionGroups = JSON.stringify(strategyUpdate.conditionGroups);
    }
    if (strategyUpdate.enabled !== undefined) {
      updateData.enabled = strategyUpdate.enabled ? 1 : 0;
    }
    if (strategyUpdate.priority !== undefined) {
      updateData.priority = strategyUpdate.priority;
    }
    
    const [updated] = await db.update(tradingStrategies)
      .set(updateData)
      .where(eq(tradingStrategies.id, id))
      .returning();
    return updated;
  }
  
  async deleteStrategy(id: number): Promise<void> {
    const existing = await this.getStrategyById(id);
    if (!existing) {
      throw new ValidationError(`Strategy with id ${id} not found`, "id");
    }
    await db.delete(tradingStrategies).where(eq(tradingStrategies.id, id));
  }
  
  async getAllStrategies(): Promise<SelectTradingStrategy[]> {
    return await db.select().from(tradingStrategies).orderBy(desc(tradingStrategies.priority));
  }
  
  async getStrategyById(id: number): Promise<SelectTradingStrategy | undefined> {
    const [strategy] = await db.select().from(tradingStrategies).where(eq(tradingStrategies.id, id));
    return strategy;
  }
  
  async getEnabledStrategies(): Promise<SelectTradingStrategy[]> {
    return await db.select().from(tradingStrategies)
      .where(eq(tradingStrategies.enabled, 1))
      .orderBy(desc(tradingStrategies.priority));
  }
  
  // ============ Trade Journal Methods ============
  
  async createJournalEntry(entry: InsertTradeJournalEntry): Promise<SelectTradeJournalEntry> {
    // Verify trade exists
    const trade = await this.getTradeById(entry.tradeId);
    if (!trade) {
      throw new ValidationError(`Trade with id ${entry.tradeId} not found`, "tradeId");
    }
    
    const [newEntry] = await db.insert(tradeJournalEntries)
      .values(entry)
      .returning();
    return newEntry;
  }
  
  async getJournalEntriesForTrade(tradeId: number): Promise<SelectTradeJournalEntry[]> {
    return await db.select()
      .from(tradeJournalEntries)
      .where(eq(tradeJournalEntries.tradeId, tradeId))
      .orderBy(desc(tradeJournalEntries.createdAt));
  }
  
  async getAllJournalEntries(): Promise<SelectTradeJournalEntry[]> {
    return await db.select()
      .from(tradeJournalEntries)
      .orderBy(desc(tradeJournalEntries.createdAt));
  }
  
  async deleteJournalEntry(id: number): Promise<void> {
    await db.delete(tradeJournalEntries).where(eq(tradeJournalEntries.id, id));
  }
  
  // ============ Portfolio Summary Methods ============
  
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    const allTrades = await this.getAllTrades();
    
    const openTrades = allTrades.filter(t => t.status === "open");
    const closedTrades = allTrades.filter(t => t.closedAt !== null);
    
    // Calculate realized P&L from closed trades
    const realizedPnL = closedTrades.reduce((sum, t) => {
      const pnl = parseFloat(t.profitLoss || "0");
      return sum + pnl;
    }, 0);
    
    // For options, unrealized P&L is harder to calculate without live option prices
    // We'll estimate based on a simplified model or just show zero for now
    let unrealizedPnL = 0;
    
    // Total invested in open positions (total cost of options contracts)
    const totalInvested = openTrades.reduce((sum, t) => {
      return sum + parseFloat(t.totalCost);
    }, 0);
    
    // Winning/losing trades
    const winningTrades = closedTrades.filter(t => parseFloat(t.profitLoss || "0") > 0);
    const losingTrades = closedTrades.filter(t => parseFloat(t.profitLoss || "0") < 0);
    const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
    
    // Average holding period
    const holdingPeriods = closedTrades
      .filter(t => t.closedAt)
      .map(t => {
        const opened = new Date(t.executedAt).getTime();
        const closed = new Date(t.closedAt!).getTime();
        return (closed - opened) / (1000 * 60 * 60 * 24); // days
      });
    const avgHoldingPeriod = holdingPeriods.length > 0 
      ? holdingPeriods.reduce((a, b) => a + b, 0) / holdingPeriods.length 
      : 0;
    
    // Sort by P&L percent for top/worst performers
    const sortedByPnL = [...allTrades]
      .filter(t => t.profitLossPercent)
      .sort((a, b) => parseFloat(b.profitLossPercent || "0") - parseFloat(a.profitLossPercent || "0"));
    
    const topPerformers = sortedByPnL.slice(0, 3).map(t => ({
      symbol: t.symbol,
      pnlPercent: parseFloat(t.profitLossPercent || "0"),
      status: t.status
    }));
    
    const worstPerformers = sortedByPnL.slice(-3).reverse().map(t => ({
      symbol: t.symbol,
      pnlPercent: parseFloat(t.profitLossPercent || "0"),
      status: t.status
    }));
    
    const totalPnL = realizedPnL + unrealizedPnL;
    const totalValue = totalInvested + unrealizedPnL;
    
    return {
      totalPositions: allTrades.length,
      openPositions: openTrades.length,
      closedPositions: closedTrades.length,
      totalInvested,
      totalValue,
      realizedPnL,
      unrealizedPnL,
      totalPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      winRate,
      avgHoldingPeriod,
      topPerformers,
      worstPerformers
    };
  }
  
  // Adaptive learning / signal outcomes methods
  async createSignalOutcome(outcome: InsertSignalOutcome): Promise<SelectSignalOutcome> {
    const [saved] = await db.insert(signalOutcomes).values(outcome).returning();
    return saved;
  }

  async getSignalOutcomes(symbol: string): Promise<SelectSignalOutcome[]> {
    return await db.select().from(signalOutcomes)
      .where(eq(signalOutcomes.symbol, symbol))
      .orderBy(desc(signalOutcomes.createdAt));
  }

  async getSignalOutcomeById(id: number): Promise<SelectSignalOutcome | undefined> {
    const results = await db.select().from(signalOutcomes)
      .where(eq(signalOutcomes.id, id))
      .limit(1);
    return results[0];
  }

  async updateSignalOutcome(id: number, updates: Partial<SelectSignalOutcome>): Promise<SelectSignalOutcome | undefined> {
    const [updated] = await db.update(signalOutcomes)
      .set(updates)
      .where(eq(signalOutcomes.id, id))
      .returning();
    return updated;
  }

  async getDistinctSymbolsFromOutcomes(): Promise<string[]> {
    const results = await db.selectDistinct({ symbol: signalOutcomes.symbol })
      .from(signalOutcomes);
    return results.map(r => r.symbol);
  }
  
  // Watchlist methods
  async getUserWatchlist(userId: string): Promise<SelectWatchlist[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.addedAt));
  }
  
  async addToWatchlist(symbol: string, userId: string): Promise<SelectWatchlist> {
    const [saved] = await db
      .insert(watchlist)
      .values({ symbol, userId })
      .returning();
    return saved;
  }
  
  async removeFromWatchlist(id: number, userId: string): Promise<void> {
    // Only delete if this item belongs to this user
    await db
      .delete(watchlist)
      .where(
        and(eq(watchlist.id, id), eq(watchlist.userId, userId))
      );
  }
  
  // Price alerts methods
  async getAlerts(): Promise<SelectPriceAlert[]> {
    return await db.select().from(priceAlerts).orderBy(desc(priceAlerts.createdAt));
  }
  
  async getUserAlerts(userId: string): Promise<SelectPriceAlert[]> {
    return await db.select().from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt));
  }
  
  async getUserAlertCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(priceAlerts)
      .where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.status, "ACTIVE")));
    return Number(result[0]?.count) || 0;
  }

  async checkDuplicateAlert(userId: string, symbol: string, targetPrice: number, condition: string, excludeAlertId?: number): Promise<boolean> {
    const conditions = [
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.symbol, symbol.toUpperCase()),
      eq(priceAlerts.targetPrice, targetPrice.toString()),
      eq(priceAlerts.condition, condition),
      eq(priceAlerts.status, "ACTIVE")
    ];
    
    const { ne } = await import("drizzle-orm");
    if (excludeAlertId !== undefined) {
      conditions.push(ne(priceAlerts.id, excludeAlertId));
    }
    
    const existing = await db
      .select({ id: priceAlerts.id })
      .from(priceAlerts)
      .where(and(...conditions))
      .limit(1);
    return existing.length > 0;
  }

  async createAlert(alert: { name?: string; symbol: string; targetPrice: number; condition: string; userId?: string; notifyEmail?: boolean; notifyTelegram?: boolean; notifyDiscord?: boolean }): Promise<SelectPriceAlert> {
    const [saved] = await db.insert(priceAlerts).values({
      name: alert.name || null,
      symbol: alert.symbol,
      targetPrice: alert.targetPrice.toString(),
      condition: alert.condition,
      status: "ACTIVE",
      userId: alert.userId || null,
      notifyEmail: !!alert.notifyEmail,
      notifyTelegram: !!alert.notifyTelegram,
      notifyDiscord: !!alert.notifyDiscord,
    }).returning();
    return saved;
  }
  
  async deleteAlert(id: number): Promise<void> {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
  }
  
  async markAlertTriggered(id: number): Promise<void> {
    await db
      .update(priceAlerts)
      .set({ status: "TRIGGERED", triggeredAt: new Date() })
      .where(eq(priceAlerts.id, id));
  }

  async updateAlert(id: number, updates: { name?: string | null; symbol?: string; targetPrice?: number; condition?: string; notifyEmail?: boolean; notifyTelegram?: boolean; notifyDiscord?: boolean; status?: string }): Promise<SelectPriceAlert> {
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.symbol !== undefined) updateData.symbol = updates.symbol;
    if (updates.targetPrice !== undefined) updateData.targetPrice = updates.targetPrice.toString();
    if (updates.condition !== undefined) updateData.condition = updates.condition;
    if (updates.notifyEmail !== undefined) updateData.notifyEmail = updates.notifyEmail;
    if (updates.notifyTelegram !== undefined) updateData.notifyTelegram = updates.notifyTelegram;
    if (updates.notifyDiscord !== undefined) updateData.notifyDiscord = updates.notifyDiscord;
    if (updates.status !== undefined) updateData.status = updates.status;
    
    const [updated] = await db.update(priceAlerts)
      .set(updateData)
      .where(eq(priceAlerts.id, id))
      .returning();
    return updated;
  }

  async toggleAlertStatus(id: number): Promise<SelectPriceAlert> {
    const [existing] = await db.select().from(priceAlerts).where(eq(priceAlerts.id, id));
    if (!existing) throw new ValidationError(`Alert with id ${id} not found`, "id");
    
    const newStatus = existing.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    const [updated] = await db.update(priceAlerts)
      .set({ status: newStatus })
      .where(eq(priceAlerts.id, id))
      .returning();
    return updated;
  }

  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user;
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordUserId, discordId));
    return user;
  }

  async getUserByTelegramId(telegramChatId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramChatId, telegramChatId));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Imports (screenshot parsing provenance)
  async createImport(data: InsertImport): Promise<SelectImport> {
    const [saved] = await db.insert(imports).values(data).returning();
    return saved;
  }

  // Support tickets methods
  // Uses centralized formatTicketNumber from shared/support-utils.ts

  async createTicket(ticket: { email: string; name?: string; subject: string; message: string; priority?: string; channel?: string; userId?: string }): Promise<SelectSupportTicket> {
    // Use a transaction to ensure atomic ticket number assignment
    // This prevents race conditions where two concurrent inserts could read the same MAX(id)
    return await db.transaction(async (tx) => {
      // Insert with a temporary unique placeholder (using timestamp + random to avoid UNIQUE conflicts)
      const tempNumber = `IST-TMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const [inserted] = await tx.insert(supportTickets).values({
        ticketNumber: tempNumber,
        email: ticket.email,
        name: ticket.name || null,
        subject: ticket.subject,
        message: ticket.message,
        priority: ticket.priority || "normal",
        channel: ticket.channel || "web",
        userId: ticket.userId || null,
        status: "open",
      }).returning();
      
      // Now update with the real ticket number based on the assigned ID (within same transaction)
      const ticketNumber = formatTicketNumber(inserted.id);
      const [saved] = await tx.update(supportTickets)
        .set({ ticketNumber })
        .where(eq(supportTickets.id, inserted.id))
        .returning();
      
      return saved;
    });
  }

  async getTickets(filters?: { status?: string; priority?: string; channel?: string }): Promise<SelectSupportTicket[]> {
    let query = db.select().from(supportTickets);
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(supportTickets.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(supportTickets.priority, filters.priority));
    }
    if (filters?.channel) {
      conditions.push(eq(supportTickets.channel, filters.channel));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(supportTickets).where(and(...conditions)).orderBy(desc(supportTickets.createdAt));
    }
    return await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getTicketById(id: number): Promise<SelectSupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket;
  }

  async getTicketByNumber(ticketNumber: string): Promise<SelectSupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.ticketNumber, ticketNumber));
    return ticket;
  }

  async updateTicket(id: number, updates: { status?: string; priority?: string; assignedTo?: string | null }): Promise<SelectSupportTicket> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      if (updates.status === "resolved" || updates.status === "closed") {
        updateData.resolvedAt = new Date();
      }
    }
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
    
    const [updated] = await db.update(supportTickets)
      .set(updateData)
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  async getUserTickets(userId: string): Promise<SelectSupportTicket[]> {
    return await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }
}

export const storage = new MemStorage();
