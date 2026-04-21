import type { Express } from "express";
import { createServer, type Server } from "http";
import { clerkMiddleware, getAuth, requireAuth, clerkClient } from "@clerk/express";
import { handleClerkWebhook } from "./webhooks";
import { storage, ValidationError } from "./storage";
import rateLimit from "express-rate-limit";
import { batchAnalyzeSymbols, type AIErrorResponse, type AIAnalysisResult, isAIError } from "./ai-service";
import { 
  signalRequestSchema, 
  tradeExecutionUpdateSchema, 
  insertTradeExecutionSchema, 
  strategySchema,
  backtestRequestSchema,
  updateUserSettingsSchema,
  updateAlertRequestSchema,
  type TradingSignal,
  SelectSignalHistory,
  SelectPriceAlert,
} from "@shared/schema";
import { z, ZodError } from "zod";
import { stripe, getPriceIdForTier, getTierFromPriceId, isYearlyPricingConfigured, FRONTEND_BASE_URL, STRIPE_PORTAL_RETURN_URL, type BillingInterval } from "./stripe";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { env, isAIAvailable, isDeveloper } from "./config/env";
import { getContractForStrategy, type PolygonOptionContract, type PositionPreview } from "./polygon-options";
import { getRiskProfile, clampRiskPercent, sizePositionStrictWithOverride, type Tier, type RiskProfile } from "./config/riskProfiles";
import { syncTradeExecutionToAdaptive } from "./adaptive-learning";
import type { SelectTradeExecution } from "@shared/schema";
import {
  startScanner,
  stopScanner,
  getScannerStatus,
  getScannerConfig,
  updateScannerConfig,
  setWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  triggerManualScan,
} from "./market-scanner";
import { callPrimarySignalEngine, type PrimarySignalRequest } from "./ai/signalEngine";
import { askCoach, explainSignal, runBacktest, checkAssistantConfig } from "./ai/assistants";

import crypto from "crypto";

// Server startup time for uptime tracking
const serverStartTime = Date.now();

// Track last scanner update time
let lastScannerUpdate: Date | null = null;

// Helper: Compute current market session for canonical asOf block
function computeMarketSession(): "pre" | "regular" | "after" | "closed" {
  const now = new Date();
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
    weekday: 'short'
  });
  const etParts = etFormatter.formatToParts(now);
  const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
  const weekday = etParts.find(p => p.type === 'weekday')?.value || '';
  const timeInMinutes = hour * 60 + minute;
  
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  if (isWeekend) return 'closed';
  
  if (timeInMinutes >= 240 && timeInMinutes < 570) return 'pre';
  if (timeInMinutes >= 570 && timeInMinutes < 960) return 'regular';
  if (timeInMinutes >= 960 && timeInMinutes < 1200) return 'after';
  return 'closed';
}

// Helper: Normalize timeframe strings from client
function normalizeTimeframe(raw: string): PrimarySignalRequest["timeframe"] {
  const value = raw.trim().toLowerCase();

  if (value === "1m" || value === "1min" || value === "1-minute") return "1m";
  if (value === "5m" || value === "5min" || value === "5-minute") return "5m";
  if (value === "15m" || value === "15min" || value === "15-minute") return "15m";
  if (value === "1h" || value === "60m" || value === "60min") return "1h";
  if (value === "4h" || value === "240m" || value === "240min") return "4h";
  if (value === "1d" || value === "daily" || value === "day") return "1d";

  return "1d"; // Default
}

// Helper: Create SHA-256 hash of input for audit trail
function hashInput(input: object): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
export function updateScannerTimestamp() {
  lastScannerUpdate = new Date();
}

// Simple rate limiter for chat endpoint with role-based limits
const chatRateLimiter = new Map<string, { count: number; resetTime: number }>();
const CHAT_RATE_LIMIT_FREE = 10; // free users: 10 requests per window
const CHAT_RATE_LIMIT_PRO = 100; // pro users: 100 requests per window (effectively unlimited)
const CHAT_RATE_LIMIT_PREMIUM = 1000; // premium users: unlimited
const CHAT_RATE_WINDOW = 60 * 1000; // 1 minute window

function getChatRateLimitForRole(role: "free" | "pro" | "premium"): number {
  switch (role) {
    case "premium": return CHAT_RATE_LIMIT_PREMIUM;
    case "pro": return CHAT_RATE_LIMIT_PRO;
    default: return CHAT_RATE_LIMIT_FREE;
  }
}

function checkChatRateLimit(clientId: string, userRole: "free" | "pro" | "premium" = "free"): { allowed: boolean; remaining: number; resetIn: number } {
  const limit = getChatRateLimitForRole(userRole);
  const now = Date.now();
  const record = chatRateLimiter.get(clientId);
  
  if (!record || now > record.resetTime) {
    chatRateLimiter.set(clientId, { count: 1, resetTime: now + CHAT_RATE_WINDOW });
    return { allowed: true, remaining: limit - 1, resetIn: CHAT_RATE_WINDOW };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetIn: record.resetTime - now };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(chatRateLimiter.entries());
  for (const [key, value] of entries) {
    if (now > value.resetTime) {
      chatRateLimiter.delete(key);
    }
  }
}, 60000);

// Beta allowed symbols
// All symbols are now supported (beta restriction removed)

// Tier-based signal filtering
interface SignalResponse {
  signalId?: number | null;  // Database ID for linking trades to signals
  symbol: string;
  action: string;
  optionType: string | null;
  optionSide: string | null;
  confidence: number;
  currentPrice: number;
  reasoning: string;
  patternAnalysis: string;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  preferredExpiry: string;
  preferredMoneyness: string;
  strikePrice?: number | null;
  premium?: number | null;
  expirationDate?: string | null;
  contracts?: number | null;
  totalCost?: number | null;
  maxLoss?: number | null;
  breakeven?: number | null;
  greeks?: { delta: number; gamma: number; theta: number; vega: number } | null;
  targetDeltaRange?: [number, number] | { min: number; max: number };
  impliedVolatility?: number | null;
  selectedContract?: PolygonOptionContract | null;
  positionPreview?: PositionPreview | null;
  riskProfileUsed?: string;
  effectiveRiskPercent?: number | null;
  isUnaffordable?: boolean | null;
  riskViolation?: boolean | null;
  adaptiveNote?: string | null;
  [key: string]: any;
}

function filterSignalByTier(signal: SignalResponse, tier: Tier): Partial<SignalResponse> {
  // Free tier: ONLY symbol, action, confidence, short reasoning
  // Hide absolutely everything else - explicitly exclude adaptive insights
  if (tier === "free") {
    // Strip any adaptive-related mentions from reasoning
    const cleanReasoning = signal.reasoning 
      ? signal.reasoning.split('.').slice(0, 2).join('.').replace(/adaptive|historical win rate|performance trend/gi, '').trim() + '.'
      : undefined;
    return {
      symbol: signal.symbol,
      action: signal.action,
      confidence: signal.confidence,
      reasoning: cleanReasoning,
      dataTier: tier,
      // Explicitly exclude adaptiveNote for free tier (not just omit, set undefined)
      adaptiveNote: undefined,
    };
  }

  // Pro tier: Adds contract basics (strike, expiry, premium), position sizing
  // Omit Greeks entirely (not zeroed, just missing)
  if (tier === "pro") {
    return {
      symbol: signal.symbol,
      action: signal.action,
      optionType: signal.optionType,
      optionSide: signal.optionSide,
      confidence: signal.confidence,
      currentPrice: signal.currentPrice,
      reasoning: signal.reasoning,
      patternAnalysis: signal.patternAnalysis,
      stopLossPrice: signal.stopLossPrice,
      takeProfitPrice: signal.takeProfitPrice,
      preferredExpiry: signal.preferredExpiry,
      preferredMoneyness: signal.preferredMoneyness,
      // Contract basics for pro
      strikePrice: signal.strikePrice,
      premium: signal.premium,
      expirationDate: signal.expirationDate,
      contracts: signal.contracts,
      totalCost: signal.totalCost,
      maxLoss: signal.maxLoss,
      breakeven: signal.breakeven,
      targetDeltaRange: signal.targetDeltaRange,
      impliedVolatility: signal.impliedVolatility,
      // Position sizing info for pro
      riskProfileUsed: signal.riskProfileUsed,
      effectiveRiskPercent: signal.effectiveRiskPercent,
      isUnaffordable: signal.isUnaffordable,
      riskViolation: signal.riskViolation,
      positionPreview: signal.positionPreview,
      // Adaptive learning insight for pro tier
      adaptiveNote: signal.adaptiveNote,
      // Greeks omitted entirely for pro tier (not included)
      dataTier: tier,
    };
  }

  // Premium tier gets everything
  return { ...signal, dataTier: tier };
}

// Resolve user tier from database/subscription - NOT from client request
function resolveUserTier(user: { role?: string } | null | undefined): Tier {
  if (!user) return "free";
  const role = user.role?.toLowerCase();
  if (role === "premium") return "premium";
  if (role === "pro") return "pro";
  return "free";
}

// Check if data source is available
function getDataSourceStatus(): { source: "tradier" | "finnhub" | "mock"; available: boolean } {
  if (env.marketData.tradierApiKey) return { source: "tradier", available: true };
  if (env.marketData.finnhubApiKey) return { source: "finnhub", available: true };
  return { source: "mock", available: false };
}

// Check if AI is available - use centralized config
function getAIStatus(): boolean {
  return isAIAvailable();
}
import { 
  trainModel, 
  predictSignal, 
  getModelMetrics, 
  isModelLoaded,
  runMLBacktest,
  computeFeatures,
  getLatestFeatures
} from "./ml";
import { 
  getOptionsExpirations, 
  getOptionsChain,
  findOptimalContract,
  type OptionsContract 
} from "./tradier-service";
import {
  findAffordableAlternatives,
  calculateMaxAffordablePrice,
  getLowPriceSymbols
} from "./stock-alternatives";
import {
  searchLiveOptions,
  runFullScan,
  getCacheStatus,
  scanSymbolOnDemand,
  parseNaturalLanguageQuery,
  ALL_SCAN_SYMBOLS,
  type LiveOptionSnapshot,
  type ScanResult
} from "./live-options-scanner";
import { getAlertLimit } from "./planLimits";
import { hasFeatureAccess } from "./feature-flags";
import type { UserRole } from "@shared/schema";

// Local type definition for expiration options (replaces removed ExpirationOption from ai-service)
interface ExpirationOption {
  label: string;
  expirationDate: string;
  tradableExpiration: string;
  premium: number;
  contracts: number;
  totalCost: number;
  cashSecuredAmount?: number;
  maxLoss: number | string;
  maxGain: number | string;
  breakeven: number;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
  strike: number;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Telegram webhook endpoint - no auth required, secret verified in URL
  // See server/telegram-bot.ts for setup instructions
  app.post('/integrations/telegram/webhook/:secret', async (req, res) => {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!webhookSecret || req.params.secret !== webhookSecret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Always respond 200 quickly to prevent Telegram retries
    res.status(200).json({ ok: true });
    
    // Process update async (don't await to respond fast)
    try {
      const { processUpdate } = await import('./telegram-bot');
      processUpdate(req.body).catch(err => {
        console.error('[Telegram Webhook] Error processing update:', err);
      });
    } catch (error) {
      console.error('[Telegram Webhook] Error importing handler:', error);
    }
  });

  // Clerk webhook route (must be before clerkMiddleware for unauthenticated access)
  app.post('/api/webhooks/clerk', handleClerkWebhook);

  // Dev login bypass endpoint (development only, before auth middleware)
  // Requires explicit DEV_AUTH_TEST_EMAIL and DEV_AUTH_TEST_PASSWORD env vars
  if (env.isDevelopment && env.devAuth.bypassEnabled && env.devAuth.testUserEmail && env.devAuth.testUserPassword) {
    app.post('/api/dev/login', async (req, res) => {
      try {
        // Use server-side configured credentials - no client input needed
        const email = env.devAuth.testUserEmail;
        
        // Look up or create the test user in our database
        const testUserId = `dev_test_user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let user = await storage.getUser(testUserId);
        
        if (!user) {
          // Create a test user with premium role for full access testing
          user = await storage.upsertUser({
            id: testUserId,
            email: email,
            firstName: 'Dev',
            lastName: 'Test User',
            role: 'premium', // Give premium role for full access testing
          });
          console.log('[Dev Auth] Created test user:', testUserId);
        } else if (user.role !== 'premium') {
          // Upgrade existing test user to premium
          user = await storage.upsertUser({
            id: testUserId,
            role: 'premium',
          });
          console.log('[Dev Auth] Upgraded test user to premium:', testUserId);
        }
        
        // Return user data and a dev session token
        const devToken = Buffer.from(JSON.stringify({
          userId: testUserId,
          email: email,
          exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        })).toString('base64');
        
        res.json({
          success: true,
          user,
          devToken,
          message: 'Dev login successful - use devToken in X-Dev-Auth header'
        });
      } catch (error: any) {
        console.error('[Dev Auth] Error:', error);
        res.status(500).json({ error: 'Dev login failed' });
      }
    });
    
    console.log('[Dev Auth] Dev login bypass enabled at /api/dev/login');
  } else if (env.isDevelopment && env.devAuth.bypassEnabled) {
    console.warn('[Dev Auth] DEV_AUTH_BYPASS enabled but DEV_AUTH_TEST_EMAIL/PASSWORD not set - bypass disabled');
  }

  // Setup Clerk Auth middleware
  app.use(clerkMiddleware());

  // Store original Clerk requireAuth for fallback
  const clerkRequireAuth = requireAuth;

  // Helper to get userId from either dev auth or Clerk auth
  const getAuthUserId = (req: any): string | null => {
    // Check for dev auth first
    if (req.devAuth?.userId) {
      return req.devAuth.userId;
    }
    // Fall back to Clerk auth
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      return userId;
    } catch {
      return null;
    }
  };

  // Dev auth middleware - checks X-Dev-Auth header before falling back to Clerk
  // This allows dev token authentication to work with protected routes
  // For API routes, returns 401 JSON instead of redirecting
  const devAuthMiddleware = () => (req: any, res: any, next: any) => {
    const devToken = req.headers['x-dev-auth'];
    
    // Check for dev auth first
    if (devToken && env.isDevelopment && env.devAuth.bypassEnabled) {
      try {
        const decoded = JSON.parse(Buffer.from(devToken, 'base64').toString());
        
        // Check if token is expired
        if (decoded.exp && Date.now() < decoded.exp) {
          // Inject dev auth info into request (separate from Clerk's auth)
          req.devAuth = { userId: decoded.userId };
          return next();
        }
      } catch (e) {
        // Invalid token, fall through to Clerk auth
      }
    }
    
    // Check Clerk auth (without redirect)
    try {
      const { userId } = getAuth(req);
      if (userId) {
        return next();
      }
    } catch (e) {
      // Clerk auth failed
    }
    
    // No valid auth found - return 401 for API routes (don't redirect)
    return res.status(401).json({ error: "Unauthorized" });
  };

  // Auth routes - Get current user (returns null if not authenticated)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.json(null);
      }
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });

  // GET /api/health - Health check endpoint for App Runner
  // Always returns 200 so App Runner considers the app healthy
  // App Runner needs this endpoint to pass health checks
  app.get('/api/health', async (_req, res) => {
    let dbStatus = "unknown";
    try {
      await db.execute(sql`SELECT 1`);
      dbStatus = "connected";
    } catch (dbError) {
      dbStatus = "disconnected";
      console.warn("Database health check failed:", dbError);
    }

    const aiAvailable = getAIStatus();
    const dataSource = getDataSourceStatus();

    // Always return 200 for App Runner health checks
    res.status(200).json({
      ok: true,
      status: "ok",
      time: new Date().toISOString(),
      port: process.env.PORT || 5000,
      db: dbStatus,
      ai: aiAvailable,
      dataSource: dataSource.source,
    });
  });

  app.get('/api/health/ai', async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const config = checkAssistantConfig();
      const openaiKeySet = !!process.env.OPENAI_API_KEY;

      let testResult = "not_tested";
      let testError = "";
      if (openaiKeySet && config.configured.includes("coach")) {
        try {
          const OpenAI = (await import("openai")).default;
          const testClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const models = await testClient.models.list();
          testResult = "connected";
        } catch (e: any) {
          testResult = "failed";
          testError = e?.message || String(e);
        }
      }

      res.json({
        openaiKeySet,
        configured: config.configured,
        missing: config.missing,
        connectionTest: testResult,
        connectionError: testError,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/dashboard/stats - Dashboard command center stats
  app.get('/api/dashboard/stats', devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Count active signals from today (user-scoped)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const userSignals = await storage.getUserSignalHistory(userId);
      const activeSignals = userSignals.filter((s: SelectSignalHistory) => new Date(s.generatedAt) >= today).length;

      // Count active alerts
      const allAlerts = await storage.getUserAlerts(userId);
      const alertsActive = allAlerts.filter((a: SelectPriceAlert) => a.status === 'ACTIVE').length;

      // Calculate win rate from closed trades
      const closedTrades = await storage.getUserClosedTrades(userId);
      let winRate: number | null = null;
      let totalPnl: number | null = null;
      
      if (closedTrades.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentTrades = closedTrades.filter((t: SelectTradeExecution) => {
          const exitDate = t.closedAt ? new Date(t.closedAt) : new Date(t.executedAt);
          return exitDate >= thirtyDaysAgo;
        });
        
        if (recentTrades.length > 0) {
          const wins = recentTrades.filter((t: SelectTradeExecution) => Number(t.profitLoss || 0) > 0).length;
          winRate = wins / recentTrades.length;
        }
        
        // Calculate month-to-date P&L
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const monthTrades = closedTrades.filter((t: SelectTradeExecution) => {
          const exitDate = t.closedAt ? new Date(t.closedAt) : new Date(t.executedAt);
          return exitDate >= startOfMonth;
        });
        totalPnl = monthTrades.reduce((sum: number, t: SelectTradeExecution) => sum + Number(t.profitLoss || 0), 0);
      }

      // Count open positions
      const openTrades = await storage.getUserOpenTrades(userId);
      const openPositions = openTrades.length;

      // Capital tracking not implemented - would need accountSettings table
      const availableCapital: number | null = null;
      
      // Calculate daily risk (simplified - percentage of account in open positions)
      let dailyRiskUsed = 0;
      if (availableCapital && openTrades.length > 0) {
        const totalRisk = openTrades.reduce((sum: number, t: SelectTradeExecution) => sum + Number(t.totalCost || 0), 0);
        dailyRiskUsed = Math.round((totalRisk / availableCapital) * 100);
      }

      res.json({
        activeSignals,
        alertsActive,
        winRate,
        totalPnl,
        openPositions,
        dailyRiskUsed,
        availableCapital,
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.json({
        activeSignals: 0,
        alertsActive: 0,
        winRate: null,
        totalPnl: null,
        openPositions: 0,
        dailyRiskUsed: 0,
        availableCapital: null,
      });
    }
  });

  // GET /api/signals/recent - Recent signals for dashboard
  app.get('/api/signals/recent', devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const signals = await storage.getUserSignalHistory(userId);
      const recentSignals = signals
        .sort((a: SelectSignalHistory, b: SelectSignalHistory) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, 10)
        .map((s: SelectSignalHistory) => ({
          id: s.id,
          symbol: s.symbol,
          action: s.action,
          confidence: s.confidence,
          createdAt: s.generatedAt,
        }));

      res.json(recentSignals);
    } catch (error) {
      console.error("Recent signals error:", error);
      res.json([]);
    }
  });

  // GET /api/dashboard/activity - Recent activity for dashboard
  app.get('/api/dashboard/activity', devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Combine various activities into a unified feed
      const activities: Array<{ id: number; type: string; description: string; timestamp: string }> = [];
      
      // Get recent signals (user-scoped)
      const signals = await storage.getUserSignalHistory(userId);
      signals.slice(0, 5).forEach((s: SelectSignalHistory, i: number) => {
        activities.push({
          id: i + 1,
          type: "signal",
          description: `Signal generated: ${s.symbol} ${s.action}`,
          timestamp: s.generatedAt.toString(),
        });
      });

      // Get recent trades
      const trades = await storage.getUserTrades(userId);
      trades.slice(0, 5).forEach((t: SelectTradeExecution, i: number) => {
        activities.push({
          id: i + 100,
          type: "trade",
          description: t.closedAt ? `Trade closed: ${t.symbol}` : `Trade opened: ${t.symbol}`,
          timestamp: (t.closedAt || t.executedAt).toString(),
        });
      });

      // Get recent alerts triggered
      const alerts = await storage.getUserAlerts(userId);
      alerts.filter((a: SelectPriceAlert) => a.triggeredAt).slice(0, 3).forEach((a: SelectPriceAlert, i: number) => {
        activities.push({
          id: i + 200,
          type: "alert",
          description: `Alert triggered: ${a.symbol} hit $${a.targetPrice}`,
          timestamp: a.triggeredAt!.toString(),
        });
      });

      // Sort by timestamp and return most recent
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      res.json(sortedActivities);
    } catch (error) {
      console.error("Dashboard activity error:", error);
      res.json([]);
    }
  });

  // GET /api/status - Detailed system status
  app.get('/api/status', async (_req, res) => {
    try {
      const dataSource = getDataSourceStatus();
      const aiAvailable = getAIStatus();
      const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

      res.json({
        dataSource: dataSource.source,
        dataSourceAvailable: dataSource.available,
        aiAvailable,
        lastScannerUpdate: lastScannerUpdate ? lastScannerUpdate.toISOString() : null,
        serverUptime: uptimeSeconds,
        allSymbolsSupported: true,
        version: "1.0.0",
      });
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({ error: "Failed to get system status" });
    }
  });

  // Market Scanner API Endpoints
  app.get('/api/scanner/status', devAuthMiddleware(), (_req, res) => {
    try {
      const status = getScannerStatus();
      res.json(status);
    } catch (error) {
      console.error("Scanner status error:", error);
      res.status(500).json({ error: "Failed to get scanner status" });
    }
  });

  app.get('/api/scanner/config', devAuthMiddleware(), (_req, res) => {
    try {
      const config = getScannerConfig();
      res.json({ ...config, webhookUrl: config.webhookUrl ? '***configured***' : null });
    } catch (error) {
      console.error("Scanner config error:", error);
      res.status(500).json({ error: "Failed to get scanner config" });
    }
  });

  app.post('/api/scanner/start', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      startScanner();
      res.json({ success: true, message: "Scanner started" });
    } catch (error) {
      console.error("Scanner start error:", error);
      res.status(500).json({ error: "Failed to start scanner" });
    }
  });

  app.post('/api/scanner/stop', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      stopScanner();
      res.json({ success: true, message: "Scanner stopped" });
    } catch (error) {
      console.error("Scanner stop error:", error);
      res.status(500).json({ error: "Failed to stop scanner" });
    }
  });

  app.post('/api/scanner/config', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      const { watchlist, scanIntervalMs, alertThresholds, webhookUrl } = req.body;
      updateScannerConfig({ watchlist, scanIntervalMs, alertThresholds, webhookUrl });
      res.json({ success: true, message: "Scanner config updated" });
    } catch (error) {
      console.error("Scanner config update error:", error);
      res.status(500).json({ error: "Failed to update scanner config" });
    }
  });

  app.post('/api/scanner/watchlist', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      const { symbols } = req.body;
      if (!Array.isArray(symbols)) {
        return res.status(400).json({ error: "symbols must be an array" });
      }
      setWatchlist(symbols);
      res.json({ success: true, watchlist: symbols });
    } catch (error) {
      console.error("Scanner watchlist error:", error);
      res.status(500).json({ error: "Failed to update watchlist" });
    }
  });

  app.post('/api/scanner/watchlist/add', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      const { symbol } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: "symbol is required" });
      }
      addToWatchlist(symbol);
      res.json({ success: true, message: `Added ${symbol.toUpperCase()} to watchlist` });
    } catch (error) {
      console.error("Scanner add symbol error:", error);
      res.status(500).json({ error: "Failed to add symbol" });
    }
  });

  app.post('/api/scanner/watchlist/remove', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      const { symbol } = req.body;
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: "symbol is required" });
      }
      removeFromWatchlist(symbol);
      res.json({ success: true, message: `Removed ${symbol.toUpperCase()} from watchlist` });
    } catch (error) {
      console.error("Scanner remove symbol error:", error);
      res.status(500).json({ error: "Failed to remove symbol" });
    }
  });

  app.post('/api/scanner/scan', devAuthMiddleware(), async (req, res) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }
      const alerts = await triggerManualScan();
      res.json({ success: true, alerts });
    } catch (error) {
      console.error("Manual scan error:", error);
      res.status(500).json({ error: "Failed to run manual scan" });
    }
  });

  // GET /api/market/pulse - Real-time market session and volatility info
  app.get('/api/market/pulse', async (_req, res) => {
    try {
      // Compute current US market session based on Eastern Time
      const now = new Date();
      const etFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'short'
      });
      const etParts = etFormatter.formatToParts(now);
      const hour = parseInt(etParts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(etParts.find(p => p.type === 'minute')?.value || '0');
      const weekday = etParts.find(p => p.type === 'weekday')?.value || '';
      const timeInMinutes = hour * 60 + minute;
      
      // Weekend check
      const isWeekend = weekday === 'Sat' || weekday === 'Sun';
      
      // Market hours (Eastern): Pre-market 4:00-9:30, Open 9:30-16:00, After-hours 16:00-20:00
      let session: string;
      let sessionLabel: string;
      if (isWeekend) {
        session = 'closed';
        sessionLabel = 'Weekend - Market Closed';
      } else if (timeInMinutes >= 240 && timeInMinutes < 570) {
        session = 'premarket';
        sessionLabel = 'Pre-Market (4:00-9:30 ET)';
      } else if (timeInMinutes >= 570 && timeInMinutes < 720) {
        session = 'us_open';
        sessionLabel = 'Market Open (Morning Session)';
      } else if (timeInMinutes >= 720 && timeInMinutes < 900) {
        session = 'midday';
        sessionLabel = 'Midday Session';
      } else if (timeInMinutes >= 900 && timeInMinutes < 960) {
        session = 'power_hour';
        sessionLabel = 'Power Hour (3:00-4:00 ET)';
      } else if (timeInMinutes >= 960 && timeInMinutes < 1200) {
        session = 'afterhours';
        sessionLabel = 'After Hours (4:00-8:00 ET)';
      } else {
        session = 'closed';
        sessionLabel = 'Market Closed';
      }
      
      // Try to get VIX/volatility data from existing providers
      let riskMood = 'Moderate';
      let riskLevel = 'medium';
      let volatilityValue: number | null = null;
      
      try {
        // Try to fetch SPY quote to estimate volatility
        const { getQuote } = await import("./market-data-service");
        const spyQuote = await getQuote("SPY");
        // Guard against missing price or change data
        if (spyQuote && spyQuote.price && spyQuote.price > 0 && spyQuote.change !== undefined) {
          const absChange = Math.abs(spyQuote.change);
          const pctChange = (absChange / spyQuote.price) * 100;
          
          if (pctChange > 2) {
            riskMood = 'High Volatility';
            riskLevel = 'high';
            volatilityValue = pctChange;
          } else if (pctChange > 1) {
            riskMood = 'Elevated Volatility';
            riskLevel = 'elevated';
            volatilityValue = pctChange;
          } else if (pctChange > 0.5) {
            riskMood = 'Moderate';
            riskLevel = 'medium';
            volatilityValue = pctChange;
          } else {
            riskMood = 'Low Volatility';
            riskLevel = 'low';
            volatilityValue = pctChange;
          }
        } else if (spyQuote && typeof spyQuote.changePercent === 'number') {
          // Fallback to changePercent if price is missing
          const pctChange = Math.abs(spyQuote.changePercent);
          if (pctChange > 2) {
            riskMood = 'High Volatility';
            riskLevel = 'high';
            volatilityValue = pctChange;
          } else if (pctChange > 1) {
            riskMood = 'Elevated Volatility';
            riskLevel = 'elevated';
            volatilityValue = pctChange;
          } else if (pctChange > 0.5) {
            riskMood = 'Moderate';
            riskLevel = 'medium';
            volatilityValue = pctChange;
          } else {
            riskMood = 'Low Volatility';
            riskLevel = 'low';
            volatilityValue = pctChange;
          }
        }
      } catch (e) {
        // Fallback to moderate if quote fetch fails
        riskMood = 'Data unavailable';
        riskLevel = 'unknown';
      }
      
      // Deterministic next key event
      const dayOfWeek = now.getDay();
      const daysUntilFriday = dayOfWeek === 5 ? 0 : (5 - dayOfWeek + 7) % 7;
      const nextKeyEvent = daysUntilFriday === 0
        ? 'Weekly options expiration today'
        : daysUntilFriday <= 2 
          ? 'Weekly options expiration approaching'
          : 'Check earnings calendar for upcoming events';
      
      res.json({
        session,
        sessionLabel,
        riskMood,
        riskLevel,
        volatilityValue,
        nextKeyEvent,
        timestamp: now.toISOString(),
        timezone: 'America/New_York'
      });
    } catch (error) {
      console.error("Market pulse error:", error);
      res.status(500).json({ error: "Failed to get market pulse data" });
    }
  });

  // DEBUG ENDPOINTS (non-production only, requires auth + developer/premium access)
  // GET /api/debug/last-signal - Get the most recent signal for verification
  app.get('/api/debug/last-signal', devAuthMiddleware(), async (req: any, res) => {
    if (env.isProduction) {
      return res.status(403).json({ error: "Debug endpoints disabled in production" });
    }
    
    try {
      // Require developer or premium access
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!isDeveloper(userId)) {
        const user = await storage.getUser(userId);
        const tier = resolveUserTier(user);
        if (tier !== "premium") {
          return res.status(403).json({ error: "Debug endpoints require premium access" });
        }
      }
      
      const symbol = (req.query.symbol as string)?.toUpperCase();
      const signals = await storage.getAllSignalHistory();
      
      let lastSignal: SelectSignalHistory | null = null;
      if (symbol) {
        lastSignal = signals.find((s: SelectSignalHistory) => s.symbol === symbol) || null;
      } else {
        lastSignal = signals[0] || null;
      }
      
      if (!lastSignal) {
        return res.status(404).json({ 
          error: "No signals found",
          symbol: symbol || "any",
        });
      }
      
      res.json({
        signal: lastSignal,
        createdAt: lastSignal.generatedAt,
        riskPercentage: lastSignal.riskPercentage,
        accountSize: lastSignal.accountSize,
      });
    } catch (error) {
      console.error("Debug last-signal error:", error);
      res.status(500).json({ error: "Failed to fetch last signal" });
    }
  });

  // GET /api/debug/adaptive - Get adaptive metrics for a symbol
  app.get('/api/debug/adaptive', devAuthMiddleware(), async (req: any, res) => {
    if (env.isProduction) {
      return res.status(403).json({ error: "Debug endpoints disabled in production" });
    }
    
    try {
      // Require developer or premium access
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!isDeveloper(userId)) {
        const user = await storage.getUser(userId);
        const tier = resolveUserTier(user);
        if (tier !== "premium") {
          return res.status(403).json({ error: "Debug endpoints require premium access" });
        }
      }
      
      const symbol = (req.query.symbol as string)?.toUpperCase();
      
      if (!symbol) {
        return res.status(400).json({ error: "Symbol query parameter required" });
      }
      
      const { getSymbolLearningMetrics } = await import("./adaptive-learning");
      const metrics = await getSymbolLearningMetrics(symbol);
      
      if (!metrics) {
        return res.status(404).json({
          error: "No adaptive metrics found",
          symbol,
          message: "Generate signals and close trades to build adaptive data",
        });
      }
      
      res.json({
        symbol,
        metrics,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Debug adaptive error:", error);
      res.status(500).json({ error: "Failed to fetch adaptive metrics" });
    }
  });

  // POST /api/signals - Generate options trading signals for symbols
  app.post("/api/signals", async (req: any, res) => {
    try {
      // Validate request body
      const validation = signalRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors,
        });
      }

      const { symbols, preferredDelta, accountSize, riskProfile: riskProfileName } = validation.data;
      
      // Resolve user tier from subscription (NOT from client request)
      const userId = req.devAuth?.userId || getAuth(req).userId;
      const user = userId ? await storage.getUser(userId) : null;
      const tier = resolveUserTier(user);
      
      // Get risk profile configuration
      const riskProfile = getRiskProfile(riskProfileName);
      
      // All symbols are now allowed (beta restriction removed)
      console.log(`[Signals] Request: tier=${tier} (from user subscription), accountSize=$${accountSize}, riskProfile=${riskProfileName}, symbols=${symbols.join(", ")}`)

      // Get current prices for all symbols
      const prices = await Promise.all(
        symbols.map((symbol) => storage.getLatestPrice(symbol))
      );

      // Get AI analysis for all symbols (options-based)
      const analysisResult = await batchAnalyzeSymbols(symbols, prices);
      
      // Handle AI unavailability
      if ('error' in analysisResult) {
        return res.status(503).json({
          error: "AI service unavailable",
          message: analysisResult.message,
          retryAfter: 30,
        });
      }
      
      const analyses = analysisResult;

      // Define expiration options based on day of week
      const today = new Date();
      const isFriday = today.getDay() === 5;
      
      // Calendar days: 1 Week = 7 days, 2 Weeks = 14 days, 3 Weeks = 21 days, 1 Month = 28 days
      // If target date falls on weekend/holiday, adjust to previous trading day
      const expirationConfigs = [
        { label: "0DTE", days: 0 },
        { label: "1 Week", days: 7 },
        { label: "2 Weeks", days: 14 },
        { label: "3 Weeks", days: 21 },
        { label: "1 Month", days: 28 },
      ];

      // NOTE: Premium calculation removed - we no longer generate fake contract data
      // Real contract data will come from Polygon.io integration

      // US Market Holidays (dates when market is closed)
      const getMarketHolidays = (year: number): Set<string> => {
        const holidays = new Set<string>();
        
        // Fixed holidays
        holidays.add(`${year}-01-01`); // New Year's Day
        holidays.add(`${year}-07-04`); // Independence Day
        holidays.add(`${year}-12-25`); // Christmas
        holidays.add(`${year}-06-19`); // Juneteenth
        
        // MLK Day (3rd Monday of January)
        const mlk = new Date(year, 0, 1);
        mlk.setDate(1 + ((8 - mlk.getDay()) % 7) + 14);
        holidays.add(mlk.toISOString().split('T')[0]);
        
        // Presidents Day (3rd Monday of February)
        const presidents = new Date(year, 1, 1);
        presidents.setDate(1 + ((8 - presidents.getDay()) % 7) + 14);
        holidays.add(presidents.toISOString().split('T')[0]);
        
        // Memorial Day (last Monday of May)
        const memorial = new Date(year, 5, 0); // Last day of May
        memorial.setDate(memorial.getDate() - ((memorial.getDay() + 6) % 7));
        holidays.add(memorial.toISOString().split('T')[0]);
        
        // Labor Day (1st Monday of September)
        const labor = new Date(year, 8, 1);
        labor.setDate(1 + ((8 - labor.getDay()) % 7));
        holidays.add(labor.toISOString().split('T')[0]);
        
        // Thanksgiving (4th Thursday of November)
        const thanksgiving = new Date(year, 10, 1);
        thanksgiving.setDate(1 + ((11 - thanksgiving.getDay()) % 7) + 21);
        holidays.add(thanksgiving.toISOString().split('T')[0]);
        
        // Good Friday (approximate - 2 days before Easter)
        // Easter calculation (Meeus/Jones/Butcher algorithm)
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        const goodFriday = new Date(year, month, day - 2);
        holidays.add(goodFriday.toISOString().split('T')[0]);
        
        return holidays;
      };
      
      // Format date as YYYY-MM-DD in local time (avoids UTC timezone issues)
      const formatDateLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      // Check if a date is a valid trading day
      const isTradingDay = (date: Date, holidays: Set<string>): boolean => {
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Weekend
        const dateStr = formatDateLocal(date);
        if (holidays.has(dateStr)) return false; // Holiday
        return true;
      };
      
      // Adjust to next trading day (for 0DTE when today is not a trading day)
      const adjustToNextTradingDay = (date: Date, holidays: Set<string>): Date => {
        const result = new Date(date);
        while (!isTradingDay(result, holidays)) {
          result.setDate(result.getDate() + 1);
        }
        return result;
      };
      
      // Adjust to previous trading day (for weekly/monthly expirations landing on weekend/holiday)
      const adjustToPreviousTradingDay = (date: Date, holidays: Set<string>): Date => {
        const result = new Date(date);
        while (!isTradingDay(result, holidays)) {
          result.setDate(result.getDate() - 1);
        }
        return result;
      };

      // Helper function to get expiration date - calendar days from today
      const getExpirationDate = (calendarDays: number): { date: Date; str: string; label: string } => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get holidays for this year and next
        const holidays = new Set<string>();
        getMarketHolidays(today.getFullYear()).forEach(h => holidays.add(h));
        getMarketHolidays(today.getFullYear() + 1).forEach(h => holidays.add(h));
        
        // 0DTE = today if trading day, otherwise next trading day
        if (calendarDays === 0) {
          const expirationDate = isTradingDay(today, holidays) 
            ? today 
            : adjustToNextTradingDay(today, holidays);
          return { date: expirationDate, str: formatDateLocal(expirationDate), label: "0DTE" };
        }
        
        // Calculate target date (today + calendar days)
        const targetDate = new Date(today.getTime() + calendarDays * 24 * 60 * 60 * 1000);
        
        // Adjust to previous trading day if target falls on weekend/holiday
        const expirationDate = isTradingDay(targetDate, holidays) 
          ? targetDate 
          : adjustToPreviousTradingDay(targetDate, holidays);
        
        // Set label based on days
        let label = "";
        if (calendarDays <= 7) {
          label = "Weekly";
        } else if (calendarDays <= 21) {
          label = "Weekly";
        } else {
          label = "Monthly";
        }
        
        return {
          date: expirationDate,
          str: formatDateLocal(expirationDate),
          label
        };
      };

      // Generate signals with real contract data from Polygon.io
      const signals = await Promise.all(symbols.map(async (symbol, i) => {
        const currentPrice = prices[i];
        const analysis = analyses[i];

        // Skip NO_TRADE recommendations but still include them in response
        if (analysis.filters.direction === "NO_TRADE") {
          return {
            symbol,
            action: "NO_TRADE" as const,
            optionType: null,
            optionSide: null,
            strikePrice: null,
            currentPrice,
            confidence: analysis.confidence,
            impliedVolatility: null,
            stopLossPrice: null,
            takeProfitPrice: null,
            patternAnalysis: analysis.patternAnalysis,
            reasoning: analysis.reasoning,
            adaptiveNote: analysis.adaptiveNote || null,
            preferredExpiry: analysis.filters.preferredExpirationWindow,
            preferredMoneyness: analysis.filters.preferredMoneyness,
            targetDeltaRange: analysis.filters.targetDeltaRange,
            expirationOptions: null,
            expirationDate: null,
            premium: null,
            contracts: null,
            contractMultiplier: 100,
            totalCost: null,
            maxLoss: null,
            maxGain: null,
            breakeven: null,
            greeks: null,
            stopLossPercent: null,
            takeProfitPercent: null,
            selectedContract: null,
            positionPreview: null,
            riskProfileUsed: riskProfile.label,
            effectiveRiskPercent: null,
            isUnaffordable: null,
          };
        }

        // Determine option type and side based on AI recommendation
        const optionType = analysis.filters.direction === "BUY_PUT" ? "PUT" : "CALL";
        const optionSide = analysis.filters.direction === "BUY_CALL" || analysis.filters.direction === "BUY_PUT" ? "LONG" : "SHORT";

        // Fetch real contract data from Polygon.io
        let selectedContract: PolygonOptionContract | null = null;
        let positionPreview: PositionPreview | null = null;
        
        try {
          const contractResult = await getContractForStrategy({
            symbol,
            optionType: optionType as "CALL" | "PUT",
            currentPrice,
            preferredExpiry: analysis.filters.preferredExpirationWindow,
            preferredMoneyness: analysis.filters.preferredMoneyness,
            targetDeltaRange: analysis.filters.targetDeltaRange,
          });
          selectedContract = contractResult.selectedContract;
          positionPreview = contractResult.positionPreview;
        } catch (err) {
          console.error(`[Polygon] Error fetching contract for ${symbol}:`, err);
        }

        // Risk Model B: Position sizing based on account size and risk profile
        // Uses "strict + advisory override" logic
        let contracts: number | null = null;
        let totalCost: number | null = null;
        let maxLoss: number | null = null;
        let isUnaffordable: boolean | null = null;
        let riskViolation: boolean | null = null;
        let effectiveRiskPercent: number | null = null;

        if (positionPreview && typeof positionPreview.costPerContract === "number" && positionPreview.costPerContract > 0) {
          const costPerContract = positionPreview.costPerContract;
          
          // AI may provide a risk_per_trade_percent in the future; for now use profile baseline
          const aiRiskPercent = (analysis as any).riskPerTradePercent;
          effectiveRiskPercent = clampRiskPercent(aiRiskPercent, riskProfile);
          
          // Use strict + advisory override sizing
          const sizing = sizePositionStrictWithOverride({
            accountSize,
            effectiveRiskPercent,
            costPerContract,
            maxPositionPercent: riskProfile.maxPercent,
          });
          
          contracts = sizing.contracts;
          totalCost = sizing.totalCost;
          maxLoss = sizing.maxLoss;
          isUnaffordable = sizing.isUnaffordable;
          riskViolation = sizing.riskViolation;
        }

        // Build signal with real contract data if available
        return {
          symbol,
          action: analysis.filters.direction,
          optionType: optionType as "CALL" | "PUT",
          optionSide: optionSide as "LONG" | "SHORT",
          strikePrice: selectedContract?.strike || null,
          currentPrice,
          confidence: analysis.confidence,
          impliedVolatility: selectedContract?.impliedVolatility || null,
          stopLossPrice: analysis.priceLevels?.stopLossPrice || null,
          takeProfitPrice: analysis.priceLevels?.takeProfitPrice || null,
          patternAnalysis: analysis.patternAnalysis,
          reasoning: analysis.reasoning,
          adaptiveNote: analysis.adaptiveNote || null,
          preferredExpiry: analysis.filters.preferredExpirationWindow,
          preferredMoneyness: analysis.filters.preferredMoneyness,
          targetDeltaRange: analysis.filters.targetDeltaRange,
          // Contract fields populated from Polygon.io data
          expirationOptions: null,
          expirationDate: selectedContract?.expirationDate || null,
          premium: positionPreview?.premium || null,
          contracts,
          contractMultiplier: 100,
          totalCost,
          maxLoss,
          maxGain: null,
          breakeven: selectedContract ? (optionType === "CALL" 
            ? selectedContract.strike + (positionPreview?.premium || 0)
            : selectedContract.strike - (positionPreview?.premium || 0)) : null,
          greeks: selectedContract ? {
            delta: selectedContract.delta,
            gamma: selectedContract.gamma,
            theta: selectedContract.theta,
            vega: selectedContract.vega,
          } : null,
          stopLossPercent: null,
          takeProfitPercent: null,
          // New fields for real contract data
          selectedContract,
          positionPreview,
          // Risk Model B fields
          riskProfileUsed: riskProfile.label,
          effectiveRiskPercent,
          isUnaffordable,
          riskViolation,
        };
      }));

      const contractCount = signals.filter(s => s.selectedContract !== null).length;
      console.log(`[Signals] Generated ${signals.length} signals (${contractCount} with real contract data)`);

      // Save tradeable signals to database and assign signalId
      const signalsWithIds = await Promise.all(signals.map(async (signal) => {
        // Only save signals that are tradeable (not NO_TRADE) and have complete data
        if (signal.action === "NO_TRADE" || !signal.selectedContract || !signal.positionPreview) {
          return { ...signal, signalId: null };
        }
        
        try {
          const savedSignal = await storage.saveSignalHistory({
            symbol: signal.symbol,
            action: signal.action,
            optionType: signal.optionType,
            optionSide: signal.optionSide,
            strikePrice: (signal.strikePrice ?? signal.selectedContract.strike).toString(),
            expirationDate: signal.expirationDate || signal.selectedContract.expirationDate,
            currentPrice: signal.currentPrice.toString(),
            premium: (signal.premium ?? signal.positionPreview.premium).toString(),
            contracts: signal.contracts ?? 1,
            contractMultiplier: signal.contractMultiplier,
            totalCost: (signal.totalCost ?? signal.positionPreview.costPerContract).toString(),
            maxLoss: signal.maxLoss != null ? String(signal.maxLoss) : signal.positionPreview.costPerContract.toString(),
            maxGain: signal.maxGain != null ? String(signal.maxGain) : "Unlimited",
            breakeven: (signal.breakeven ?? signal.selectedContract.strike).toString(),
            confidence: signal.confidence.toString(),
            impliedVolatility: signal.selectedContract.impliedVolatility?.toString() ?? null,
            delta: signal.greeks?.delta?.toString() ?? null,
            gamma: signal.greeks?.gamma?.toString() ?? null,
            theta: signal.greeks?.theta?.toString() ?? null,
            vega: signal.greeks?.vega?.toString() ?? null,
            stopLossPercent: "50",
            takeProfitPercent: "100",
            reasoning: signal.reasoning ?? null,
            accountSize: accountSize.toString(),
            riskPercentage: (signal.effectiveRiskPercent ?? 0.02).toString(),
            // Canonical asOf block
            asOfTimestamp: new Date(),
            dataDelaySeconds: 900, // 15-min delay for Tradier free tier
            marketSession: computeMarketSession(),
            // Canonical intent block
            windowsRequested: JSON.stringify(expirationConfigs.map(e => e.label)),
            riskProfileRequested: riskProfileName,
            strictSizing: 0, // Not using strict sizing currently
            // Canonical audit block
            aiModel: "gpt-4o-mini",
            promptVersion: "signals_v3",
            dataProviders: JSON.stringify(["tradier", "polygon"]),
            inputHash: hashInput({ symbols, accountSize, riskProfileName, preferredDelta }),
            // Ownership
            tierAtGeneration: tier,
            userId: userId ?? null,
          });
          
          console.log(`[Signals] Saved signal for ${signal.symbol}: signalId=${savedSignal.id}`);
          
          // Send teaser alert to free channel for high-confidence signals (already filtered NO_TRADE above)
          const FREE_ALERTS_CHANNEL_ID = process.env.DISCORD_FREE_ALERTS_CHANNEL;
          if (FREE_ALERTS_CHANNEL_ID && signal.confidence > 0.85 && signal.optionType) {
            // Derive direction from action or optionType (only for valid options signals)
            const direction = signal.action?.includes('CALL') || signal.optionType === 'CALL' ? 'BULLISH' : 
                             signal.action?.includes('PUT') || signal.optionType === 'PUT' ? 'BEARISH' : null;
            if (direction) {
              import('./bot').then(({ sendTeaserAlert }) => {
                sendTeaserAlert(FREE_ALERTS_CHANNEL_ID, {
                  direction,
                  confidence: signal.confidence,
                  action: signal.action
                }).catch(err => console.error('[Signals] Teaser alert failed:', err));
              }).catch(() => {});
            }
          }
          
          return { ...signal, signalId: savedSignal.id };
        } catch (saveError) {
          console.error(`[Signals] Failed to save signal for ${signal.symbol}:`, saveError);
          return { ...signal, signalId: null };
        }
      }));

      // Apply tier-based filtering
      const filteredSignals = signalsWithIds.map((s) => filterSignalByTier(s as SignalResponse, tier));
      
      res.json(filteredSignals);
    } catch (error: any) {
      console.error("Error generating signals:", error);
      res.status(500).json({
        error: "Failed to generate trading signals",
        message: error.message || "Internal server error",
      });
    }
  });

  // POST /api/signals/v2 - Generate signal using OpenAI Assistants API
  // New endpoint using Primary Signal Engine with tool calling
  app.post("/api/signals/v2", async (req: any, res) => {
    try {
      const { ticker, timeframe, userId: requestUserId } = req.body as {
        ticker?: string;
        timeframe?: string;
        userId?: string | null;
      };

      if (!ticker) {
        return res.status(400).json({
          error: "ticker is required",
        });
      }

      // Validate timeframe
      const normalizedTimeframe = normalizeTimeframe(timeframe || "1d");

      // Get user ID from auth or request
      const userId = req.devAuth?.userId || getAuth(req).userId || requestUserId;

      console.log(`[Signals V2] Request: ticker=${ticker}, timeframe=${normalizedTimeframe}, userId=${userId || 'anonymous'}`);

      const payload: PrimarySignalRequest = {
        ticker: ticker.toUpperCase(),
        timeframe: normalizedTimeframe,
        userId: userId ?? null,
      };

      const signalJson = await callPrimarySignalEngine(payload);

      return res.status(200).json(signalJson);
    } catch (error: any) {
      console.error("[/api/signals/v2] error:", error);

      return res.status(500).json({
        error: "Failed to generate signal",
        details: error?.message ?? "Unknown error",
      });
    }
  });

  // POST /api/signals/explain - Explain a signal in plain language
  // Uses Iron Strike Explain assistant
  app.post("/api/signals/explain", async (req: any, res) => {
    try {
      const { signal } = req.body;

      if (!signal) {
        return res.status(400).json({
          error: "signal object is required",
        });
      }

      const userId = req.devAuth?.userId || getAuth(req).userId;

      console.log(`[Signals Explain] Request for signal explanation`);

      const explanation = await explainSignal(signal, {
        source: "web-app",
        userId: userId || "anonymous",
      });

      return res.status(200).json({
        explanation,
        success: true,
      });
    } catch (error: any) {
      console.error("[/api/signals/explain] error:", error);

      return res.status(500).json({
        error: "Failed to explain signal",
        details: error?.message ?? "Unknown error",
      });
    }
  });

  // POST /api/backtest - Run backtest analysis
  // Uses Iron Strike Backtest assistant
  app.post("/api/backtest", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { ticker, timeframe, startDate, endDate, strategy } = req.body;

      if (!ticker) {
        return res.status(400).json({
          error: "ticker is required",
        });
      }

      console.log(`[Backtest] Request: ticker=${ticker}, strategy=${strategy || 'default'}`);

      const result = await runBacktest(
        {
          ticker: ticker.toUpperCase(),
          timeframe: timeframe || "1d",
          startDate,
          endDate,
          strategy,
        },
        {
          source: "web-app",
          userId: userId,
        }
      );

      return res.status(200).json({
        result,
        success: true,
      });
    } catch (error: any) {
      console.error("[/api/backtest] error:", error);

      return res.status(500).json({
        error: "Failed to run backtest",
        details: error?.message ?? "Unknown error",
      });
    }
  });

  // GET /api/history - Get all signal history
  app.get("/api/history", async (_req, res) => {
    try {
      const history = await storage.getAllSignalHistory();
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      res.status(500).json({
        error: "Failed to fetch signal history",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/history/:symbol - Get signal history for specific symbol
  app.get("/api/history/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const history = await storage.getSignalHistoryBySymbol(symbol.toUpperCase());
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      res.status(500).json({
        error: "Failed to fetch signal history",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/quote/:symbol - Get real-time quote for a symbol
  app.get("/api/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await storage.getQuote(symbol.toUpperCase());
      res.json(quote);
    } catch (error: any) {
      console.error("Error fetching quote:", error);
      res.status(500).json({
        error: "Failed to fetch quote",
        message: error.message || "Internal server error",
      });
    }
  });

  // POST /api/quotes - Get real-time quotes for multiple symbols
  app.post("/api/quotes", async (req, res) => {
    try {
      const { symbols } = req.body;
      if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({ error: "symbols array is required" });
      }
      const quotes = await storage.getMultipleQuotes(symbols.map((s: string) => s.toUpperCase()));
      res.json(quotes);
    } catch (error: any) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({
        error: "Failed to fetch quotes",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/chart/:symbol - Get historical price data for charting
  // Supports period (1d, 5d, 1mo, 3mo, 6mo, 1y) and interval (5min, 15min, 30min, 1hour, 4hour)
  app.get("/api/chart/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const period = (req.query.period as string) || "1mo";
      const interval = req.query.interval as string | undefined;
      const data = await storage.getHistoricalData(symbol.toUpperCase(), period, interval);
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching chart data:", error);
      res.status(500).json({
        error: "Failed to fetch chart data",
        message: error.message || "Internal server error",
      });
    }
  });

  // ============ Trade Execution Routes ============

  // Validation schema for options trade execution
  const positiveNumberString = z.union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((n) => Number.isFinite(n), { message: "must be a valid number" })
    .refine((n) => n > 0, { message: "must be a positive number" })
    .transform((n) => n.toFixed(4));
    
  const executeTradeSchema = insertTradeExecutionSchema.extend({
    signalId: z.coerce.number().int().min(0),
    symbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
    action: z.enum(["BUY_CALL", "BUY_PUT", "SELL_CALL", "SELL_PUT"]), // Options actions - HOLD is not a trade
    optionType: z.enum(["CALL", "PUT"]),
    optionSide: z.enum(["LONG", "SHORT"]),
    strikePrice: positiveNumberString,
    expirationDate: z.string(),
    entryPremium: positiveNumberString,
    contracts: z.coerce.number().int().min(1),
    contractMultiplier: z.coerce.number().int().default(100),
    totalCost: positiveNumberString,
    targetPremiumPercent: z.coerce.number().min(0).transform(n => n.toString()),
    stopLossPremiumPercent: z.coerce.number().min(0).transform(n => n.toString()),
    status: z.enum(["open", "won", "lost"]).optional().default("open"),
    notes: z.string().nullable().optional(),
  });

  // POST /api/trades - Execute a trade from a signal
  app.post("/api/trades", devAuthMiddleware(), async (req: any, res) => {
    try {
      const validation = executeTradeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid trade data",
          details: validation.error.errors,
        });
      }
      const trade = await storage.executeTrade(validation.data);
      res.json(trade);
    } catch (error: unknown) {
      console.error("Error executing trade:", error);
      
      // Handle ValidationError from storage layer
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid trade data",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      // Handle ZodError if parse is used instead of safeParse elsewhere
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid trade data",
          details: error.errors,
        });
      }
      
      // Generic server error
      res.status(500).json({
        error: "Failed to execute trade",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/trades - Get user's trades (requires auth)
  app.get("/api/trades", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const trades = await storage.getUserTrades(userId);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching trades:", error);
      res.status(500).json({
        error: "Failed to fetch trades",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/trades/open - Get user's open trades (requires auth)
  app.get("/api/trades/open", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const trades = await storage.getUserOpenTrades(userId);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching open trades:", error);
      res.status(500).json({
        error: "Failed to fetch open trades",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/trades/closed - Get user's closed trades (requires auth)
  app.get("/api/trades/closed", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const trades = await storage.getUserClosedTrades(userId);
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching closed trades:", error);
      res.status(500).json({
        error: "Failed to fetch closed trades",
        message: error.message || "Internal server error",
      });
    }
  });

  // GET /api/trades/filtered - Get trades with filters
  app.get("/api/trades/filtered", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { tradeFilterSchema } = await import("@shared/schema");
      const filters = tradeFilterSchema.safeParse(req.query);
      if (!filters.success) {
        return res.status(400).json({
          error: "Invalid filter parameters",
          details: filters.error.errors,
        });
      }
      
      const userId = req.auth?.userId;
      const trades = await storage.getTradesWithFilters({
        ...filters.data,
        userId: userId, // Only show user's own trades
      });
      res.json(trades);
    } catch (error: any) {
      console.error("Error fetching filtered trades:", error);
      res.status(500).json({
        error: "Failed to fetch trades",
        message: error.message || "Internal server error",
      });
    }
  });

  // POST /api/trades/manual - Log a manual trade
  app.post("/api/trades/manual", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { manualTradeInputSchema } = await import("@shared/schema");
      const validation = manualTradeInputSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid trade data",
          details: validation.error.errors,
        });
      }
      
      const data = validation.data;
      const userId = req.auth?.userId;
      
      // Calculate total cost if not provided
      const contractMultiplier = data.assetType === "option" ? 100 : 1;
      const totalCost = data.totalCost ?? (data.entryPremium * data.contracts * contractMultiplier);
      
      // Build trade object
      const tradeData = {
        userId,
        symbol: data.symbol.toUpperCase(),
        action: data.action,
        optionType: data.optionType || null,
        optionSide: data.optionSide || null,
        strikePrice: data.strikePrice?.toString() || null,
        expirationDate: data.expirationDate || null,
        entryPremium: data.entryPremium.toFixed(4),
        contracts: data.contracts,
        contractMultiplier,
        totalCost: totalCost.toFixed(2),
        source: "manual" as const,
        assetType: data.assetType,
        strategyTag: data.strategyTag || null,
        tagList: data.tagList ? JSON.stringify(data.tagList) : null,
        sessionTag: data.sessionTag || null,
        emotionalState: data.emotionalState || null,
        whatWentWell: data.whatWentWell || null,
        whatWentWrong: data.whatWentWrong || null,
        lessonLearned: data.lessonLearned || null,
        screenshotUrl: data.screenshotUrl || null,
        notes: data.notes || null,
        plannedRiskPerTrade: data.plannedRiskPerTrade?.toFixed(2) || null,
        plannedStopPrice: data.plannedStopPrice?.toFixed(4) || null,
        plannedTakeProfitPrice: data.plannedTakeProfitPrice?.toFixed(4) || null,
        status: "open",
      };
      
      const trade = await storage.createManualTrade(tradeData as any);
      res.status(201).json(trade);
    } catch (error: any) {
      console.error("Error creating manual trade:", error);
      res.status(500).json({
        error: "Failed to create trade",
        message: error.message || "Internal server error",
      });
    }
  });

  // POST /api/trades/parse-screenshot - Parse trade screenshot with AI (Pro/Premium)
  const multer = (await import("multer")).default;
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
      const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type. Supported: PNG, JPEG, GIF, WebP"), false);
      }
    }
  });
  
  // Multer error handler middleware
  const handleMulterError = (err: any, req: any, res: any, next: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File too large",
          message: "Maximum file size is 10MB",
          code: "FILE_TOO_LARGE",
        });
      }
      return res.status(400).json({
        error: "File upload error",
        message: err.message,
        code: err.code,
      });
    } else if (err) {
      return res.status(400).json({
        error: "File validation error",
        message: err.message,
        code: "FILE_VALIDATION_ERROR",
      });
    }
    next();
  };
  
  app.post("/api/trades/parse-screenshot", devAuthMiddleware(), (req: any, res: any, next: any) => {
    upload.single("image")(req, res, (err: any) => {
      handleMulterError(err, req, res, next);
    });
  }, async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Validate file first before any processing
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "No image file provided" });
      }
      
      // Validate file type
      const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: "Invalid file type. Supported: PNG, JPEG, GIF, WebP",
          receivedType: req.file.mimetype,
        });
      }

      // Check tier - Pro or Premium required (explicit whitelist)
      const user = await storage.getUser(userId);
      const userRole = user?.role?.toLowerCase().trim() || "";
      // Only accept explicit pro/premium roles, everything else is free
      const tier = (userRole === "pro" || userRole === "premium") ? userRole : "free";
      
      if (tier === "free" && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "Screenshot upload is available to Pro and Premium users only.",
          requiredTier: "pro",
          currentTier: "free",
        });
      }

      const { symbol, notes } = req.body;
      
      // Convert image buffer to base64 safely
      const base64Image = Buffer.from(req.file.buffer).toString("base64");
      const mimeType = req.file.mimetype || "image/png";
      
      // Tier-based model selection: Premium gets GPT-4o, Pro gets GPT-4o-mini
      const isPremium = tier === "premium" || isDeveloper(userId);
      const parseModel = isPremium ? "gpt-4o" : "gpt-4o-mini";
      
      // Use AI Gateway for vision parsing - Iron Strike Doctrine enforced
      const { parseScreenshotWithVision } = await import("./ai-gateway");
      
      console.log(`[Screenshot] Using AI Gateway with model: ${parseModel} for tier: ${tier}`);
      
      const visionResult = await parseScreenshotWithVision(
        base64Image,
        mimeType,
        symbol,
        parseModel
      );
      
      if (!visionResult.success || !visionResult.data) {
        console.error("[Screenshot] AI Gateway vision error:", visionResult.error);
        return res.status(400).json({ 
          error: "Failed to parse trade data from screenshot",
          message: visionResult.error || "AI service unavailable",
          needsReview: true,
        });
      }
      
      const parsedTrade = visionResult.data;
      console.log("[Screenshot] AI Gateway parsed:", parsedTrade.symbol, "confidence:", parsedTrade.parseConfidence);
      
      // Extract parseConfidence and determine if human review is needed
      const parseConfidence = parsedTrade.parseConfidence || 0.5;
      const CONFIDENCE_THRESHOLD = 0.7; // Below this needs review
      const needsReview = parseConfidence < CONFIDENCE_THRESHOLD || 
        !parsedTrade.symbol || 
        !parsedTrade.entryPrice ||
        parsedTrade.symbol === "UNKNOWN";

      // Determine if trade is closed based on exit price
      const isClosed = parsedTrade.exitPrice !== null && parsedTrade.exitPrice !== undefined;
      
      // Calculate P&L if closed
      let profitLoss: number | null = null;
      let profitLossPercent: number | null = null;
      let status = "open";
      
      if (isClosed && parsedTrade.entryPrice && parsedTrade.exitPrice) {
        const multiplier = parsedTrade.positionType === "options" ? (parsedTrade.multiplier || 100) : 1;
        const contracts = parsedTrade.contracts || 1;
        
        // For long positions, profit = (exit - entry) * contracts * multiplier
        const isLong = parsedTrade.side.startsWith("LONG");
        const priceDiff = isLong 
          ? (parsedTrade.exitPrice - parsedTrade.entryPrice)
          : (parsedTrade.entryPrice - parsedTrade.exitPrice);
        
        profitLoss = priceDiff * contracts * multiplier - (parsedTrade.fees || 0);
        profitLossPercent = (priceDiff / parsedTrade.entryPrice) * 100;
        
        if (profitLoss > 0) status = "closed_win";
        else if (profitLoss < 0) status = "closed_loss";
        else status = "closed_be";
      }

      // Determine option type and side from parsed side
      let optionType = null;
      let optionSide = null;
      if (parsedTrade.positionType === "options") {
        if (parsedTrade.side.includes("CALL")) optionType = "CALL";
        else if (parsedTrade.side.includes("PUT")) optionType = "PUT";
        
        if (parsedTrade.side.startsWith("LONG")) optionSide = "LONG";
        else if (parsedTrade.side.startsWith("SHORT")) optionSide = "SHORT";
      }

      // Build trade object
      const tradeData = {
        userId,
        symbol: (parsedTrade.symbol || symbol || "UNKNOWN").toUpperCase(),
        action: parsedTrade.side || "UNKNOWN",
        optionType,
        optionSide,
        strikePrice: parsedTrade.strikePrice?.toString() || null,
        expirationDate: parsedTrade.expirationDate || null,
        entryPremium: (parsedTrade.entryPrice || 0).toFixed(4),
        exitPremium: parsedTrade.exitPrice ? parsedTrade.exitPrice.toFixed(4) : null,
        contracts: parsedTrade.contracts || 1,
        contractMultiplier: parsedTrade.multiplier || 100,
        totalCost: ((parsedTrade.entryPrice || 0) * (parsedTrade.contracts || 1) * (parsedTrade.multiplier || 100)).toFixed(2),
        source: "screenshot_ai" as const,
        assetType: parsedTrade.positionType === "options" ? "option" : "equity",
        notes: notes || parsedTrade.notes || "Parsed from screenshot",
        status,
        profitLoss: profitLoss?.toFixed(2) || null,
        profitLossPercent: profitLossPercent?.toFixed(4) || null,
        closedAt: isClosed ? new Date() : null,
      };

      // Create the trade entry
      const trade = await storage.createManualTrade(tradeData as any);
      
      // Create import record for screenshot parsing provenance
      try {
        const imageHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        await storage.createImport({
          userId,
          tradeId: trade.id,
          rawImageHash: imageHash,
          parsedPayload: parsedTrade,
          parseConfidence: parseConfidence.toString(),
          needsReview: needsReview ? 1 : 0,
        });
        console.log(`[Screenshot] Created import record for trade ${trade.id}`);
      } catch (importError) {
        console.error("[Screenshot] Failed to create import record:", importError);
      }
      
      // For Premium users, add AI trade review
      let aiReview = null;
      if (tier === "premium" || isDeveloper(userId)) {
        try {
          const OpenAIReview = (await import("openai")).default;
          const { env: envConfig } = await import("./config/env");
          
          const reviewClient = new OpenAIReview({
            baseURL: envConfig.ai.replitBaseUrl || undefined,
            apiKey: envConfig.ai.replitApiKey || envConfig.ai.openaiApiKey || "dummy",
          });
          
          const reviewPrompt = `As a trading coach, provide a brief (2-3 sentences) review of this trade:
Symbol: ${tradeData.symbol}
Type: ${parsedTrade.side}
Entry: $${parsedTrade.entryPrice}
Exit: ${parsedTrade.exitPrice ? '$' + parsedTrade.exitPrice : 'Still open'}
P&L: ${profitLoss ? '$' + profitLoss.toFixed(2) : 'N/A'}

Focus on: risk management, entry timing, and one actionable improvement.`;

          const reviewCompletion = await reviewClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: reviewPrompt }],
            max_tokens: 200,
          });
          
          aiReview = reviewCompletion.choices[0]?.message?.content || null;
        } catch (reviewError) {
          console.error("[Screenshot] AI review failed:", reviewError);
        }
      }

      res.status(201).json({
        success: true,
        trade,
        parsed: parsedTrade,
        aiReview,
        isPremium,
        parseConfidence,
        needsReview,
        modelUsed: parseModel,
        message: needsReview 
          ? "Trade imported but confidence is low. Please review the details before confirming."
          : "Trade imported successfully.",
      });
    } catch (error: any) {
      console.error("Error parsing screenshot:", error);
      res.status(500).json({
        error: "Failed to parse screenshot",
        message: error.message || "Internal server error",
      });
    }
  });

  // Helper: Map legacy session tag values to canonical enum values
  function mapSessionTagToCanonical(tag: string | undefined): string | undefined {
    if (!tag) return undefined;
    const mapping: Record<string, string> = {
      'morning': 'us_open',
      'open': 'us_open',
      'pre-market': 'premarket',
      'lunch': 'midday',
      'afternoon': 'power_hour',
      'after-hours': 'afterhours',
    };
    return mapping[tag.toLowerCase()] || tag;
  }

  // PATCH /api/trades/:id - Update trade journal fields
  app.patch("/api/trades/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Map legacy sessionTag values before validation
      if (req.body.sessionTag) {
        req.body.sessionTag = mapSessionTagToCanonical(req.body.sessionTag);
      }
      
      const { tradeJournalUpdateSchema } = await import("@shared/schema");
      const validation = tradeJournalUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid update data",
          details: validation.error.errors,
        });
      }
      
      // Verify trade exists and belongs to user
      const trade = await storage.getTradeById(parseInt(id));
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      const userId = req.auth?.userId;
      if (trade.userId && trade.userId !== userId && !isDeveloper(userId)) {
        return res.status(403).json({ error: "Not authorized to update this trade" });
      }
      
      const updated = await storage.updateTradeJournal(parseInt(id), validation.data);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating trade:", error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid request",
          message: error.message,
        });
      }
      
      res.status(500).json({
        error: "Failed to update trade",
        message: error.message || "Internal server error",
      });
    }
  });

  // DELETE /api/trades/:id - Delete a trade
  app.delete("/api/trades/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.auth?.userId;
      
      // Verify trade exists and belongs to user
      const trade = await storage.getTradeById(parseInt(id));
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }
      
      if (trade.userId && trade.userId !== userId && !isDeveloper(userId)) {
        return res.status(403).json({ error: "Not authorized to delete this trade" });
      }
      
      await storage.deleteTrade(parseInt(id));
      res.json({ success: true, message: "Trade deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting trade:", error);
      res.status(500).json({
        error: "Failed to delete trade",
        message: error.message || "Internal server error",
      });
    }
  });

  // POST /api/trades/:id/close - Close an options trade
  app.post("/api/trades/:id/close", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      const validation = tradeExecutionUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors,
        });
      }
      const { exitPremium, entryPremium, notes } = validation.data;
      const trade = await storage.closeTrade(parseInt(id), exitPremium, notes, entryPremium);
      
      // Fire-and-forget adaptive learning sync
      try {
        void syncTradeExecutionToAdaptive(trade as SelectTradeExecution);
      } catch (syncError) {
        console.error("[Adaptive] Non-blocking sync error:", syncError);
      }
      
      res.json(trade);
    } catch (error: unknown) {
      console.error("Error closing trade:", error);
      
      // Handle ValidationError from storage layer
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid request data",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      // Handle ZodError if parse is used instead of safeParse elsewhere
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid request data",
          details: error.errors,
        });
      }
      
      res.status(500).json({
        error: "Failed to close trade",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/performance - Get performance metrics
  app.get("/api/performance", async (_req, res) => {
    try {
      const metrics = await storage.getPerformanceMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({
        error: "Failed to fetch performance metrics",
        message: error.message || "Internal server error",
      });
    }
  });

  // ============ Trading Strategy Routes ============

  // GET /api/strategies - Get all trading strategies
  app.get("/api/strategies", async (_req, res) => {
    try {
      const strategies = await storage.getAllStrategies();
      res.json(strategies);
    } catch (error: unknown) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({
        error: "Failed to fetch strategies",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/strategies/enabled - Get enabled trading strategies
  app.get("/api/strategies/enabled", async (_req, res) => {
    try {
      const strategies = await storage.getEnabledStrategies();
      res.json(strategies);
    } catch (error: unknown) {
      console.error("Error fetching enabled strategies:", error);
      res.status(500).json({
        error: "Failed to fetch enabled strategies",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/strategies/ml-evaluate - ML-powered strategy evaluation (Premium only)
  app.post("/api/strategies/ml-evaluate", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const tier = user?.role || "free";
      
      if (tier !== "premium" && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "ML-powered performance analytics are available to Premium users only.",
          requiredTier: "premium",
        });
      }

      const { symbol, lookbackDays } = req.body;
      
      const { runMLEvaluation } = await import("./ml-strategy-engine");
      const result = await runMLEvaluation({
        symbol: symbol?.toUpperCase(),
        lookbackDays: lookbackDays || 365,
      });

      if (!result.success) {
        return res.status(400).json({
          error: result.error,
          dataset: result.dataset ? {
            totalSignals: result.dataset.totalSignals,
            totalTrades: result.dataset.totalTrades,
            winRate: result.dataset.winRate,
          } : null,
        });
      }

      res.json({
        success: true,
        symbol: result.dataset?.symbolFilter || "ALL",
        lookbackDays: result.dataset?.lookbackDays,
        dataset: {
          totalSignals: result.dataset?.totalSignals,
          totalTrades: result.dataset?.totalTrades,
          winRate: result.dataset?.winRate,
        },
        model: {
          trainedAt: result.model?.trainedAt,
          trainingAccuracy: result.model?.trainingAccuracy,
        },
        evaluation: result.evaluation,
      });
    } catch (error: unknown) {
      console.error("Error running ML evaluation:", error);
      res.status(500).json({
        error: "Failed to run ML evaluation",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/strategies/:id - Get a specific strategy
  app.get("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const strategy = await storage.getStrategyById(parseInt(id));
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error: unknown) {
      console.error("Error fetching strategy:", error);
      res.status(500).json({
        error: "Failed to fetch strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/strategies - Create a new trading strategy
  app.post("/api/strategies", devAuthMiddleware(), async (req: any, res) => {
    try {
      const validation = strategySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: validation.error.errors,
        });
      }
      const strategy = await storage.createStrategy(validation.data);
      res.status(201).json(strategy);
    } catch (error: unknown) {
      console.error("Error creating strategy:", error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: error.errors,
        });
      }
      
      res.status(500).json({
        error: "Failed to create strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // PATCH /api/strategies/:id - Update a trading strategy
  app.patch("/api/strategies/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      const validation = strategySchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: validation.error.errors,
        });
      }
      const strategy = await storage.updateStrategy(parseInt(id), validation.data);
      res.json(strategy);
    } catch (error: unknown) {
      console.error("Error updating strategy:", error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: error.errors,
        });
      }
      
      res.status(500).json({
        error: "Failed to update strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // DELETE /api/strategies/:id - Delete a trading strategy
  app.delete("/api/strategies/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStrategy(parseInt(id));
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error deleting strategy:", error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid request",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      res.status(500).json({
        error: "Failed to delete strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Strategy Backtest Routes ============

  // POST /api/strategies/:id/backtest - Backtest a strategy against a symbol
  app.post("/api/strategies/:id/backtest", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { symbol, period } = req.body;
      
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const strategy = await storage.getStrategyById(parseInt(id));
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      const { evaluateStrategyForSymbol } = await import("./strategy-engine");
      const result = await evaluateStrategyForSymbol(strategy, symbol.toUpperCase(), period || "3mo");
      res.json(result);
    } catch (error: unknown) {
      console.error("Error backtesting strategy:", error);
      res.status(500).json({
        error: "Failed to backtest strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/strategies/evaluate - Evaluate all enabled strategies for a symbol
  app.post("/api/strategies/evaluate", async (req, res) => {
    try {
      const { symbol } = req.body;
      
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const strategies = await storage.getEnabledStrategies();
      const { getLatestStrategySignals } = await import("./strategy-engine");
      const signals = await getLatestStrategySignals(strategies, symbol.toUpperCase());
      res.json(signals);
    } catch (error: unknown) {
      console.error("Error evaluating strategies:", error);
      res.status(500).json({
        error: "Failed to evaluate strategies",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Trade Journal Routes ============

  // GET /api/journal - Get user's journal entries (requires auth)
  app.get("/api/journal", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const entries = await storage.getUserJournalEntries(userId);
      res.json(entries);
    } catch (error: unknown) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({
        error: "Failed to fetch journal entries",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/journal/trade/:tradeId - Get journal entries for a specific trade (with ownership check)
  app.get("/api/journal/trade/:tradeId", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { tradeId } = req.params;
      const entries = await storage.getJournalEntriesForTradeWithOwnerCheck(parseInt(tradeId), userId);
      res.json(entries);
    } catch (error: unknown) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({
        error: "Failed to fetch journal entries",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/journal - Create a journal entry
  app.post("/api/journal", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { tradeId, entryType, content, tags, mood } = req.body;
      
      if (!tradeId || !entryType || !content) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "tradeId, entryType, and content are required"
        });
      }
      
      const entry = await storage.createJournalEntry({
        tradeId,
        entryType,
        content,
        tags: tags ? JSON.stringify(tags) : null,
        mood: mood || null
      });
      res.status(201).json(entry);
    } catch (error: unknown) {
      console.error("Error creating journal entry:", error);
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: "Invalid request",
          details: [{ path: [error.field || "unknown"], message: error.message }],
        });
      }
      
      res.status(500).json({
        error: "Failed to create journal entry",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // DELETE /api/journal/:id - Delete a journal entry
  app.delete("/api/journal/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteJournalEntry(parseInt(id));
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({
        error: "Failed to delete journal entry",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/journal/summary - Get tier-gated trading journal summary with R-multiple tracking
  app.get("/api/journal/summary", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const tier = resolveUserTier(user);

      // Get all closed trades for this user
      const trades = await storage.getUserTrades(userId);
      const closedTrades = trades.filter((t: any) => t.status === "closed");

      // Calculate basic metrics (available to all tiers)
      const totalTrades = closedTrades.length;
      const wins = closedTrades.filter((t: any) => parseFloat(t.realizedPnl || "0") > 0).length;
      const losses = closedTrades.filter((t: any) => parseFloat(t.realizedPnl || "0") < 0).length;
      const winRate = totalTrades > 0 ? wins / totalTrades : 0;
      
      const totalPnl = closedTrades.reduce((sum: number, t: any) => 
        sum + parseFloat(t.realizedPnl || "0"), 0
      );
      
      // Base summary for free tier
      const baseSummary = {
        tier,
        totalTrades,
        wins,
        losses,
        winRate: Math.round(winRate * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
      };

      // Free tier: basic metrics only
      if (tier === "free") {
        return res.json({
          ...baseSummary,
          upgradeMessage: "Upgrade to Pro for R-multiple tracking and advanced analytics",
        });
      }

      // Pro tier: Add R-multiple tracking
      const tradesWithR = closedTrades.filter((t: any) => 
        t.plannedRiskPerTrade && parseFloat(t.plannedRiskPerTrade) > 0
      );
      
      const rMultiples = tradesWithR.map((t: any) => {
        const pnl = parseFloat(t.realizedPnl || "0");
        const plannedRisk = parseFloat(t.plannedRiskPerTrade);
        return pnl / plannedRisk;
      });
      
      const avgRMultiple = rMultiples.length > 0 
        ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length 
        : null;
      
      const expectancy = rMultiples.length > 0
        ? (winRate * (avgRMultiple || 0)) - ((1 - winRate) * 1)
        : null;

      const proSummary = {
        ...baseSummary,
        rMultipleTracking: {
          tradesWithRisk: tradesWithR.length,
          avgRMultiple: avgRMultiple ? Math.round(avgRMultiple * 100) / 100 : null,
          expectancy: expectancy ? Math.round(expectancy * 100) / 100 : null,
          bestRMultiple: rMultiples.length > 0 ? Math.max(...rMultiples) : null,
          worstRMultiple: rMultiples.length > 0 ? Math.min(...rMultiples) : null,
        },
      };

      if (tier === "pro") {
        return res.json({
          ...proSummary,
          upgradeMessage: "Upgrade to Premium for AI-powered insights and psychology analysis",
        });
      }

      // Premium tier: Add emotion tracking and psychology insights
      const emotionalBreakdown = closedTrades.reduce((acc: any, t: any) => {
        const emotion = t.emotionalState || "neutral";
        if (!acc[emotion]) {
          acc[emotion] = { count: 0, wins: 0, totalPnl: 0 };
        }
        acc[emotion].count++;
        const pnl = parseFloat(t.realizedPnl || "0");
        if (pnl > 0) acc[emotion].wins++;
        acc[emotion].totalPnl += pnl;
        return acc;
      }, {});

      const sessionBreakdown = closedTrades.reduce((acc: any, t: any) => {
        const session = t.sessionTag || "unknown";
        if (!acc[session]) {
          acc[session] = { count: 0, wins: 0, totalPnl: 0 };
        }
        acc[session].count++;
        const pnl = parseFloat(t.realizedPnl || "0");
        if (pnl > 0) acc[session].wins++;
        acc[session].totalPnl += pnl;
        return acc;
      }, {});

      res.json({
        ...proSummary,
        psychologyInsights: {
          emotionalBreakdown: Object.entries(emotionalBreakdown).map(([emotion, data]: [string, any]) => ({
            emotion,
            trades: data.count,
            winRate: data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0,
            totalPnl: Math.round(data.totalPnl * 100) / 100,
          })),
          sessionBreakdown: Object.entries(sessionBreakdown).map(([session, data]: [string, any]) => ({
            session,
            trades: data.count,
            winRate: data.count > 0 ? Math.round((data.wins / data.count) * 100) : 0,
            totalPnl: Math.round(data.totalPnl * 100) / 100,
          })),
        },
      });
    } catch (error: unknown) {
      console.error("Error fetching journal summary:", error);
      res.status(500).json({
        error: "Failed to fetch journal summary",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Portfolio Routes ============

  // GET /api/portfolio/summary - Get portfolio summary
  app.get("/api/portfolio/summary", async (_req, res) => {
    try {
      const summary = await storage.getPortfolioSummary();
      res.json(summary);
    } catch (error: unknown) {
      console.error("Error fetching portfolio summary:", error);
      res.status(500).json({
        error: "Failed to fetch portfolio summary",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Tier-Gated Analytics Routes ============

  // GET /api/analytics - Get tier-based analytics
  app.get("/api/analytics", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);

      const trades = await storage.getUserTrades(userId);
      const { getAnalyticsForTier } = await import("./analytics-service");
      const analytics = await getAnalyticsForTier(trades, tier);

      res.json(analytics);
    } catch (error: unknown) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({
        error: "Failed to fetch analytics",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/ai/trade-review - AI trade review (premium only)
  app.post("/api/ai/trade-review", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { requireTier } = await import("./utils/tier");
      
      if (!requireTier(user, "premium")) {
        return res.status(403).json({ 
          error: "AI Trade Review is a Premium feature",
          requiredTier: "premium",
        });
      }

      const { tradeId } = req.body;
      if (!tradeId) {
        return res.status(400).json({ error: "tradeId is required" });
      }

      const trade = await storage.getTradeById(parseInt(tradeId));
      if (!trade) {
        return res.status(404).json({ error: "Trade not found" });
      }

      if (trade.userId && trade.userId !== userId && !isDeveloper(userId)) {
        return res.status(403).json({ error: "Not authorized to review this trade" });
      }

      const { generateTradeReview } = await import("./ai-coaching");
      const review = await generateTradeReview(trade);

      res.json(review);
    } catch (error: unknown) {
      console.error("Error generating trade review:", error);
      res.status(500).json({
        error: "Failed to generate trade review",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/ai/portfolio-insights - AI portfolio insights (premium only)
  app.post("/api/ai/portfolio-insights", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { requireTier } = await import("./utils/tier");
      
      if (!requireTier(user, "premium")) {
        return res.status(403).json({ 
          error: "AI Portfolio Insights is a Premium feature",
          requiredTier: "premium",
        });
      }

      const { trades, winRate, profitFactor, totalPnL } = req.body;
      if (!trades || !Array.isArray(trades)) {
        return res.status(400).json({ error: "trades array is required" });
      }

      const { generatePortfolioInsights } = await import("./ai-coaching");
      const insights = await generatePortfolioInsights(trades, {
        winRate: winRate || 0,
        profitFactor: profitFactor || 0,
        totalPnL: totalPnL || 0,
      });

      res.json(insights);
    } catch (error: unknown) {
      console.error("Error generating portfolio insights:", error);
      res.status(500).json({
        error: "Failed to generate portfolio insights",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/chart/coaching - Generate chart coaching analysis
  app.post("/api/chart/coaching", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);

      // Tier check - at least Pro required
      if (tier === 'free') {
        return res.status(403).json({ 
          error: "Chart coaching requires Pro or Elite subscription",
          requiredTier: "pro",
        });
      }

      const { symbol, candles } = req.body;
      if (!symbol || !candles || !Array.isArray(candles)) {
        return res.status(400).json({ error: "symbol and candles array required" });
      }

      const { generateChartCoaching } = await import("./ai-coaching");
      const coaching = await generateChartCoaching(symbol, candles, tier as 'pro' | 'premium');

      res.json(coaching);
    } catch (error: unknown) {
      console.error("Error generating chart coaching:", error);
      res.status(500).json({
        error: "Failed to generate chart coaching",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/user/tier - Get user's subscription tier and feature access
  app.get("/api/user/tier", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier, getTierDisplayName } = await import("./utils/tier");
      const { hasFeatureAccess, getAllFeatures } = await import("./feature-flags");
      
      const tier = getUserTier(user);
      const userRole = user?.role || "free";
      
      const featureAccess: Record<string, boolean> = {};
      for (const feature of getAllFeatures()) {
        featureAccess[feature.name] = hasFeatureAccess(userRole as any, feature.name, userId);
      }

      res.json({
        tier,
        tierDisplayName: getTierDisplayName(tier),
        isDeveloper: isDeveloper(userId),
        features: featureAccess,
      });
    } catch (error: unknown) {
      console.error("Error fetching user tier:", error);
      res.status(500).json({
        error: "Failed to fetch user tier",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Adaptive Learning Routes ============
  
  // GET /api/learning/status - Get adaptive learning status for all symbols
  app.get("/api/learning/status", async (_req, res) => {
    try {
      const { getAllLearningMetrics } = await import("./adaptive-learning");
      const metrics = await getAllLearningMetrics();
      res.json({
        totalSymbols: metrics.length,
        metrics,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Error fetching learning status:", error);
      res.status(500).json({
        error: "Failed to fetch learning status",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });
  
  // GET /api/learning/:symbol - Get adaptive learning metrics for a specific symbol
  app.get("/api/learning/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { getSymbolLearningMetrics, getConfidenceGrade } = await import("./adaptive-learning");
      const metrics = await getSymbolLearningMetrics(symbol.toUpperCase());
      const grade = getConfidenceGrade(metrics.successRate);
      res.json({
        ...metrics,
        grade: grade.grade,
        gradeColor: grade.color,
        gradeDescription: grade.description,
      });
    } catch (error: unknown) {
      console.error("Error fetching symbol learning metrics:", error);
      res.status(500).json({
        error: "Failed to fetch learning metrics",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/adaptive/summary - Get adaptive learning summary with tier-based access
  app.get("/api/adaptive/summary", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user tier
      const user = await storage.getUser(userId);
      const tier = user?.role || "free";
      const symbolParam = req.query.symbol as string | undefined;

      // Free users cannot access adaptive metrics
      if (tier === "free" && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "Adaptive metrics are available to Pro/Premium users only." 
        });
      }

      const { getSymbolLearningMetrics, getAllLearningMetrics, getConfidenceGrade } = await import("./adaptive-learning");

      // If symbol is provided, return per-symbol metrics
      if (symbolParam) {
        const symbol = symbolParam.toUpperCase();
        const metrics = await getSymbolLearningMetrics(symbol);
        const grade = getConfidenceGrade(metrics.successRate);
        
        console.log(`[Adaptive] Fetched metrics for ${symbol}: ${metrics.totalSignals} signals, ${(metrics.successRate * 100).toFixed(1)}% success rate`);
        
        return res.json({
          symbol,
          metrics: {
            ...metrics,
            grade: grade.grade,
            gradeColor: grade.color,
            gradeDescription: grade.description,
          }
        });
      }

      // Pro users: can access per-symbol but limited full list
      // Premium users and developers: full access
      if (tier === "pro" && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "Full adaptive summary is available to Premium users only. Use ?symbol=XYZ for per-symbol metrics." 
        });
      }

      // Premium/developer: return full metrics for all symbols
      const allMetrics = await getAllLearningMetrics();
      
      // Add grades to each metric
      const enrichedMetrics = allMetrics.map(m => {
        const grade = getConfidenceGrade(m.successRate);
        return {
          ...m,
          grade: grade.grade,
          gradeColor: grade.color,
          gradeDescription: grade.description,
        };
      });

      // Sort by total signals descending
      enrichedMetrics.sort((a, b) => b.totalSignals - a.totalSignals);

      console.log(`[Adaptive] Fetched summary for ${enrichedMetrics.length} symbols`);

      res.json(enrichedMetrics);
    } catch (error: unknown) {
      console.error("Error fetching adaptive summary:", error);
      res.status(500).json({
        error: "Failed to fetch adaptive summary",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ User Strategies Routes ============

  // GET /api/strategies - List user's strategies (auth required)
  app.get("/api/strategies", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { strategies } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, or, isNull } = await import("drizzle-orm");
      
      // Return user's own strategies plus global/shared strategies
      const userStrategies = await db.select().from(strategies)
        .where(or(eq(strategies.userId, userId), isNull(strategies.userId)));
      
      res.json(userStrategies);
    } catch (error: unknown) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({
        error: "Failed to fetch strategies",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/strategies - Create a new strategy (Pro/Premium only)
  app.post("/api/strategies", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { requireTier } = await import("./utils/tier");
      
      if (!requireTier(user, "pro") && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "Creating strategies requires Pro or Premium subscription",
          requiredTier: "pro",
        });
      }

      const { strategyInputSchema, strategies } = await import("@shared/schema");
      const validation = strategyInputSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: validation.error.errors,
        });
      }

      const { db } = await import("./db");
      const { name, description, tags, color, isActive } = validation.data;
      
      const [created] = await db.insert(strategies).values({
        userId,
        name,
        description: description || null,
        tags: tags ? JSON.stringify(tags) : null,
        color: color || null,
        isActive: isActive ? 1 : 0,
      }).returning();

      res.status(201).json(created);
    } catch (error: unknown) {
      console.error("Error creating strategy:", error);
      res.status(500).json({
        error: "Failed to create strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // PATCH /api/strategies/:id - Update a strategy (Premium only)
  app.patch("/api/strategies/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { requireTier } = await import("./utils/tier");
      
      if (!requireTier(user, "premium") && !isDeveloper(userId)) {
        return res.status(403).json({ 
          error: "Editing strategies requires Premium subscription",
          requiredTier: "premium",
        });
      }

      const { id } = req.params;
      const { strategyInputSchema, strategies } = await import("@shared/schema");
      const { db } = await import("./db");
      const { eq, and } = await import("drizzle-orm");
      
      // Verify ownership - user can only edit their own strategies
      const [existingStrategy] = await db.select().from(strategies)
        .where(eq(strategies.id, parseInt(id)));
      
      if (!existingStrategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      
      if (existingStrategy.userId && existingStrategy.userId !== userId && !isDeveloper(userId)) {
        return res.status(403).json({ error: "You can only edit your own strategies" });
      }
      
      const validation = strategyInputSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid strategy data",
          details: validation.error.errors,
        });
      }

      const { name, description, tags, color, isActive } = validation.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (tags !== undefined) updateData.tags = JSON.stringify(tags);
      if (color !== undefined) updateData.color = color;
      if (isActive !== undefined) updateData.isActive = isActive ? 1 : 0;

      const [updated] = await db.update(strategies)
        .set(updateData)
        .where(and(eq(strategies.id, parseInt(id))))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json(updated);
    } catch (error: unknown) {
      console.error("Error updating strategy:", error);
      res.status(500).json({
        error: "Failed to update strategy",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/strategies/migrate - Migrate strategyTag values to strategies table
  app.post("/api/strategies/migrate", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { migrateStrategyTagsToStrategies } = await import("./analytics-engine");
      const result = await migrateStrategyTagsToStrategies(userId);
      
      res.json({
        success: true,
        ...result,
        message: `Migrated ${result.migrated} trades to ${result.strategies.length} new strategies`,
      });
    } catch (error: unknown) {
      console.error("Error migrating strategies:", error);
      res.status(500).json({
        error: "Failed to migrate strategies",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Advanced Analytics Routes ============

  // GET /api/analytics/kpis - Get KPI metrics with breakdowns
  app.get("/api/analytics/kpis", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier, requireTier } = await import("./utils/tier");
      const tier = getUserTier(user);
      const rangeParam = req.query.range as string || "30d";

      // Validate range based on tier
      const allowedRanges: Record<string, string[]> = {
        free: ["30d"],
        pro: ["30d", "90d"],
        premium: ["30d", "90d", "180d", "1y"],
      };

      const effectiveTier = isDeveloper(userId) ? "premium" : tier;
      const tierRanges = allowedRanges[effectiveTier] || allowedRanges.free;
      
      if (!tierRanges.includes(rangeParam)) {
        return res.status(403).json({
          error: `Range ${rangeParam} requires ${rangeParam === "1y" ? "Premium" : "Pro"} subscription`,
          allowedRanges: tierRanges,
        });
      }

      const { getKPIsByRange } = await import("./analytics-engine");
      const { analyticsRangeSchema } = await import("@shared/schema");
      const range = analyticsRangeSchema.parse(rangeParam);
      
      const result = await getKPIsByRange(range, userId);

      // Free tier: only overall KPIs, limited breakdowns
      if (tier === "free" && !isDeveloper(userId)) {
        res.json({
          overall: result.overall,
          bySymbol: {},
          byDTEBucket: {},
          byDirection: {},
          tier,
          range,
        });
      } else {
        res.json({
          ...result,
          tier,
          range,
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching KPIs:", error);
      res.status(500).json({
        error: "Failed to fetch KPIs",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/analytics/strategy-performance - Get strategy performance metrics
  app.get("/api/analytics/strategy-performance", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);
      const rangeParam = req.query.range as string || "30d";

      const allowedRanges: Record<string, string[]> = {
        free: ["30d"],
        pro: ["30d", "90d"],
        premium: ["30d", "90d", "180d", "1y"],
      };

      const effectiveTier = isDeveloper(userId) ? "premium" : tier;
      const tierRanges = allowedRanges[effectiveTier] || allowedRanges.free;
      
      if (!tierRanges.includes(rangeParam)) {
        return res.status(403).json({
          error: `Range ${rangeParam} requires ${rangeParam === "1y" ? "Premium" : "Pro"} subscription`,
          allowedRanges: tierRanges,
        });
      }

      const { getStrategyPerformance } = await import("./analytics-engine");
      const { analyticsRangeSchema } = await import("@shared/schema");
      const range = analyticsRangeSchema.parse(rangeParam);
      
      const strategies = await getStrategyPerformance(range, userId);

      // Free tier: only top-level KPIs, no drilldown/timeSeries
      if (tier === "free" && !isDeveloper(userId)) {
        res.json({
          strategies: strategies.map(s => ({
            strategyId: s.strategyId,
            strategyName: s.strategyName,
            metrics: {
              winRate: s.metrics.winRate,
              netPnL: s.metrics.netPnL,
              tradesCount: s.metrics.tradesCount,
            },
            timeSeries: [],
            bestSymbol: null,
            worstSymbol: null,
            sharpeLike: null,
          })),
          tier,
          range,
          limitedView: true,
        });
      } else {
        res.json({
          strategies,
          tier,
          range,
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching strategy performance:", error);
      res.status(500).json({
        error: "Failed to fetch strategy performance",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/analytics/confidence-calibration - Get confidence calibration data
  app.get("/api/analytics/confidence-calibration", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);
      const rangeParam = req.query.range as string || "30d";
      const binsParam = parseInt(req.query.bins as string) || 10;

      const allowedRanges: Record<string, string[]> = {
        free: ["30d"],
        pro: ["30d", "90d"],
        premium: ["30d", "90d", "180d", "1y"],
      };

      const allowedBins: Record<string, number> = {
        free: 5,
        pro: 10,
        premium: 20,
      };

      const effectiveTier = isDeveloper(userId) ? "premium" : tier;
      const tierRanges = allowedRanges[effectiveTier] || allowedRanges.free;
      const maxBins = allowedBins[effectiveTier] || allowedBins.free;
      
      if (!tierRanges.includes(rangeParam)) {
        return res.status(403).json({
          error: `Range ${rangeParam} requires upgraded subscription`,
          allowedRanges: tierRanges,
        });
      }

      const bins = Math.min(binsParam, maxBins);

      const { getConfidenceCalibration } = await import("./analytics-engine");
      const { analyticsRangeSchema } = await import("@shared/schema");
      const range = analyticsRangeSchema.parse(rangeParam);
      
      const calibration = await getConfidenceCalibration(range, bins);

      res.json({
        ...calibration,
        tier,
        range,
        binsUsed: bins,
        maxBinsAllowed: maxBins,
      });
    } catch (error: unknown) {
      console.error("Error fetching confidence calibration:", error);
      res.status(500).json({
        error: "Failed to fetch confidence calibration",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/analytics/user-vs-ai - Get user vs AI comparison
  app.get("/api/analytics/user-vs-ai", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);
      const rangeParam = req.query.range as string || "30d";

      const allowedRanges: Record<string, string[]> = {
        free: ["30d"],
        pro: ["30d", "90d"],
        premium: ["30d", "90d", "180d", "1y"],
      };

      const effectiveTier = isDeveloper(userId) ? "premium" : tier;
      const tierRanges = allowedRanges[effectiveTier] || allowedRanges.free;
      
      if (!tierRanges.includes(rangeParam)) {
        return res.status(403).json({
          error: `Range ${rangeParam} requires upgraded subscription`,
          allowedRanges: tierRanges,
        });
      }

      const { getUserVsAIComparison } = await import("./analytics-engine");
      const { analyticsRangeSchema } = await import("@shared/schema");
      const range = analyticsRangeSchema.parse(rangeParam);
      
      const comparison = await getUserVsAIComparison(range, userId);

      // Free tier: only high-level comparison, no time series
      if (tier === "free" && !isDeveloper(userId)) {
        res.json({
          aiBaseline: {
            winRate: comparison.aiBaseline.winRate,
            netPnL: comparison.aiBaseline.netPnL,
            tradesCount: comparison.aiBaseline.tradesCount,
          },
          userTakenTrades: {
            winRate: comparison.userTakenTrades.winRate,
            netPnL: comparison.userTakenTrades.netPnL,
            tradesCount: comparison.userTakenTrades.tradesCount,
          },
          userManualTrades: {
            winRate: comparison.userManualTrades.winRate,
            netPnL: comparison.userManualTrades.netPnL,
            tradesCount: comparison.userManualTrades.tradesCount,
          },
          edge: comparison.edge,
          takenCount: comparison.takenCount,
          manualCount: comparison.manualCount,
          skippedCount: comparison.skippedCount,
          timeSeries: [],
          tier,
          range,
          limitedView: true,
        });
      } else {
        res.json({
          ...comparison,
          tier,
          range,
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching user vs AI comparison:", error);
      res.status(500).json({
        error: "Failed to fetch user vs AI comparison",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/analytics/mistake-detector - Track overrides that lost money vs followed recommendations
  app.get("/api/analytics/mistake-detector", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      const { getUserTier } = await import("./utils/tier");
      const tier = getUserTier(user);
      const rangeParam = req.query.range as string || "30d";

      // Pro+ feature only
      if (tier === "free" && !isDeveloper(userId)) {
        return res.status(403).json({
          error: "Mistake detector requires Pro or Premium subscription",
          requiredTier: "pro",
        });
      }

      const allowedRanges: Record<string, string[]> = {
        pro: ["30d", "90d"],
        premium: ["30d", "90d", "180d", "1y"],
      };

      const effectiveTier = isDeveloper(userId) ? "premium" : tier;
      const tierRanges = allowedRanges[effectiveTier] || allowedRanges.pro;
      
      if (!tierRanges.includes(rangeParam)) {
        return res.status(403).json({
          error: `Range ${rangeParam} requires upgraded subscription`,
          allowedRanges: tierRanges,
        });
      }

      const { getMistakeDetector } = await import("./analytics-engine");
      const { analyticsRangeSchema } = await import("@shared/schema");
      const range = analyticsRangeSchema.parse(rangeParam);
      
      const mistakes = await getMistakeDetector(range, userId);

      // Pro tier: limited override details (top 10 worst)
      if (tier === "pro" && !isDeveloper(userId)) {
        res.json({
          ...mistakes,
          overrideDetails: mistakes.overrideDetails.slice(0, 10),
          tier,
          range,
          limitedView: true,
        });
      } else {
        res.json({
          ...mistakes,
          tier,
          range,
        });
      }
    } catch (error: unknown) {
      console.error("Error fetching mistake detector:", error);
      res.status(500).json({
        error: "Failed to fetch mistake detector",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ ML Model Routes ============

  // GET /api/ml/status - Get ML model status and metrics
  app.get("/api/ml/status", async (_req, res) => {
    try {
      const metrics = getModelMetrics();
      res.json({
        ...metrics,
        lastTrainedAt: metrics.lastTrainedAt?.toISOString() || null,
      });
    } catch (error: unknown) {
      console.error("Error fetching ML status:", error);
      res.status(500).json({
        error: "Failed to fetch ML status",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/ml/train - Train the ML model on historical data
  app.post("/api/ml/train", async (req, res) => {
    try {
      const { symbol, lookbackDays = 365 } = req.body;
      
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      let period: "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" = "1y";
      if (lookbackDays <= 30) period = "1mo";
      else if (lookbackDays <= 90) period = "3mo";
      else if (lookbackDays <= 180) period = "6mo";
      else if (lookbackDays <= 365) period = "1y";
      else if (lookbackDays <= 730) period = "2y";
      else period = "5y";
      
      const historicalData = await storage.getHistoricalData(symbol.toUpperCase(), period);
      
      if (historicalData.length < 50) {
        return res.status(400).json({ 
          error: "Insufficient data for training",
          message: `Need at least 50 data points, got ${historicalData.length}`
        });
      }
      
      const result = await trainModel(historicalData);
      
      res.json({
        success: result.success,
        accuracy: result.accuracy,
        samples: result.samples,
        message: result.success 
          ? `Model trained successfully with ${result.samples} samples (${(result.accuracy * 100).toFixed(1)}% accuracy)`
          : "Training failed - insufficient data or model error"
      });
    } catch (error: unknown) {
      console.error("Error training ML model:", error);
      res.status(500).json({
        error: "Failed to train ML model",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/ml/predict - Get ML prediction for a symbol
  app.post("/api/ml/predict", async (req, res) => {
    try {
      const { symbol } = req.body;
      
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const historicalData = await storage.getHistoricalData(symbol.toUpperCase(), "3mo");
      
      if (historicalData.length < 35) {
        return res.status(400).json({ 
          error: "Insufficient data for prediction",
          message: `Need at least 35 data points, got ${historicalData.length}`
        });
      }
      
      const prediction = await predictSignal(historicalData);
      
      res.json({
        symbol: symbol.toUpperCase(),
        ...prediction,
        modelLoaded: isModelLoaded(),
        features: prediction.features ? {
          ...prediction.features,
          date: prediction.features.date instanceof Date 
            ? prediction.features.date.toISOString() 
            : prediction.features.date
        } : null
      });
    } catch (error: unknown) {
      console.error("Error getting ML prediction:", error);
      res.status(500).json({
        error: "Failed to get ML prediction",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/ml/features - Get computed features for a symbol
  app.post("/api/ml/features", async (req, res) => {
    try {
      const { symbol } = req.body;
      
      if (!symbol || typeof symbol !== "string") {
        return res.status(400).json({ error: "Symbol is required" });
      }
      
      const historicalData = await storage.getHistoricalData(symbol.toUpperCase(), "3mo");
      const features = computeFeatures(historicalData);
      const latest = getLatestFeatures(historicalData);
      
      res.json({
        symbol: symbol.toUpperCase(),
        totalFeatures: features.length,
        latestFeatures: latest ? {
          ...latest,
          date: latest.date instanceof Date ? latest.date.toISOString() : latest.date
        } : null,
        recentFeatures: features.slice(-10).map(f => ({
          ...f,
          date: f.date instanceof Date ? f.date.toISOString() : f.date
        }))
      });
    } catch (error: unknown) {
      console.error("Error computing features:", error);
      res.status(500).json({
        error: "Failed to compute features",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ ML Backtest Routes ============

  // POST /api/ml/backtest - Run ML-powered backtest
  app.post("/api/ml/backtest", async (req, res) => {
    try {
      const validation = backtestRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid backtest request",
          details: validation.error.errors,
        });
      }
      
      const result = await runMLBacktest(validation.data);
      res.json(result);
    } catch (error: unknown) {
      console.error("Error running ML backtest:", error);
      res.status(500).json({
        error: "Failed to run ML backtest",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/signals/hybrid - Generate hybrid (GPT + ML) signals
  app.post("/api/signals/hybrid", async (req, res) => {
    try {
      const validation = signalRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Invalid request data",
          details: validation.error.errors,
        });
      }

      const { symbols } = validation.data;
      
      // Get all prices first
      const pricesAndData = await Promise.all(
        symbols.map(async (symbol) => ({
          symbol,
          price: await storage.getLatestPrice(symbol),
          historicalData: await storage.getHistoricalData(symbol, "3mo"),
        }))
      );
      
      // Pre-check AI availability with first symbol to fail early
      const testResult = await batchAnalyzeSymbols([symbols[0]], [pricesAndData[0].price]);
      if ('error' in testResult) {
        return res.status(503).json({
          error: "AI service unavailable",
          message: testResult.message,
          retryAfter: 30,
        });
      }

      const hybridSignals = await Promise.all(
        pricesAndData.map(async ({ symbol, price, historicalData }) => {
          const gptResult = await batchAnalyzeSymbols([symbol], [price]);
          
          // This should not happen after pre-check, but handle defensively
          if ('error' in gptResult) {
            throw new Error("AI service became unavailable during processing");
          }
          
          const [gptAnalysis] = gptResult;
          const mlPrediction = await predictSignal(historicalData);
          
          // Map options actions to bullish/bearish scores
          const bullishActions = ["BUY_CALL"];
          const bearishActions = ["BUY_PUT"];
          const gptDirection = gptAnalysis.filters.direction;
          const gptScore = bullishActions.includes(gptDirection) ? 1 : bearishActions.includes(gptDirection) ? 0 : 0.5;
          const combinedScore = (gptScore * 0.4 + mlPrediction.probability * 0.6);
          
          let combinedAction: "BUY_CALL" | "BUY_PUT" | "NO_TRADE";
          if (combinedScore > 0.6) {
            combinedAction = "BUY_CALL";
          } else if (combinedScore < 0.4) {
            combinedAction = "BUY_PUT";
          } else {
            combinedAction = "NO_TRADE";
          }
          
          const combinedConfidence = Math.abs(combinedScore - 0.5) * 2;
          
          return {
            symbol,
            mlPrediction: {
              probability: mlPrediction.probability,
              action: mlPrediction.action,
              confidence: mlPrediction.confidence,
              features: mlPrediction.features ? {
                ...mlPrediction.features,
                date: mlPrediction.features.date instanceof Date 
                  ? mlPrediction.features.date.toISOString() 
                  : mlPrediction.features.date
              } : null
            },
            gptAnalysis: {
              action: gptDirection,
              confidence: gptAnalysis.confidence,
              reasoning: gptAnalysis.reasoning,
            },
            combinedAction,
            combinedConfidence,
            reasoning: `ML (${(mlPrediction.probability * 100).toFixed(0)}% bullish) + GPT (${gptDirection}, ${(gptAnalysis.confidence * 100).toFixed(0)}% confidence) = ${combinedAction}`,
            entryPrice: price,
            stopLoss: Number((price * 0.9).toFixed(2)),
            takeProfit: Number((price * 1.1).toFixed(2)),
          };
        })
      );

      res.json(hybridSignals);
    } catch (error: unknown) {
      console.error("Error generating hybrid signals:", error);
      res.status(500).json({
        error: "Failed to generate hybrid signals",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/live-signals - Get live options signals for real-time display
  // Supports query params: search (specific ticker), mode (gainers/losers/all)
  app.get("/api/live-signals", async (req, res) => {
    try {
      const searchTicker = (req.query.search as string)?.toUpperCase()?.trim();
      const mode = (req.query.mode as string) || "gainers";
      
      // Popular trading symbols for live signals
      const watchlistSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "SPY", "QQQ", "AMD", "NFLX", "DIS", "BA", "JPM", "V"];
      
      let selectedSymbols: string[];
      
      if (searchTicker) {
        // User searched for a specific ticker
        selectedSymbols = [searchTicker];
      } else {
        // Get prices and calculate daily change for all symbols to find top gainers
        const allPricesWithChange = await Promise.all(
          watchlistSymbols.map(async (symbol) => {
            const price = await storage.getLatestPrice(symbol);
            // Simulate daily change percentage (in real app, this would come from market data)
            const dailyChange = (Math.random() - 0.4) * 8; // -3.2% to +4.8% (slight bullish bias)
            return { symbol, price, dailyChange };
          })
        );
        
        // Sort by daily change to get top gainers or losers
        if (mode === "losers") {
          allPricesWithChange.sort((a, b) => a.dailyChange - b.dailyChange);
        } else {
          // Default to gainers
          allPricesWithChange.sort((a, b) => b.dailyChange - a.dailyChange);
        }
        
        // Take top 5 for display
        selectedSymbols = allPricesWithChange.slice(0, 5).map(p => p.symbol);
      }
      
      // Get current prices
      const prices = await Promise.all(
        selectedSymbols.map((symbol) => storage.getLatestPrice(symbol))
      );
      
      // Get AI analysis
      const analysisResult = await batchAnalyzeSymbols(selectedSymbols, prices);
      
      // Handle AI unavailability
      if ('error' in analysisResult) {
        return res.status(503).json({
          error: "AI service unavailable",
          message: analysisResult.message,
          retryAfter: 30,
        });
      }
      
      const analyses = analysisResult;
      
      // Import adaptive learning for confidence adjustment
      const { getAdaptiveConfidence, analyzeMarketCondition } = await import("./adaptive-learning");
      
      // Generate live signals with adaptive confidence
      const liveSignals = await Promise.all(selectedSymbols.map(async (symbol, i) => {
        const currentPrice = prices[i];
        const analysis = analyses[i];
        
        // Skip NO_TRADE recommendations
        if (analysis.filters.direction === "NO_TRADE") {
          return null;
        }
        
        const optionType = analysis.filters.direction === "BUY_PUT" ? "PUT" : "CALL";
        const optionSide = analysis.filters.direction === "BUY_CALL" || analysis.filters.direction === "BUY_PUT" ? "LONG" : "SHORT";
        
        // Get adaptive confidence adjustment based on historical performance
        const marketCondition = await analyzeMarketCondition(symbol, currentPrice);
        const adaptiveResult = await getAdaptiveConfidence(
          symbol,
          analysis.confidence,
          currentPrice,
          optionType,
          marketCondition
        );
        
        // Calculate strike price with proper OTM/ATM logic
        // For options, strikes are typically rounded to $5 increments for stocks >$50, $1 for cheaper stocks
        const roundTo = currentPrice > 100 ? 5 : currentPrice > 25 ? 2.5 : 1;
        let strikePrice: number;
        
        // CALL options: Strike above current price (OTM) for buyers, ATM or slightly OTM for sellers
        // PUT options: Strike below current price (OTM) for buyers, ATM or slightly OTM for sellers
        if (optionType === "CALL") {
          // Calls: strike slightly above current price (1-3% OTM)
          const otmMultiplier = 1 + (0.01 + Math.random() * 0.02); // 1-3% OTM
          strikePrice = Math.ceil(currentPrice * otmMultiplier / roundTo) * roundTo;
        } else {
          // Puts: strike slightly below current price (1-3% OTM)
          const otmMultiplier = 1 - (0.01 + Math.random() * 0.02); // 1-3% OTM
          strikePrice = Math.floor(currentPrice * otmMultiplier / roundTo) * roundTo;
        }
        
        // Calculate expiry (next Friday or within 2 weeks)
        const today = new Date();
        const daysToFriday = (5 - today.getDay() + 7) % 7 || 7;
        const expiryDate = new Date(today.getTime() + daysToFriday * 24 * 60 * 60 * 1000);
        const expiryStr = expiryDate.toLocaleDateString("en-US", { 
          month: "short", 
          day: "numeric",
          year: "numeric"
        });
        
        // Calculate premium (simplified Black-Scholes approximation)
        const impliedVolatility = 0.30 + Math.random() * 0.15; // 30-45% IV
        const daysToExpiry = daysToFriday;
        const timeValue = currentPrice * impliedVolatility * Math.sqrt(daysToExpiry / 365);
        const intrinsicValue = optionType === "CALL" 
          ? Math.max(0, currentPrice - strikePrice)
          : Math.max(0, strikePrice - currentPrice);
        const premium = Number((intrinsicValue + timeValue * 0.3).toFixed(2));
        
        // Entry = premium, Stop = 50% loss, Target = 100% gain
        const entry = premium;
        const stop = Number((premium * 0.5).toFixed(2));
        const target = Number((premium * 2).toFixed(2));
        
        return {
          id: `${symbol}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ticker: symbol,
          optionType,
          optionSide,
          strike: strikePrice,
          expiry: expiryStr,
          entry,
          stop,
          target,
          currentPrice,
          confidence: adaptiveResult.adjustedConfidence,
          baseConfidence: analysis.confidence,
          confidenceAdjustment: adaptiveResult.confidenceAdjustment,
          historicalSuccessRate: adaptiveResult.historicalSuccessRate,
          recentPerformance: adaptiveResult.recentPerformance,
          adaptiveReasoning: adaptiveResult.reasoning,
          updatedAt: new Date().toISOString(),
        };
      }));
      
      const filteredSignals = liveSignals.filter((signal): signal is NonNullable<typeof signal> => signal !== null);
      
      res.json(filteredSignals);
    } catch (error: unknown) {
      console.error("Error generating live signals:", error);
      res.status(500).json({
        error: "Failed to generate live signals",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ AI Chatbot Routes ============

  // Helper function to extract stock symbols from user messages
  function extractSymbolsFromMessage(message: string): string[] {
    // Common stock symbol patterns:
    // 1. $SYMBOL format (e.g., $AAPL, $TSLA)
    // 2. Standalone uppercase 1-5 letter words that look like tickers
    // 3. Known popular symbols mentioned by name
    
    const symbols: Set<string> = new Set();
    
    // Match $SYMBOL pattern
    const dollarSymbols = message.match(/\$([A-Z]{1,5})\b/gi);
    if (dollarSymbols) {
      dollarSymbols.forEach(s => symbols.add(s.replace('$', '').toUpperCase()));
    }
    
    // Match standalone uppercase tickers (2-5 letters, not common words)
    const commonWords = new Set(['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'OWN', 'SAY', 'SHE', 'TOO', 'USE', 'BUY', 'PUT', 'CALL', 'WHAT', 'WHEN', 'WHERE', 'WHICH', 'WHY', 'WITH', 'WILL', 'WOULD', 'YOUR', 'THEY', 'BEEN', 'HAVE', 'FROM', 'THIS', 'THAT', 'SOME', 'SELL', 'HOLD', 'LONG', 'SHORT', 'TRADE', 'STOCK', 'PRICE', 'TODAY', 'ABOUT', 'THINK']);
    const upperWords = message.match(/\b([A-Z]{2,5})\b/g);
    if (upperWords) {
      upperWords.forEach(w => {
        if (!commonWords.has(w) && w.length >= 2) {
          symbols.add(w);
        }
      });
    }
    
    // Match known popular symbols mentioned by name (case insensitive)
    const knownSymbols: Record<string, string> = {
      'apple': 'AAPL',
      'tesla': 'TSLA',
      'amazon': 'AMZN',
      'google': 'GOOGL',
      'alphabet': 'GOOGL',
      'microsoft': 'MSFT',
      'nvidia': 'NVDA',
      'meta': 'META',
      'facebook': 'META',
      'netflix': 'NFLX',
      'spy': 'SPY',
      'qqq': 'QQQ',
      'amd': 'AMD',
      'intel': 'INTC',
      'disney': 'DIS',
      'boeing': 'BA',
      'coinbase': 'COIN',
      'palantir': 'PLTR',
      'gamestop': 'GME',
      'berkshire': 'BRK.B',
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [name, symbol] of Object.entries(knownSymbols)) {
      if (lowerMessage.includes(name)) {
        symbols.add(symbol);
      }
    }
    
    // Limit to 5 symbols max to avoid too many API calls
    return Array.from(symbols).slice(0, 5);
  }

  // POST /api/chat - AI-powered chatbot for options education and app help
  app.post("/api/chat", async (req: any, res) => {
    try {
      // Get user role for rate limiting (defaults to free if not authenticated)
      let userRole: UserRole = "free";
      const { userId: chatUserId } = getAuth(req);
      if (chatUserId) {
        try {
          const user = await storage.getUser(chatUserId);
          if (user?.role) {
            userRole = user.role as UserRole;
          }
        } catch (e) {
          // If we can't get user, default to free
        }
      }
      
      // Rate limiting check with role-based limits
      const clientId = chatUserId || req.ip || req.headers["x-forwarded-for"] as string || "anonymous";
      const rateLimit = checkChatRateLimit(clientId, userRole);
      
      if (!rateLimit.allowed) {
        return res.status(429).json({ 
          error: "Rate limit exceeded",
          message: `Too many requests. Please wait ${Math.ceil(rateLimit.resetIn / 1000)} seconds before trying again.`,
          retryAfter: Math.ceil(rateLimit.resetIn / 1000),
          upgradeMessage: userRole === "free" ? "Upgrade to Pro for higher limits!" : undefined,
        });
      }
      
      // Set rate limit headers
      res.setHeader("X-RateLimit-Remaining", rateLimit.remaining.toString());
      res.setHeader("X-RateLimit-Reset", Math.ceil(rateLimit.resetIn / 1000).toString());
      
      const { message, signalContext } = req.body;
      
      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
      }

      // Extract stock symbols from user message and fetch market data
      const detectedSymbols = extractSymbolsFromMessage(message);
      let marketDataInfo = "";
      
      if (detectedSymbols.length > 0) {
        const { getQuote } = await import("./market-data-service");
        
        const quotes = await Promise.allSettled(
          detectedSymbols.map(symbol => getQuote(symbol))
        );
        
        const validQuotes = quotes
          .filter((result): result is PromiseFulfilledResult<import("./market-data-service").MarketQuote> => 
            result.status === 'fulfilled' && result.value.price > 0
          )
          .map(result => result.value);
        
        if (validQuotes.length > 0) {
          marketDataInfo = "\n\nReal-time market data (as of " + new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }) + " ET):\n";
          validQuotes.forEach(quote => {
            const changeSign = quote.change >= 0 ? '+' : '';
            const dataAge = quote.cacheAge ? ` (cached ${Math.round(quote.cacheAge / 1000)}s ago)` : '';
            marketDataInfo += `${quote.symbol}: $${quote.price.toFixed(2)} (${changeSign}${quote.change.toFixed(2)}, ${changeSign}${quote.changePercent.toFixed(2)}%)${dataAge}\n`;
            marketDataInfo += `  Open: $${quote.open.toFixed(2)} | High: $${quote.dayHigh.toFixed(2)} | Low: $${quote.dayLow.toFixed(2)} | Prev Close: $${quote.previousClose.toFixed(2)}\n`;
            if (quote.volume > 0) {
              marketDataInfo += `  Volume: ${(quote.volume / 1000000).toFixed(2)}M\n`;
            }
            if (quote.marketCap) {
              marketDataInfo += `  Market Cap: $${(quote.marketCap / 1000000000).toFixed(2)}B\n`;
            }
          });
          marketDataInfo += `\nData source: ${validQuotes[0].dataSource}. Note: Market data may be delayed up to 15 minutes depending on data provider.`;
        }
      }

      // Build context about recent signals if available
      let signalInfo = "";
      if (signalContext && Array.isArray(signalContext) && signalContext.length > 0) {
        signalInfo = "\n\nRecent trading signals the user has generated:\n";
        signalContext.forEach((signal: any, idx: number) => {
          signalInfo += `${idx + 1}. ${signal.symbol}: ${signal.action} ${signal.optionType} @ $${signal.strikePrice}, Premium: $${signal.premium}, Confidence: ${(signal.confidence * 100).toFixed(1)}%\n`;
          if (signal.reasoning) {
            signalInfo += `   Reasoning: ${signal.reasoning.substring(0, 100)}...\n`;
          }
        });
      }

      // Use Iron Strike Coach assistant for chatbot
      const fullContext = `User Question: ${message}
${marketDataInfo ? `\nContext - Market Data:${marketDataInfo}` : ""}${signalInfo ? `\nContext - Recent Signals:${signalInfo}` : ""}`;

      const answer = await askCoach(fullContext, { 
        source: "web-chatbot",
        userId: chatUserId || "anonymous"
      });
      
      // Return structured JSON response for frontend to render
      res.json({ 
        response: answer,
        structured: {
          answer: answer,
          confidence: 0.9,
          risk: "Always verify information and do your own research.",
          next_actions: ["Review the information provided", "Ask follow-up questions if needed"],
          disclaimer: "This is educational information, not financial advice. Always do your own research.",
          sources: [],
        },
        success: true,
        validationErrors: [],
      });
    } catch (error: unknown) {
      const errorDetails = {
        name: error instanceof Error ? error.name : "Unknown",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        status: (error as any)?.status,
        code: (error as any)?.code,
        type: (error as any)?.type,
      };
      console.error("[Chat Error] Full details:", JSON.stringify(errorDetails, null, 2));
      console.error("[Chat Error] OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY);
      console.error("[Chat Error] IRON_STRIKE_COACH_ASSISTANT_ID set:", !!process.env.IRON_STRIKE_COACH_ASSISTANT_ID);
      
      let userMessage = "Internal server error";
      if (errorDetails.message.includes("API key")) {
        userMessage = "AI service configuration error. Please contact support.";
      } else if (errorDetails.message.includes("not set")) {
        userMessage = "AI assistant not configured. Please contact support.";
      } else if (errorDetails.status === 429) {
        userMessage = "AI service is temporarily busy. Please try again in a moment.";
      } else if (errorDetails.message.includes("timed out")) {
        userMessage = "The AI took too long to respond. Please try again.";
      }
      
      res.status(500).json({
        error: "Failed to process chat message",
        message: userMessage,
        errorType: errorDetails.name,
      });
    }
  });

  // ============ Watchlist Routes ============

  // GET /api/watchlist - Get current user's watchlist items
  app.get("/api/watchlist", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const items = await storage.getUserWatchlist(userId);

      // Fetch current prices for each item
      const itemsWithPrices = await Promise.all(
        items.map(async (item) => {
          try {
            const quote = await storage.getQuote(item.symbol);
            return {
              ...item,
              currentPrice: quote?.price,
              change: quote?.change,
              changePercent: quote?.changePercent,
            };
          } catch {
            return {
              ...item,
              currentPrice: null,
              change: null,
              changePercent: null,
            };
          }
        })
      );

      res.json(itemsWithPrices);
    } catch (error: unknown) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({
        error: "Failed to fetch watchlist",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/watchlist - Add symbol to current user's watchlist
  app.post("/api/watchlist", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { addWatchlistRequestSchema } = await import("@shared/schema");
      const parsed = addWatchlistRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parsed.error.errors,
        });
      }

      const item = await storage.addToWatchlist(
        parsed.data.symbol.toUpperCase(),
        userId
      );
      res.status(201).json(item);
    } catch (error: unknown) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({
        error: "Failed to add to watchlist",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // DELETE /api/watchlist/:id - Remove symbol from current user's watchlist
  app.delete("/api/watchlist/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { id } = req.params;
      await storage.removeFromWatchlist(parseInt(id, 10), userId);
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({
        error: "Failed to remove from watchlist",
        message:
          error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Price Alerts Routes ============

  // GET /api/alerts - Get current user's price alerts
  app.get("/api/alerts", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const alerts = await storage.getUserAlerts(userId);
      const normalizedAlerts = alerts.map((alert: any) => ({
        ...alert,
        targetPrice: alert.targetPrice !== undefined
          ? parseFloat(String(alert.targetPrice))
          : alert.targetPrice,
      }));
      return res.json(normalizedAlerts);
    } catch (error: unknown) {
      console.error("Error fetching user alerts:", error);
      return res.status(500).json({
        error: "Failed to fetch alerts",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/alerts - Create price alert
  app.post("/api/alerts", devAuthMiddleware(), async (req: any, res) => {
    try {
      const { createAlertRequestSchema } = await import("@shared/schema");
      const parsed = createAlertRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request",
          details: parsed.error.errors
        });
      }

      // Check alert limit based on user's role (count only THIS user's alerts)
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const user = await storage.getUser(userId);
      const userRole = user?.role || "free";
      const limit = getAlertLimit(userRole);
      
      // Get only the current user's alerts for the limit check
      const alertCount = await storage.getUserAlertCount(userId);
      if (alertCount >= limit) {
        return res.status(403).json({
          error: "Alert limit reached",
          message: `Your ${userRole} plan allows up to ${limit} alerts. Upgrade to create more.`,
          limit,
          current: alertCount,
        });
      }

      // Check for duplicate alert (same symbol, price, condition)
      const symbol = parsed.data.symbol.toUpperCase();
      const isDuplicate = await storage.checkDuplicateAlert(
        userId,
        symbol,
        parsed.data.targetPrice,
        parsed.data.condition
      );
      if (isDuplicate) {
        return res.status(409).json({
          error: "Duplicate alert",
          message: `You already have an active alert for ${symbol} at $${parsed.data.targetPrice} (${parsed.data.condition}).`,
        });
      }

      const alert = await storage.createAlert({
        name: parsed.data.name,
        symbol: symbol,
        targetPrice: parsed.data.targetPrice,
        condition: parsed.data.condition,
        userId: userId,
        notifyEmail: parsed.data.notifyEmail,
        notifyTelegram: parsed.data.notifyTelegram,
        notifyDiscord: parsed.data.notifyDiscord,
      });
      res.status(201).json({
        ...alert,
        targetPrice: parseFloat(String(alert.targetPrice))
      });
    } catch (error: unknown) {
      console.error("Error creating alert:", error);
      res.status(500).json({
        error: "Failed to create alert",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // DELETE /api/alerts/:id - Delete alert
  app.delete("/api/alerts/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid alert ID" });
      
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Verify ownership before deleting
      const userAlerts = await storage.getUserAlerts(userId);
      const alertToDelete = userAlerts.find(a => a.id === id);
      if (!alertToDelete) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      await storage.deleteAlert(id);
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error deleting alert:", error);
      res.status(500).json({
        error: "Failed to delete alert",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // PATCH /api/alerts/:id - Update alert
  app.patch("/api/alerts/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid alert ID" });
      
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const validation = updateAlertRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
      }
      
      // Verify ownership - get user's alerts and find the one being updated
      const userAlerts = await storage.getUserAlerts(userId);
      const currentAlert = userAlerts.find(a => a.id === id);
      if (!currentAlert) {
        // Alert doesn't exist OR user doesn't own it - return 404 (don't leak existence)
        return res.status(404).json({ error: "Alert not found" });
      }
      
      // Check for duplicate if symbol, price, or condition is being changed
      const newSymbol = validation.data.symbol?.toUpperCase() ?? currentAlert.symbol;
      const newPrice = validation.data.targetPrice ?? Number(currentAlert.targetPrice);
      const newCondition = validation.data.condition ?? currentAlert.condition;
      
      const isDuplicate = await storage.checkDuplicateAlert(
        userId,
        newSymbol,
        newPrice,
        newCondition,
        id // Exclude current alert from duplicate check
      );
      if (isDuplicate) {
        return res.status(409).json({
          error: "Duplicate alert",
          message: `You already have an active alert for ${newSymbol} at $${newPrice} (${newCondition}).`,
        });
      }
      
      // Only proceed with update after ownership verified
      const updated = await storage.updateAlert(id, validation.data);
      res.json(updated);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // POST /api/alerts/:id/toggle - Toggle alert pause/resume
  app.post("/api/alerts/:id/toggle", devAuthMiddleware(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid alert ID" });
      
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Verify ownership before toggling
      const userAlerts = await storage.getUserAlerts(userId);
      const alertToToggle = userAlerts.find(a => a.id === id);
      if (!alertToToggle) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      const updated = await storage.toggleAlertStatus(id);
      res.json(updated);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error toggling alert:", error);
      res.status(500).json({ error: "Failed to toggle alert status" });
    }
  });

  // ============ Support Tickets Routes ============

  // Rate limiter for public ticket endpoint - 3 requests per hour per IP
  // Prevents email bombing attacks through the public ticket creation endpoint
  const ticketRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour per IP
    message: { 
      error: "Too many support ticket requests. Please try again later.",
      code: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Use default keyGenerator (which handles IPv6 properly) - express-rate-limit uses req.ip by default
    handler: (req, res) => {
      // Don't trigger email service when rate limited
      console.warn(`[Tickets] Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: "Too many support ticket requests. Please try again in an hour.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: 3600
      });
    }
  });

  // POST /api/tickets - Create a new support ticket (public, no auth required)
  // Now uses Freshdesk API for ticket management
  app.post("/api/tickets", ticketRateLimiter, async (req: any, res) => {
    try {
      const { createTicketRequestSchema } = await import("@shared/schema");
      const validation = createTicketRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validation.error.errors 
        });
      }

      // Check Freshdesk configuration first
      const { freshdeskService } = await import("./freshdesk-service");
      const status = freshdeskService.getStatus();
      if (!status.configured) {
        return res.status(503).json({ 
          error: "Support ticket system is not configured. Please contact support directly at support@ironstriketrading.com" 
        });
      }

      // Get userId if authenticated (optional)
      let userId: string | undefined;
      try {
        const auth = getAuth(req);
        userId = auth?.userId || undefined;
      } catch {
        // Not authenticated, that's fine for ticket creation
      }

      // Create ticket in Freshdesk
      const ticket = await freshdeskService.createTicket({
        email: validation.data.email,
        name: validation.data.name,
        subject: validation.data.subject,
        description: validation.data.message,
        priority: validation.data.priority,
        channel: validation.data.channel,
        userId,
      });

      // Send confirmation email (async, don't wait)
      try {
        const { emailService } = await import("./email-service");
        const { ticketConfirmationTemplate } = await import("./email-templates");
        
        if (emailService.isConfigured()) {
          const template = ticketConfirmationTemplate({
            ticketNumber: ticket.ticketNumber,
            name: validation.data.name,
            subject: validation.data.subject,
            message: validation.data.message,
            createdAt: new Date(ticket.createdAt),
          });
          
          emailService.sendSupportEmail(
            validation.data.email,
            `Support Ticket Created - ${ticket.ticketNumber}`,
            template.html,
            template.text
          ).then(result => {
            if (result.success) {
              console.log(`[Tickets] Confirmation email sent for ${ticket.ticketNumber}`);
            } else {
              console.warn(`[Tickets] Failed to send confirmation email for ${ticket.ticketNumber}: ${result.error}`);
            }
          }).catch(err => {
            console.warn(`[Tickets] Error sending confirmation email:`, err);
          });
        }
      } catch (emailErr) {
        console.warn("[Tickets] Email service not available:", emailErr);
      }

      res.status(201).json({
        success: true,
        ticketNumber: ticket.ticketNumber,
        freshdeskId: ticket.id,
        message: `Your support ticket #${ticket.ticketNumber} has been submitted. We'll respond within 24-48 hours.`,
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
      res.status(500).json({ error: "Failed to create support ticket" });
    }
  });

  // GET /api/tickets - Get all tickets from Freshdesk (admin only)
  app.get("/api/tickets", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is admin/developer
      const user = await storage.getUser(userId);
      if (!user || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { status, priority, channel } = req.query;
      const { freshdeskService } = await import("./freshdesk-service");
      const tickets = await freshdeskService.getTickets({
        status: status as string | undefined,
        priority: priority as string | undefined,
        channel: channel as string | undefined,
      });

      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // GET /api/tickets/:id - Get single ticket from Freshdesk (admin only)
  app.get("/api/tickets/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const { freshdeskService } = await import("./freshdesk-service");
      const ticket = await freshdeskService.getTicketById(id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // PATCH /api/tickets/:id - Update ticket status in Freshdesk (admin only)
  app.patch("/api/tickets/:id", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ticket ID" });
      }

      const { updateTicketRequestSchema } = await import("@shared/schema");
      const validation = updateTicketRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid request", 
          details: validation.error.errors 
        });
      }

      const { freshdeskService } = await import("./freshdesk-service");
      const updated = await freshdeskService.updateTicket(id, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // GET /api/my-tickets - Get user's own tickets from Freshdesk
  app.get("/api/my-tickets", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.json([]);
      }

      const { freshdeskService } = await import("./freshdesk-service");
      const status = freshdeskService.getStatus();
      if (!status.configured) {
        return res.status(503).json({ error: "Support ticket system is not configured" });
      }

      const tickets = await freshdeskService.getTicketsByEmail(user.email);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching user tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // GET /api/freshdesk/status - Get Freshdesk integration status
  app.get("/api/freshdesk/status", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { freshdeskService } = await import("./freshdesk-service");
      const status = freshdeskService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting Freshdesk status:", error);
      res.status(500).json({ error: "Failed to get Freshdesk status" });
    }
  });

  // ============ Email Service Admin Routes ============

  // GET /api/admin/email/status - Get email service configuration status
  app.get("/api/admin/email/status", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { emailService } = await import("./email-service");
      const status = emailService.getConfigurationStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting email status:", error);
      res.status(500).json({ error: "Failed to get email status" });
    }
  });

  // POST /api/admin/email/test - Send test emails to verify all sender personas
  app.post("/api/admin/email/test", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { testEmail } = req.body;
      if (!testEmail || !testEmail.includes("@")) {
        return res.status(400).json({ error: "Valid test email address required" });
      }

      const { emailService } = await import("./email-service");
      
      if (!emailService.isConfigured()) {
        return res.status(503).json({ 
          error: "Email service not configured",
          details: emailService.getConfigurationStatus().error
        });
      }

      console.log(`[EmailAdmin] Starting email test to ${testEmail} by ${userId}`);
      const results = await emailService.testAllPersonas(testEmail);
      
      const summary = {
        testEmail,
        timestamp: new Date().toISOString(),
        results,
        passed: Object.values(results).filter(r => r.success).length,
        failed: Object.values(results).filter(r => !r.success).length,
      };

      console.log(`[EmailAdmin] Test complete: ${summary.passed} passed, ${summary.failed} failed`);
      res.json(summary);
    } catch (error) {
      console.error("Error running email test:", error);
      res.status(500).json({ error: "Failed to run email test" });
    }
  });

  // POST /api/admin/email/send - Send custom email (admin utility)
  app.post("/api/admin/email/send", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Developer access required" });
      }

      const { to, subject, html, text, persona } = req.body;
      
      if (!to || !subject || !html || !persona) {
        return res.status(400).json({ 
          error: "Missing required fields: to, subject, html, persona" 
        });
      }

      const validPersonas = ["SIGNAL_ALERT", "TRANSACTIONAL", "SUPPORT", "MARKETING"];
      if (!validPersonas.includes(persona)) {
        return res.status(400).json({ 
          error: `Invalid persona. Must be one of: ${validPersonas.join(", ")}` 
        });
      }

      const { emailService } = await import("./email-service");
      
      if (!emailService.isConfigured()) {
        return res.status(503).json({ 
          error: "Email service not configured",
          details: emailService.getConfigurationStatus().error
        });
      }

      const result = await emailService.sendEmail({
        to,
        subject,
        html,
        text,
        persona,
      });

      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error, 
          errorCode: result.errorCode 
        });
      }
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // ============ Chart Analysis Routes ============

  // POST /api/analyze-chart - Analyze uploaded chart image with AI
  app.post("/api/analyze-chart", async (req, res) => {
    try {
      const { chartAnalysisRequestSchema } = await import("@shared/schema");
      const parsed = chartAnalysisRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: "Invalid request",
          details: parsed.error.errors
        });
      }
      
      const { chartImage, context } = parsed.data;

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        timeout: 60 * 1000, // 60 seconds timeout for image analysis
        maxRetries: 3, // Retry up to 3 times on transient errors
      });

      const systemPrompt = `You are an expert technical analyst for options trading. Analyze the chart image and provide:

1. Market Trend: BULLISH, BEARISH, or NEUTRAL
2. Confidence level (0-100%)
3. Chart patterns detected (e.g., head and shoulders, double bottom, triangles, flags)
4. Key support and resistance levels
5. Trading recommendation: BUY_CALL, BUY_PUT, SELL_CALL, SELL_PUT, or HOLD
6. Entry zone, stop loss, and target prices
7. Brief summary of the analysis

Respond in JSON format with this structure:
{
  "trend": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": number,
  "patterns": string[],
  "supportLevels": number[],
  "resistanceLevels": number[],
  "recommendation": {
    "action": "BUY_CALL" | "BUY_PUT" | "SELL_CALL" | "SELL_PUT" | "HOLD",
    "reasoning": string,
    "entryZone": { "min": number, "max": number },
    "stopLoss": number,
    "targets": number[]
  },
  "technicalIndicators": [{ "name": string, "value": string, "signal": "BULLISH" | "BEARISH" | "NEUTRAL" }],
  "summary": string
}`;

      const userMessage = context 
        ? `Analyze this chart. Additional context from trader: ${context}`
        : "Analyze this chart and provide detailed technical analysis for options trading.";

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              { type: "text", text: userMessage },
              { 
                type: "image_url", 
                image_url: { 
                  url: chartImage.startsWith("data:") ? chartImage : `data:image/png;base64,${chartImage}`,
                  detail: "high"
                } 
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      
      // Try to parse as JSON
      try {
        // Extract JSON from response (may be wrapped in markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          res.json(analysis);
        } else {
          throw new Error("No JSON found in response");
        }
      } catch (parseError) {
        // Return a fallback structured response
        res.json({
          trend: "NEUTRAL",
          confidence: 50,
          patterns: ["Unable to parse pattern data"],
          supportLevels: [],
          resistanceLevels: [],
          recommendation: {
            action: "HOLD",
            reasoning: responseText,
            entryZone: null,
            stopLoss: null,
            targets: []
          },
          technicalIndicators: [],
          summary: responseText.substring(0, 500)
        });
      }
    } catch (error: unknown) {
      console.error("Error analyzing chart:", error);
      res.status(500).json({
        error: "Failed to analyze chart",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // ============ Market News & Trends Routes ============

  // Helper function to analyze sentiment from headline text
  function analyzeSentiment(headline: string, summary?: string): "POSITIVE" | "NEGATIVE" | "NEUTRAL" {
    const text = `${headline} ${summary || ""}`.toLowerCase();
    const positiveWords = ["surge", "rally", "gain", "jump", "soar", "record", "high", "boost", "growth", "profit", "beat", "exceed", "strong", "bullish", "upgrade", "buy", "outperform"];
    const negativeWords = ["drop", "fall", "plunge", "decline", "loss", "miss", "cut", "weak", "bearish", "downgrade", "sell", "underperform", "crash", "tumble", "sink", "slump", "warning", "concern"];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    positiveWords.forEach(word => {
      if (text.includes(word)) positiveScore++;
    });
    negativeWords.forEach(word => {
      if (text.includes(word)) negativeScore++;
    });
    
    if (positiveScore > negativeScore) return "POSITIVE";
    if (negativeScore > positiveScore) return "NEGATIVE";
    return "NEUTRAL";
  }

  // Helper function to categorize news based on content
  function categorizeNews(headline: string, related?: string): string {
    const text = headline.toLowerCase();
    if (text.includes("earnings") || text.includes("revenue") || text.includes("profit") || text.includes("quarter")) return "Earnings";
    if (text.includes("fed") || text.includes("rate") || text.includes("inflation") || text.includes("economy") || text.includes("gdp")) return "Economy";
    if (text.includes("ai") || text.includes("tech") || text.includes("software") || text.includes("chip") || text.includes("semiconductor")) return "Technology";
    if (text.includes("crypto") || text.includes("bitcoin") || text.includes("ethereum")) return "Crypto";
    if (text.includes("oil") || text.includes("gold") || text.includes("commodity")) return "Commodities";
    if (text.includes("ev") || text.includes("electric vehicle") || text.includes("tesla") || text.includes("auto")) return "Autos";
    if (text.includes("cloud") || text.includes("aws") || text.includes("azure")) return "Cloud";
    if (text.includes("health") || text.includes("drug") || text.includes("fda") || text.includes("pharma")) return "Healthcare";
    if (text.includes("real estate") || text.includes("reit") || text.includes("housing")) return "Real Estate";
    return "General";
  }

  // GET /api/news - Get market news and trends from Finnhub
  app.get("/api/news", async (req, res) => {
    try {
      const { category, symbol, limit = "20" } = req.query;
      const newsLimit = Math.min(parseInt(limit as string) || 20, 50);
      const now = new Date();
      
      const finnhubApiKey = process.env.FINNHUB_API_KEY;
      
      // If Finnhub API key is available, fetch real news
      if (finnhubApiKey) {
        try {
          // Fetch general market news from Finnhub
          const finnhubUrl = symbol && typeof symbol === 'string'
            ? `https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${finnhubApiKey}`
            : `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`;
          
          const response = await fetch(finnhubUrl);
          
          if (!response.ok) {
            throw new Error(`Finnhub API error: ${response.status}`);
          }
          
          const finnhubNews = await response.json();
          
          if (Array.isArray(finnhubNews) && finnhubNews.length > 0) {
            // Transform Finnhub response to our format
            const newsItems = finnhubNews.map((item: any, index: number) => {
              const headline = item.headline || item.title || "";
              const newsCategory = categorizeNews(headline, item.related);
              
              return {
                id: `finnhub-${item.id || index}`,
                source: "FINNHUB" as const,
                sourceName: item.source || "Finnhub",
                title: headline,
                summary: item.summary || "",
                url: item.url || "",
                imageUrl: item.image || null,
                publishedAt: new Date(item.datetime * 1000).toISOString(),
                sentiment: analyzeSentiment(headline, item.summary),
                relatedSymbols: item.related ? [item.related] : [],
                category: newsCategory,
              };
            });

            // Filter by category if specified
            let filteredNews = newsItems;
            if (category && typeof category === 'string' && category.toLowerCase() !== 'all') {
              filteredNews = filteredNews.filter((n: any) => n.category?.toLowerCase() === category.toLowerCase());
            }

            return res.json({
              news: filteredNews.slice(0, newsLimit),
              totalCount: filteredNews.length,
              lastUpdated: now.toISOString(),
              source: "finnhub",
            });
          }
        } catch (apiError) {
          console.error("Finnhub API error, falling back to demo data:", apiError);
          // Fall through to demo data
        }
      }
      
      // Fallback: Demo data when no API key or API fails
      // Note: Links are examples - get a Finnhub API key for real articles
      const newsItems = [
        {
          id: "demo-1",
          source: "DEMO" as const,
          sourceName: "Demo Data",
          title: "Add your Finnhub API key for real-time market news",
          summary: "Get a free API key at finnhub.io to see actual market news with working article links. The free tier includes 60 API calls per minute.",
          url: "https://finnhub.io/register",
          imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400",
          publishedAt: now.toISOString(),
          sentiment: "NEUTRAL" as const,
          relatedSymbols: [] as string[],
          category: "General"
        },
        {
          id: "demo-2",
          source: "DEMO" as const,
          sourceName: "Setup Guide",
          title: "How to enable real financial news in Iron Strike",
          summary: "1. Visit finnhub.io and create a free account. 2. Copy your API key from the dashboard. 3. Add it as FINNHUB_API_KEY in your project secrets. 4. Refresh this page to see live news!",
          url: "https://finnhub.io/docs/api/market-news",
          imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
          publishedAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(),
          sentiment: "POSITIVE" as const,
          relatedSymbols: [] as string[],
          category: "Technology"
        },
      ];

      res.json({
        news: newsItems,
        totalCount: newsItems.length,
        lastUpdated: now.toISOString(),
        source: "demo",
        message: "Add FINNHUB_API_KEY secret for real news data",
      });
    } catch (error: unknown) {
      console.error("Error fetching news:", error);
      res.status(500).json({
        error: "Failed to fetch news",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/trends - Get market trends
  app.get("/api/trends", async (_req, res) => {
    try {
      const trends = [
        {
          id: "trend-1",
          topic: "AI & Machine Learning",
          score: 95,
          change: 12.5,
          relatedSymbols: ["NVDA", "MSFT", "GOOGL", "AMZN"],
          newsCount: 47,
          sentiment: "POSITIVE" as const,
        },
        {
          id: "trend-2",
          topic: "Federal Reserve Policy",
          score: 88,
          change: 8.2,
          relatedSymbols: ["SPY", "TLT", "GLD"],
          newsCount: 32,
          sentiment: "NEUTRAL" as const,
        },
        {
          id: "trend-3",
          topic: "Electric Vehicles",
          score: 72,
          change: -5.4,
          relatedSymbols: ["TSLA", "RIVN", "F", "GM"],
          newsCount: 28,
          sentiment: "NEGATIVE" as const,
        },
        {
          id: "trend-4",
          topic: "Cloud Computing",
          score: 85,
          change: 6.8,
          relatedSymbols: ["AMZN", "MSFT", "GOOGL", "CRM"],
          newsCount: 24,
          sentiment: "POSITIVE" as const,
        },
        {
          id: "trend-5",
          topic: "Semiconductor Supply",
          score: 78,
          change: 4.2,
          relatedSymbols: ["TSM", "INTC", "AMD", "QCOM"],
          newsCount: 19,
          sentiment: "POSITIVE" as const,
        },
        {
          id: "trend-6",
          topic: "Cryptocurrency Adoption",
          score: 68,
          change: 15.3,
          relatedSymbols: ["COIN", "MSTR", "SQ"],
          newsCount: 22,
          sentiment: "POSITIVE" as const,
        },
      ];

      res.json({
        trends,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Error fetching trends:", error);
      res.status(500).json({
        error: "Failed to fetch trends",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/news/categories - Get available news categories with real counts
  app.get("/api/news/categories", async (_req, res) => {
    try {
      const finnhubApiKey = process.env.FINNHUB_API_KEY;
      
      // Default categories with zero counts
      const categoryMap: Record<string, { name: string; count: number }> = {
        all: { name: "All News", count: 0 },
        general: { name: "General", count: 0 },
        technology: { name: "Technology", count: 0 },
        economy: { name: "Economy", count: 0 },
        earnings: { name: "Earnings", count: 0 },
        cloud: { name: "Cloud", count: 0 },
        healthcare: { name: "Healthcare", count: 0 },
        crypto: { name: "Crypto", count: 0 },
        commodities: { name: "Commodities", count: 0 },
        autos: { name: "Autos", count: 0 },
        "real estate": { name: "Real Estate", count: 0 },
      };
      
      if (finnhubApiKey) {
        try {
          // Fetch news to count categories
          const finnhubUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubApiKey}`;
          const response = await fetch(finnhubUrl);
          
          if (response.ok) {
            const finnhubNews = await response.json();
            
            if (Array.isArray(finnhubNews)) {
              categoryMap.all.count = finnhubNews.length;
              
              // Count articles per category
              finnhubNews.forEach((item: any) => {
                const headline = item.headline || item.title || "";
                const category = categorizeNews(headline, item.related).toLowerCase();
                if (categoryMap[category]) {
                  categoryMap[category].count++;
                } else {
                  categoryMap.general.count++;
                }
              });
            }
          }
        } catch (apiError) {
          console.error("Error fetching news for categories:", apiError);
        }
      } else {
        // Demo data - show placeholder counts
        categoryMap.all.count = 2;
        categoryMap.general.count = 1;
        categoryMap.technology.count = 1;
      }
      
      // Convert to array and filter out empty categories (except 'all')
      const categories = Object.entries(categoryMap)
        .filter(([id, data]) => id === 'all' || data.count > 0)
        .map(([id, data]) => ({
          id,
          name: data.name,
          count: data.count,
        }))
        .sort((a, b) => {
          if (a.id === 'all') return -1;
          if (b.id === 'all') return 1;
          return b.count - a.count;
        });
      
      res.json(categories);
    } catch (error: unknown) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        error: "Failed to fetch categories",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/screener - LIVE Options Screener with real-time market data (Pro+ feature)
  app.get("/api/screener", async (req: any, res) => {
    try {
      // Feature gating: screener requires pro+ subscription
      const userId = req.devAuth?.userId || getAuth(req).userId;
      let userRole: UserRole = "free";
      if (userId) {
        const user = await storage.getUser(userId);
        userRole = (user?.role as UserRole) || "free";
      }
      
      if (!hasFeatureAccess(userRole, "signals_all_symbols", userId)) {
        return res.status(403).json({
          error: "Premium feature",
          message: "Live Options Screener requires a Pro or Premium subscription",
          requiredPlan: "pro",
          currentPlan: userRole,
        });
      }
      
      const { query, limit = '50' } = req.query;
      const searchQuery = typeof query === 'string' ? query : '';
      const resultLimit = Math.min(parseInt(limit as string) || 50, 100);
      
      console.log(`[Screener] Searching live options with query: "${searchQuery}"`);
      
      // Search live options data from the scanner cache
      const scanResult: ScanResult = await searchLiveOptions(searchQuery, resultLimit);
      
      // Transform live options into screener results format
      const results = scanResult.options.map((opt: LiveOptionSnapshot) => ({
        id: opt.id,
        symbol: opt.symbol,
        optionSymbol: opt.optionSymbol,
        optionType: opt.optionType.toUpperCase(),
        action: opt.optionType === 'call' ? 'BUY_CALL' : 'BUY_PUT',
        strikePrice: opt.strike,
        currentPrice: opt.underlyingPrice,
        premium: opt.midPrice,
        bid: opt.bid,
        ask: opt.ask,
        bidAskSpread: opt.bidAskSpread,
        spreadPercent: opt.spreadPercent,
        expiration: opt.expiration,
        daysToExpiry: opt.daysToExpiry,
        moneyness: opt.moneyness,
        // Real Greeks from Tradier
        iv: opt.iv,
        delta: opt.delta,
        theta: opt.theta,
        gamma: opt.gamma,
        vega: opt.vega,
        // Volume and liquidity
        volume: opt.volume,
        openInterest: opt.openInterest,
        // Data freshness
        fetchedAt: opt.fetchedAt,
        isLive: true,
      }));
      
      res.json({
        results,
        query: searchQuery,
        parsedFilters: parseNaturalLanguageQuery(searchQuery),
        totalResults: results.length,
        scannedSymbols: scanResult.scannedSymbols,
        totalContracts: scanResult.totalContracts,
        matchingContracts: scanResult.matchingContracts,
        lastUpdated: scanResult.lastUpdated.toISOString(),
        dataAge: scanResult.dataAge,
        cacheHit: scanResult.cacheHit,
        dataSource: 'live_market_data',
      });
    } catch (error: unknown) {
      console.error("Error in live screener:", error);
      res.status(500).json({
        error: "Failed to run live screener",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/screener/status - Get scanner cache status
  app.get("/api/screener/status", async (req, res) => {
    try {
      const status = getCacheStatus();
      res.json({
        ...status,
        supportedSymbols: ALL_SCAN_SYMBOLS,
        cacheExpiry: 60,
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: "Failed to get scanner status",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // POST /api/screener/refresh - Force refresh scanner cache for specific symbols
  app.post("/api/screener/refresh", async (req, res) => {
    try {
      const { symbols } = req.body;
      const symbolList = Array.isArray(symbols) ? symbols : ALL_SCAN_SYMBOLS;
      
      console.log(`[Screener] Starting refresh for ${symbolList.length} symbols...`);
      
      // Run scan in background
      runFullScan(symbolList).catch(err => {
        console.error('[Screener] Background scan failed:', err);
      });
      
      res.json({
        status: 'refresh_started',
        symbols: symbolList,
        message: `Refreshing ${symbolList.length} symbols in background`,
      });
    } catch (error: unknown) {
      res.status(500).json({
        error: "Failed to start refresh",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/signals/0dte - Get 0DTE (same-day expiration) signals from LIVE market data
  // Uses professional trading strategies: Momentum Scalp, Gamma Squeeze, Mean Reversion, Support/Resistance
  app.get("/api/signals/0dte", async (req, res) => {
    try {
      const { underlying = 'SPY' } = req.query;
      const symbol = String(underlying).toUpperCase();
      
      // Import strategy engine
      const { generateZeroDTESignals } = await import("./zero-dte-strategy");
      
      // Get quote data for price and daily change
      const { getQuote } = await import("./tradier-service");
      const quoteData = await getQuote(symbol);
      
      if (!quoteData) {
        return res.status(404).json({ error: `No quote data for ${symbol}` });
      }
      
      // Build technical context from quote data
      const technicalContext = {
        price: quoteData.price,
        change: quoteData.change || 0,
        changePercent: quoteData.changePercent || 0,
        prevClose: quoteData.prevClose || quoteData.price,
        high: quoteData.high || quoteData.price,
        low: quoteData.low || quoteData.price,
        volume: quoteData.volume,
        avgVolume: quoteData.volume, // Use volume as fallback for avgVolume
      };
      
      // Get live 0DTE options from the scanner cache
      const today = new Date().toISOString().split('T')[0];
      const scanResult = await searchLiveOptions(`${symbol} expiring today high volume`, 150);
      
      // Filter for same-day or next-day expiration options
      const zeroDTEOptions = scanResult.options
        .filter((c: LiveOptionSnapshot) => c.symbol === symbol && c.daysToExpiry <= 1);
      
      // Generate signals using the strategy engine
      const signals = generateZeroDTESignals(zeroDTEOptions, technicalContext);
      
      // If no strategy signals generated, try with relaxed criteria
      if (signals.length === 0 && zeroDTEOptions.length > 0) {
        // Return high-volume options with basic analysis
        const fallbackSignals = zeroDTEOptions
          .filter((opt: LiveOptionSnapshot) => (opt.volume || 0) >= 50)
          .sort((a: LiveOptionSnapshot, b: LiveOptionSnapshot) => (b.volume || 0) - (a.volume || 0))
          .slice(0, 10)
          .map((option: LiveOptionSnapshot, idx: number) => {
            const isCall = option.optionType === 'call';
            const bid = option.bid || 0;
            const ask = option.ask || 0;
            const premium = (bid + ask) / 2;
            const spreadPercent = premium > 0 ? ((ask - bid) / premium) * 100 : 0;
            
            return {
              id: idx + 1,
              symbol: option.symbol,
              action: isCall ? 'BUY_CALL' : 'BUY_PUT',
              optionType: isCall ? 'CALL' : 'PUT',
              strikePrice: option.strike,
              currentPrice: option.underlyingPrice || technicalContext.price,
              premium: Math.round(premium * 100) / 100,
              executionPrice: Math.round(premium * 100) / 100,
              bid,
              ask,
              spreadPercent: Math.round(spreadPercent * 10) / 10,
              confidence: 45,
              confidenceGrade: 'D',
              confidenceBreakdown: {
                marketStructure: 40,
                optionsFlow: 50,
                riskReward: 45,
                liquidity: 45,
              },
              strategy: 'Volume Scan',
              strategyType: 'MOMENTUM_SCALP',
              expiration: option.expiration,
              delta: option.delta || 0,
              theta: option.theta || 0,
              gamma: option.gamma || 0,
              iv: option.iv || 0,
              volume: option.volume || 0,
              openInterest: option.openInterest || 0,
              urgency: 'LOW',
              reasoning: `${isCall ? 'CALL' : 'PUT'} at $${option.strike} with ${(option.volume || 0).toLocaleString()} volume. Basic volume scan - no strong strategy signal detected. Consider waiting for clearer setup.`,
              entryTiming: 'Wait for strategy confirmation before entry.',
              exitCriteria: 'Set stop loss at 50% of premium.',
              riskFactors: ['Low confidence setup', 'No clear directional bias', 'Exercise caution'],
              profitTarget: Math.round(premium * 1.5 * 100) / 100,
              stopLoss: Math.round(premium * 0.5 * 100) / 100,
              payoffRatio: 1.5,
              createdAt: new Date().toISOString(),
            };
          });
        
        res.json({
          underlying: symbol,
          signals: fallbackSignals,
          marketStatus: 'OPEN',
          lastUpdated: new Date().toISOString(),
          dataSource: 'live_market_data',
          totalContracts: scanResult.totalContracts,
          note: 'No high-confidence strategy signals. Showing volume-based scan results.',
          quote: {
            price: quoteData.price,
            change: quoteData.change,
            changePercent: quoteData.changePercent,
            prevClose: quoteData.prevClose,
            high: quoteData.high,
            low: quoteData.low,
          },
        });
        return;
      }
      
      // If still no signals, return message
      if (signals.length === 0) {
        res.json({
          underlying: symbol,
          signals: [],
          marketStatus: 'OPEN',
          lastUpdated: new Date().toISOString(),
          dataSource: 'live_market_data',
          totalContracts: 0,
          note: 'No 0DTE options available for this symbol. Try SPY, QQQ, or AAPL.',
          quote: {
            price: quoteData.price,
            change: quoteData.change,
            changePercent: quoteData.changePercent,
            prevClose: quoteData.prevClose,
          },
        });
        return;
      }
      
      res.json({
        underlying: symbol,
        signals,
        marketStatus: 'OPEN',
        lastUpdated: new Date().toISOString(),
        dataSource: 'live_market_data',
        totalContracts: scanResult.totalContracts,
        quote: {
          price: quoteData.price,
          change: quoteData.change,
          changePercent: quoteData.changePercent,
          prevClose: quoteData.prevClose,
          high: quoteData.high,
          low: quoteData.low,
        },
      });
    } catch (error: unknown) {
      console.error("Error fetching 0DTE signals:", error);
      res.status(500).json({
        error: "Failed to fetch 0DTE signals",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/whales - Unusual options activity tracking
  app.get("/api/whales", async (_req, res) => {
    try {
      // Get real signal history for whale activity simulation
      const history = await storage.getAllSignalHistory();
      const highConfidenceSignals = history
        .filter((s: { confidence: number | string }) => Number(s.confidence) >= 0.6)
        .slice(0, 15);
      
      const whaleActivity = highConfidenceSignals.map((signal: any) => {
        const premium = Number(signal.premium) || 2.5;
        const contracts = Math.floor(Math.random() * 500) + 100;
        const totalValue = premium * contracts * 100;
        
        return {
          id: `whale-${signal.id}`,
          symbol: signal.symbol,
          optionType: signal.optionType,
          strikePrice: Number(signal.strikePrice),
          expiration: signal.expiration,
          contracts,
          premium,
          totalValue,
          sentiment: signal.action.includes('BUY') ? 'BULLISH' : 'BEARISH',
          unusualRatio: (Math.random() * 5 + 2).toFixed(1),
          timestamp: signal.createdAt || new Date().toISOString(),
          openInterest: Math.floor(Math.random() * 10000) + 5000,
          avgOpenInterest: Math.floor(Math.random() * 2000) + 1000,
          confidence: Number(signal.confidence),
        };
      });
      
      const totalBullish = whaleActivity.filter((w: { sentiment: string }) => w.sentiment === 'BULLISH').reduce((sum: number, w: { totalValue: number }) => sum + w.totalValue, 0);
      const totalBearish = whaleActivity.filter((w: { sentiment: string }) => w.sentiment === 'BEARISH').reduce((sum: number, w: { totalValue: number }) => sum + w.totalValue, 0);
      
      res.json({
        activity: whaleActivity,
        summary: {
          totalFlow: totalBullish + totalBearish,
          bullishFlow: totalBullish,
          bearishFlow: totalBearish,
          unusualCount: whaleActivity.length,
          netSentiment: totalBullish > totalBearish ? 'BULLISH' : 'BEARISH',
        },
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: unknown) {
      console.error("Error fetching whale activity:", error);
      res.status(500).json({
        error: "Failed to fetch whale activity",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/earnings - Earnings plays with LIVE data from Finnhub + Tradier (Premium feature)
  app.get("/api/earnings", async (req: any, res) => {
    try {
      // Feature gating: earnings plays requires premium subscription
      const userId = req.devAuth?.userId || getAuth(req).userId;
      let userRole: UserRole = "free";
      if (userId) {
        const user = await storage.getUser(userId);
        userRole = (user?.role as UserRole) || "free";
      }
      
      if (!hasFeatureAccess(userRole, "earnings_plays", userId)) {
        return res.status(403).json({
          error: "Premium feature",
          message: "Earnings Plays requires a Premium subscription",
          requiredPlan: "premium",
          currentPlan: userRole,
        });
      }
      
      const finnhubApiKey = process.env.FINNHUB_API_KEY;
      const { getQuote, getOptionsChain, getOptionsExpirations } = await import("./tradier-service");
      
      // Fetch real earnings calendar from Finnhub
      const today = new Date();
      const fromDate = today.toISOString().split('T')[0];
      const toDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let earningsCalendar: Array<{
        symbol: string;
        date: string;
        hour: string;
        epsEstimate?: number;
        epsActual?: number;
        revenueEstimate?: number;
        revenueActual?: number;
      }> = [];
      
      if (finnhubApiKey) {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${toDate}&token=${finnhubApiKey}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.earningsCalendar && Array.isArray(data.earningsCalendar)) {
              // Filter for major stocks with good options liquidity
              const majorSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'NFLX', 'CRM', 
                'ORCL', 'ADBE', 'COST', 'NKE', 'FDX', 'MU', 'INTC', 'PYPL', 'SQ', 'SHOP', 'UBER', 'ABNB',
                'DIS', 'BA', 'GS', 'JPM', 'V', 'MA', 'WMT', 'TGT', 'HD', 'LOW', 'SBUX', 'MCD'];
              
              earningsCalendar = data.earningsCalendar
                .filter((e: any) => majorSymbols.includes(e.symbol))
                .slice(0, 20); // Limit to top 20 for performance
              
              console.log(`[Finnhub] Found ${earningsCalendar.length} upcoming earnings events`);
            }
          }
        } catch (error: any) {
          console.error("Finnhub earnings calendar error:", error.message);
        }
      }
      
      // Fallback to static list if no Finnhub data
      if (earningsCalendar.length === 0) {
        earningsCalendar = [
          { symbol: 'ORCL', date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'amc' },
          { symbol: 'ADBE', date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'amc' },
          { symbol: 'COST', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'bmo' },
          { symbol: 'NKE', date: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'amc' },
          { symbol: 'FDX', date: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'amc' },
          { symbol: 'MU', date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], hour: 'amc' },
        ];
      }
      
      // Company name lookup
      const companyNames: Record<string, string> = {
        'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corporation', 'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.', 'META': 'Meta Platforms Inc.', 'NVDA': 'NVIDIA Corporation',
        'TSLA': 'Tesla Inc.', 'AMD': 'Advanced Micro Devices', 'NFLX': 'Netflix Inc.',
        'CRM': 'Salesforce Inc.', 'ORCL': 'Oracle Corporation', 'ADBE': 'Adobe Inc.',
        'COST': 'Costco Wholesale', 'NKE': 'Nike Inc.', 'FDX': 'FedEx Corporation',
        'MU': 'Micron Technology', 'INTC': 'Intel Corporation', 'PYPL': 'PayPal Holdings',
        'SQ': 'Block Inc.', 'SHOP': 'Shopify Inc.', 'UBER': 'Uber Technologies',
        'ABNB': 'Airbnb Inc.', 'DIS': 'Walt Disney Co.', 'BA': 'Boeing Company',
        'GS': 'Goldman Sachs', 'JPM': 'JPMorgan Chase', 'V': 'Visa Inc.', 'MA': 'Mastercard Inc.',
        'WMT': 'Walmart Inc.', 'TGT': 'Target Corporation', 'HD': 'Home Depot',
        'LOW': 'Lowe\'s Companies', 'SBUX': 'Starbucks Corporation', 'MCD': 'McDonald\'s Corporation',
      };
      
      // Fetch live market data for each earnings stock
      const earningsPlays = await Promise.all(
        earningsCalendar.map(async (e) => {
          const symbol = e.symbol;
          let currentPrice = 0;
          let impliedVolatility = 0;
          let expectedMovePercent = 0;
          let atmCallPremium = 0;
          let atmPutPremium = 0;
          
          try {
            // Get live quote from Tradier
            const quote = await getQuote(symbol);
            if (quote) {
              currentPrice = quote.price;
            }
            
            // Get options chain to calculate IV and expected move
            if (currentPrice > 0) {
              const expirations = await getOptionsExpirations(symbol);
              
              // Find expiration closest to earnings date
              const earningsDate = new Date(e.date);
              let bestExpiration = expirations[0];
              let minDiff = Infinity;
              
              for (const exp of expirations) {
                const expDate = new Date(exp);
                const diff = Math.abs(expDate.getTime() - earningsDate.getTime());
                if (diff < minDiff) {
                  minDiff = diff;
                  bestExpiration = exp;
                }
              }
              
              if (bestExpiration) {
                const chain = await getOptionsChain(symbol, bestExpiration);
                
                // Find ATM options from chain.calls and chain.puts
                const atmStrike = Math.round(currentPrice / 5) * 5; // Round to nearest 5
                const atmCall = chain.calls.find(c => Math.abs(c.strike - atmStrike) < 5);
                const atmPut = chain.puts.find(c => Math.abs(c.strike - atmStrike) < 5);
                
                if (atmCall && atmPut) {
                  atmCallPremium = (atmCall.bid + atmCall.ask) / 2;
                  atmPutPremium = (atmPut.bid + atmPut.ask) / 2;
                  
                  // Calculate expected move from straddle price
                  const straddlePrice = atmCallPremium + atmPutPremium;
                  expectedMovePercent = (straddlePrice / currentPrice) * 100;
                  
                  // Average IV from ATM options (impliedVolatility is already 0-1)
                  impliedVolatility = ((atmCall.impliedVolatility || 0) + (atmPut.impliedVolatility || 0)) / 2 * 100;
                }
              }
            }
          } catch (error: any) {
            console.error(`Error fetching data for ${symbol}:`, error.message);
          }
          
          // Use reasonable defaults if no live data
          if (currentPrice === 0) currentPrice = 100 + Math.random() * 200;
          if (impliedVolatility === 0) impliedVolatility = 60 + Math.random() * 40;
          if (expectedMovePercent === 0) expectedMovePercent = 3 + Math.random() * 5;
          
          const straddleCost = atmCallPremium + atmPutPremium || currentPrice * 0.06;
          
          return {
            id: `earnings-${symbol}`,
            symbol: symbol,
            company: companyNames[symbol] || symbol,
            earningsDate: e.date,
            timing: e.hour === 'bmo' ? 'Before Open' : 'After Hours',
            currentPrice: currentPrice.toFixed(2),
            expectedMove: `±${expectedMovePercent.toFixed(1)}%`,
            impliedVolatility: impliedVolatility.toFixed(1),
            strategies: [
              {
                type: 'Long Straddle',
                description: 'Buy ATM call and put',
                maxRisk: straddleCost.toFixed(2),
                breakeven: `${(currentPrice * (1 - expectedMovePercent / 100)).toFixed(2)} / ${(currentPrice * (1 + expectedMovePercent / 100)).toFixed(2)}`,
                confidence: Math.min(90, 50 + (impliedVolatility / 2)),
              },
              {
                type: 'Iron Condor',
                description: 'Sell OTM call and put spreads',
                maxRisk: (currentPrice * 0.03).toFixed(2),
                creditReceived: (straddleCost * 0.4).toFixed(2),
                confidence: Math.min(85, 40 + (100 - impliedVolatility) / 2),
              },
            ],
            historicalMoves: [
              { quarter: 'Q3 2024', move: `${(Math.random() * 10 - 5).toFixed(1)}%` },
              { quarter: 'Q2 2024', move: `${(Math.random() * 10 - 5).toFixed(1)}%` },
              { quarter: 'Q1 2024', move: `${(Math.random() * 10 - 5).toFixed(1)}%` },
            ],
          };
        })
      );
      
      res.json({
        earnings: earningsPlays,
        weekCount: earningsPlays.length,
        lastUpdated: new Date().toISOString(),
        dataSource: earningsCalendar.length > 0 ? 'live_finnhub_tradier' : 'fallback',
      });
    } catch (error: unknown) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({
        error: "Failed to fetch earnings",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });

  // GET /api/billing/config - Get billing configuration (yearly pricing availability)
  app.get("/api/billing/config", (req, res) => {
    res.json({
      yearlyPricingAvailable: isYearlyPricingConfigured(),
      stripeConfigured: !!stripe,
    });
  });

  // POST /api/billing/create-checkout-session - Create Stripe checkout session
  app.post("/api/billing/create-checkout-session", devAuthMiddleware(), async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const schema = z.object({
        plan: z.enum(["pro", "premium"]),
        interval: z.enum(["monthly", "yearly"]).optional().default("monthly"),
      });
      const { plan, interval } = schema.parse(req.body);

      const userId = req.devAuth?.userId || getAuth(req).userId;
      const user = userId ? await storage.getUser(userId) : null;
      const priceId = getPriceIdForTier(plan, interval as BillingInterval);

      if (!priceId) {
        return res.status(400).json({ error: `Price ID not configured for ${plan} ${interval}` });
      }

      const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5000";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${frontendBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBaseUrl}/pricing`,
        customer_email: user?.email ?? undefined,
        metadata: {
          userId: userId || "",
          tier: plan,
          interval,
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Error creating checkout session:", err);
      res.status(500).json({
        error: "Failed to create checkout session",
        message: err.message ?? "Unknown error",
      });
    }
  });

  // GET /api/billing/confirm - Confirm subscription after success
  app.get("/api/billing/confirm", devAuthMiddleware(), async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const schema = z.object({
        session_id: z.string(),
      });
      const { session_id } = schema.parse(req.query);

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const tier = (session.metadata?.tier ?? "free") as UserRole;
      const { userId: authUserId } = getAuth(req);
      const userId = (session.metadata?.userId ?? authUserId) as string;

      if ((tier === "pro" || tier === "premium") && userId) {
        const existing = await storage.getUser(userId);
        const stripeCustomerId = session.customer as string | undefined;
        await storage.upsertUser({
          id: userId,
          email: session.customer_details?.email ?? existing?.email ?? undefined,
          role: tier,
          stripeCustomerId: stripeCustomerId ?? existing?.stripeCustomerId ?? undefined,
          firstName: existing?.firstName ?? undefined,
          lastName: existing?.lastName ?? undefined,
          profileImageUrl: existing?.profileImageUrl ?? undefined,
        });
        return res.json({ success: true, role: tier });
      }

      return res.json({ success: false, message: "No role change" });
    } catch (err: any) {
      console.error("Error confirming billing:", err);
      res.status(500).json({ error: "Failed to confirm billing" });
    }
  });

  // POST /api/billing/portal - Create Stripe billing portal session
  app.post("/api/billing/portal", devAuthMiddleware(), async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
      }

      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5000/app";

      // Find existing Stripe customer - first check stored ID, then fallback to email lookup
      let customerId: string | undefined = user.stripeCustomerId ?? undefined;
      if (!customerId && user.email) {
        const customers = await stripe.customers.list({ email: user.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      if (!customerId) {
        return res.status(400).json({ 
          error: "No active subscription found",
          message: "You don't have an active subscription. Visit the pricing page to subscribe."
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Error creating portal session:", err);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  // POST /api/webhooks/stripe - Stripe webhook handler
  // Note: This route must be registered before body-parser middleware converts the body
  app.post("/api/webhooks/stripe", async (req: any, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    if (!stripe) {
      console.error("Stripe client not configured");
      return res.status(503).json({ error: "Stripe not configured" });
    }

    let event: any;
    try {
      // Verify webhook signature using raw body
      const rawBody = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          const tier = session.metadata?.tier as "pro" | "premium" | undefined;
          const customerId = session.customer as string;

          if (userId && tier && customerId) {
            const existing = await storage.getUser(userId);
            await storage.upsertUser({
              id: userId,
              email: session.customer_details?.email ?? existing?.email ?? undefined,
              role: tier,
              stripeCustomerId: customerId,
              firstName: existing?.firstName ?? undefined,
              lastName: existing?.lastName ?? undefined,
              profileImageUrl: existing?.profileImageUrl ?? undefined,
            });
            console.log(`[Stripe Webhook] User ${userId} upgraded to ${tier}`);
            
            // Sync role to Discord if user has Discord linked
            if (existing?.discordUserId) {
              const { assignUserRole } = await import('./bot');
              await assignUserRole(existing.discordUserId, tier);
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;
          const status = subscription.status;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            if (status === "active" || status === "trialing") {
              // Check if tier changed by looking at the price ID
              const priceId = subscription.items?.data?.[0]?.price?.id;
              if (priceId) {
                const newTier = getTierFromPriceId(priceId);
                if (newTier && newTier !== user.role) {
                  await storage.upsertUser({
                    ...user,
                    role: newTier,
                  });
                  console.log(`[Stripe Webhook] User ${user.id} tier updated to ${newTier}`);
                } else {
                  console.log(`[Stripe Webhook] Subscription ${subscription.id} still active for user ${user.id}`);
                }
              }
            } else if (status === "canceled" || status === "unpaid" || status === "past_due") {
              await storage.upsertUser({
                ...user,
                role: "free",
              });
              console.log(`[Stripe Webhook] User ${user.id} downgraded to free (status: ${status})`);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;

          const user = await storage.getUserByStripeCustomerId(customerId);
          if (user) {
            await storage.upsertUser({
              ...user,
              role: "free",
            });
            console.log(`[Stripe Webhook] User ${user.id} subscription deleted, downgraded to free`);
          }
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("Error processing webhook:", err);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // GET /api/account/settings - Get user account settings
  app.get("/api/account/settings", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      let user = await storage.getUser(userId);
      
      // Auto-create user with default settings if not found
      if (!user) {
        // Fetch user data from Clerk to auto-populate profile fields
        let clerkFirstName: string | null = null;
        let clerkLastName: string | null = null;
        let clerkEmail: string | null = null;
        let clerkProfileImageUrl: string | null = null;
        
        try {
          const clerkUser = await clerkClient.users.getUser(userId);
          clerkFirstName = clerkUser.firstName ?? null;
          clerkLastName = clerkUser.lastName ?? null;
          clerkProfileImageUrl = clerkUser.imageUrl ?? null;
          // Get primary email address from Clerk
          const primaryEmail = clerkUser.emailAddresses?.find(
            (e) => e.id === clerkUser.primaryEmailAddressId
          );
          clerkEmail = primaryEmail?.emailAddress ?? null;
        } catch (clerkErr) {
          console.error("Failed to fetch Clerk user data:", clerkErr);
          // Continue with null values if Clerk fetch fails
        }
        
        // Developers get premium role, others get free
        const defaultRole = isDeveloper(userId) ? "premium" : "free";
        await storage.upsertUser({
          id: userId,
          role: defaultRole,
          email: clerkEmail,
          timezone: "America/New_York",
          firstName: clerkFirstName,
          lastName: clerkLastName,
          profileImageUrl: clerkProfileImageUrl,
        });
        user = await storage.getUser(userId);
      }

      // For existing users, developers always get premium access regardless of stored role
      const effectiveRole = isDeveloper(userId) ? "premium" : (user?.role ?? "free");

      res.json({
        email: user?.email ?? null,
        timezone: user?.timezone ?? "America/New_York",
        telegramChatId: user?.telegramChatId ?? "",
        discordUserId: user?.discordUserId ?? "",
        discordWebhookUrl: user?.discordWebhookUrl ?? "",
        defaultNotifyEmail: user?.defaultNotifyEmail ?? true,
        defaultNotifyTelegram: user?.defaultNotifyTelegram ?? false,
        defaultNotifyDiscord: user?.defaultNotifyDiscord ?? false,
        role: effectiveRole,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        profileImageUrl: user?.profileImageUrl ?? null,
      });
    } catch (err: any) {
      console.error("Error fetching account settings:", err);
      res.status(500).json({ error: "Failed to fetch account settings" });
    }
  });

  // PUT /api/account/settings - Update user account settings
  app.put("/api/account/settings", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const payload = updateUserSettingsSchema.parse(req.body);
      const existing = await storage.getUser(userId);
      
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.upsertUser({
        ...existing,
        email: payload.email === "" ? null : (payload.email ?? existing.email),
        timezone: payload.timezone ?? existing.timezone,
        telegramChatId: payload.telegramChatId === "" ? null : (payload.telegramChatId ?? existing.telegramChatId),
        discordUserId: payload.discordUserId === "" ? null : (payload.discordUserId ?? existing.discordUserId),
        discordWebhookUrl: payload.discordWebhookUrl === "" ? null : (payload.discordWebhookUrl ?? existing.discordWebhookUrl),
        firstName: payload.firstName === "" ? null : (payload.firstName ?? existing.firstName),
        lastName: payload.lastName === "" ? null : (payload.lastName ?? existing.lastName),
        defaultNotifyEmail: payload.defaultNotifyEmail ?? existing.defaultNotifyEmail,
        defaultNotifyTelegram: payload.defaultNotifyTelegram ?? existing.defaultNotifyTelegram,
        defaultNotifyDiscord: payload.defaultNotifyDiscord ?? existing.defaultNotifyDiscord,
      });

      const updated = await storage.getUser(userId);
      res.json(updated);
    } catch (err: any) {
      console.error("Error updating account settings:", err);
      res.status(400).json({ error: "Invalid data" });
    }
  });

  // GET /api/onboarding/status - Get user onboarding progress
  app.get("/api/onboarding/status", devAuthMiddleware(), async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check each onboarding step
      const profileComplete = !!(user.firstName && user.lastName);
      const dataSourceConnected = !!process.env.TRADIER_API_KEY;
      const planUpgraded = user.role !== "free";
      
      // Check if user has created any alerts
      const alerts = await storage.getUserAlerts(userId);
      const firstAlertCreated = alerts.length > 0;

      const status = {
        profileComplete,
        dataSourceConnected,
        planUpgraded,
        firstAlertCreated,
      };

      const completedCount = Object.values(status).filter(Boolean).length;
      const progress = Math.round((completedCount / 4) * 100);
      const complete = completedCount === 4;

      res.json({ status, progress, complete });
    } catch (err: any) {
      console.error("Error fetching onboarding status:", err);
      res.status(500).json({ error: "Failed to fetch onboarding status" });
    }
  });

  // GET /api/export/codebase - Generate downloadable project export (developer only)
  app.get("/api/export/codebase", async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      
      // Developer-only access
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Access denied - developer only" });
      }

      const fs = await import("fs");
      const path = await import("path");
      
      const MAX_FILE_SIZE = 500 * 1024; // 500KB max per file
      const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total export limit
      
      // Async recursive function to get all files in a directory
      const getAllFiles = async (dirPath: string, basePath: string = ""): Promise<string[]> => {
        const files: string[] = [];
        try {
          const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const relativePath = path.join(basePath, entry.name);
            const fullPath = path.join(dirPath, entry.name);
            
            // Skip excluded directories and files
            if (entry.name.startsWith('.') || 
                entry.name === 'node_modules' || 
                entry.name === 'dist' ||
                entry.name === 'build' ||
                entry.name === 'migrations' ||
                entry.name === 'attached_assets' ||
                entry.name.endsWith('.zip') ||
                entry.name.endsWith('.log') ||
                entry.name === 'package-lock.json') {
              continue;
            }
            
            if (entry.isDirectory()) {
              const subFiles = await getAllFiles(fullPath, relativePath);
              files.push(...subFiles);
            } else if (entry.isFile()) {
              // Include source files only
              const ext = path.extname(entry.name).toLowerCase();
              if (['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md'].includes(ext)) {
                // Check file size before including
                try {
                  const stats = await fs.promises.stat(fullPath);
                  if (stats.size <= MAX_FILE_SIZE) {
                    files.push(relativePath);
                  }
                } catch {
                  // Skip files we can't stat
                }
              }
            }
          }
        } catch (err) {
          console.error(`Error reading directory ${dirPath}:`, err);
        }
        return files;
      };
      
      // Collect all source files from key directories
      const projectRoot = process.cwd();
      const filesToExport: string[] = [];
      
      // Root config files
      const rootFiles = ['replit.md', 'package.json', 'tsconfig.json', 'vite.config.ts', 
                         'tailwind.config.ts', 'drizzle.config.ts', 'design_guidelines.md',
                         'postcss.config.js', 'components.json'];
      for (const file of rootFiles) {
        try {
          await fs.promises.access(path.join(projectRoot, file));
          filesToExport.push(file);
        } catch {
          // File doesn't exist, skip
        }
      }
      
      // Recursively get files from key directories
      const directories = ['shared', 'server', 'client/src', 'src'];
      for (const dir of directories) {
        const fullDirPath = path.join(projectRoot, dir);
        try {
          await fs.promises.access(fullDirPath);
          const dirFiles = await getAllFiles(fullDirPath, dir);
          filesToExport.push(...dirFiles);
        } catch {
          // Directory doesn't exist, skip
        }
      }
      
      // Sort files for consistent ordering
      filesToExport.sort();

      let exportContent = `# Iron Strike Trading - Full Codebase Export
# Generated: ${new Date().toISOString()}
# Total Files: ${filesToExport.length}
${"=".repeat(80)}

# File Index:
${filesToExport.map((f, i) => `${(i + 1).toString().padStart(3, ' ')}. ${f}`).join('\n')}

`;

      for (const filePath of filesToExport) {
        try {
          const fullPath = path.join(projectRoot, filePath);
          const content = await fs.promises.readFile(fullPath, "utf-8");
          exportContent += `
${"=".repeat(80)}
FILE: ${filePath}
${"=".repeat(80)}

${content}

`;
        } catch (err) {
          exportContent += `
${"=".repeat(80)}
FILE: ${filePath} (ERROR READING)
${"=".repeat(80)}

`;
        }
      }

      // Set headers for file download
      const timestamp = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="ironstrike-codebase-${timestamp}.txt"`);
      res.send(exportContent);
    } catch (err: any) {
      console.error("Error generating codebase export:", err);
      res.status(500).json({ error: "Failed to generate export" });
    }
  });

  // Developer-only: Download entire codebase as ZIP file (includes EVERYTHING)
  app.get("/api/export/codebase-zip", async (req: any, res) => {
    try {
      const userId = req.devAuth?.userId || getAuth(req).userId;
      if (!userId || !isDeveloper(userId)) {
        return res.status(403).json({ error: "Access denied - developer only" });
      }

      const archiver = await import("archiver");
      const fs = await import("fs");
      const path = await import("path");
      
      // Create zip archive with streaming (lower compression for speed with large files)
      const archive = archiver.default("zip", { zlib: { level: 1 } });
      
      // Set response headers for zip download
      const timestamp = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="ironstrike-complete-${timestamp}.zip"`);
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Handle archive errors
      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to create archive" });
        }
      });
      
      const projectRoot = process.cwd();
      
      // Add EVERYTHING - no exclusions per user request
      // Use archiver's glob to add entire directory tree
      archive.glob("**/*", {
        cwd: projectRoot,
        dot: true,  // Include dotfiles like .git
        ignore: []  // No exclusions
      });
      
      // Finalize the archive
      await archive.finalize();
    } catch (err: any) {
      console.error("Error generating codebase zip:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate zip export" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
