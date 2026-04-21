// AI service for intelligent trading signal generation
// Outputs strategy filters for backend to select real contracts from Polygon
// All AI calls route through the AI Gateway for Iron Strike Doctrine enforcement
import pLimit from "p-limit";
import pRetry from "p-retry";
import { calculateTechnicalIndicators, formatIndicatorsForAI, type TechnicalIndicators } from "./technical-indicators";
import { env, isAIAvailable as checkAIAvailable } from "./config/env";
import { getSymbolLearningMetrics } from "./adaptive-learning";
import { generateRawSignal, type RawSignalResponse } from "./ai-gateway";
import type { AdaptiveLearning } from "@shared/schema";

// Helper function to check if error is rate limit or quota violation
function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

// Core strategy filters - matches polygonOptions.StrategyFilters exactly
export interface AIStrategyFilters {
  direction: "BUY_CALL" | "BUY_PUT" | "NO_TRADE";
  preferredExpirationWindow: "0dte" | "1w" | "2w" | "3w" | "1m";
  preferredMoneyness: "deep_itm" | "itm" | "atm" | "slightly_otm" | "far_otm";
  targetDeltaRange: [number, number];
}

// Extended response includes AI analysis context (separate from core filters)
export interface AIAnalysisResult {
  filters: AIStrategyFilters;
  riskPercent: number; // 0.01 to 0.05 - AI's suggested risk per trade
  confidence: number; // 0.0 to 1.0
  reasoning: string;
  patternAnalysis: string;
  // Optional price levels - only present for tradeable directions
  priceLevels?: {
    stopLossPrice: number;
    takeProfitPrice: number;
  };
  // Adaptive learning insight - explains confidence adjustments based on historical performance
  adaptiveNote?: string;
}

// Adaptive context passed to AI and used for post-processing
interface AdaptiveContext {
  symbol: string;
  totalSignals: number;
  successRate: number | null;
  recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "UNKNOWN";
}

// Build comprehensive trading methodology prompt with REAL market data
// Outputs strategy filters instead of specific prices/greeks
function buildStrategyFilterPrompt(
  symbol: string, 
  currentPrice: number, 
  indicators: TechnicalIndicators,
  adaptiveContext?: AdaptiveContext
): string {
  const realDataSection = formatIndicatorsForAI(indicators);
  
  // Build adaptive learning section if metrics available
  let adaptiveSection = "";
  if (adaptiveContext && adaptiveContext.totalSignals > 0) {
    const successRateStr = adaptiveContext.successRate !== null 
      ? `${(adaptiveContext.successRate * 100).toFixed(0)}%`
      : "N/A";
    adaptiveSection = `
═══════════════════════════════════════════════════════════════
ADAPTIVE LEARNING CONTEXT FOR ${symbol}
═══════════════════════════════════════════════════════════════

You have historical performance data for this symbol:
• Total Signals Generated: ${adaptiveContext.totalSignals}
• Historical Success Rate: ${successRateStr}
• Recent Performance Trend: ${adaptiveContext.recentTrend}

${adaptiveContext.successRate !== null && adaptiveContext.successRate < 0.45 
  ? "⚠️ CAUTION: Historical accuracy for this symbol is below average. Consider being more conservative with confidence levels and position sizing."
  : adaptiveContext.successRate !== null && adaptiveContext.successRate > 0.60
  ? "✓ STRENGTH: Historical accuracy for this symbol is above average. You may be slightly more confident if technicals align."
  : "• Moderate historical performance - use standard confidence assessment."}

${adaptiveContext.recentTrend === "DECLINING" 
  ? "⚠️ Recent signals for this symbol have underperformed - consider extra caution."
  : adaptiveContext.recentTrend === "IMPROVING"
  ? "✓ Recent signals for this symbol have been improving."
  : ""}

Factor this performance data into your confidence assessment.
`;
  }
  
  return `You are an elite options trading analyst. Analyze the market data and output STRATEGY FILTERS that will be used to select real option contracts from the market.

**CRITICAL RULE: YOU MUST RETURN EITHER BUY_CALL OR BUY_PUT. NO_TRADE IS FORBIDDEN.**
Every stock has a directional bias - find it. If bullish bias, return BUY_CALL. If bearish bias, return BUY_PUT.
Use confidence level (0.35-0.95) to express uncertainty, NOT the NO_TRADE action.
A 0.40 confidence BUY_CALL is ALWAYS better than NO_TRADE.

${realDataSection}
${adaptiveSection}
IMPORTANT: Use the REAL data above to make your analysis. Output strategy preferences, NOT specific option prices or greeks - those will come from live market data.

═══════════════════════════════════════════════════════════════
ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════════════

【TREND ANALYSIS】
- Price vs Moving Averages: EMA9/21 alignment, SMA50/200 positioning
- Momentum: RSI direction, MACD histogram
- Volatility: Bollinger Band position, ATR relative to price

【SIGNAL STRENGTH CRITERIA】

STRONG BUY_CALL (Confidence 0.75-0.95):
• Price above all key MAs, EMA9 > EMA21 > SMA50
• RSI 50-65 trending up
• MACD histogram positive and expanding
• Price bouncing off support

STRONG BUY_PUT (Confidence 0.75-0.95):
• Price below key MAs, EMA9 < EMA21 < SMA50
• RSI 35-50 trending down
• MACD histogram negative and expanding
• Price rejected at resistance

MODERATE SIGNALS (Confidence 0.55-0.70):
• Mixed MA alignment but clear bias
• RSI showing direction but not extreme
• Volume confirming the move

**NO_TRADE IS FORBIDDEN - DO NOT USE IT**
• Always find the directional bias and return BUY_CALL or BUY_PUT
• If RSI > 50 or any bullish indicator: BUY_CALL with appropriate confidence
• If RSI < 50 or any bearish indicator: BUY_PUT with appropriate confidence  
• If truly neutral (RSI exactly 50): Look at trend, recent price action, or support/resistance to determine direction
• Express uncertainty through lower confidence (0.35-0.50), NEVER through NO_TRADE

【EXPIRATION WINDOW SELECTION】

Based on the setup quality and market conditions:
• "0dte": Only for very high confidence (>0.85), clear breakout/breakdown
• "1w": High confidence (0.75-0.85), strong momentum plays
• "2w": Moderate-high confidence (0.65-0.75), swing trades
• "3w": Moderate confidence (0.55-0.65), allows time for thesis to play out
• "1m": Lower confidence but strong fundamental thesis

【MONEYNESS SELECTION】

Based on confidence and risk tolerance:
• "deep_itm": Very conservative, high delta (0.7+), for income strategies
• "itm": Conservative, delta 0.55-0.70, higher probability
• "atm": Balanced risk/reward, delta ~0.50
• "slightly_otm": Moderate leverage, delta 0.30-0.45, common for directional
• "far_otm": Speculative, delta 0.15-0.30, lottery tickets

【DELTA RANGE SELECTION】

Target delta range based on strategy:
• Conservative: [0.50, 0.70] - Higher probability, less leverage
• Balanced: [0.35, 0.50] - Sweet spot for directional trades
• Aggressive: [0.20, 0.35] - More leverage, lower probability
• Speculative: [0.10, 0.25] - High reward potential

【RISK PERCENT SUGGESTION】

Suggest risk percent based on confidence (0.01 to 0.05):
• High confidence (>0.75): 0.04-0.05 (4-5% of account)
• Moderate confidence (0.60-0.75): 0.02-0.03 (2-3%)
• Lower confidence (0.50-0.60): 0.01-0.02 (1-2%)
• Risk profile will clamp this to user's settings

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return ONLY valid JSON with these fields:
{
  "direction": "BUY_CALL" | "BUY_PUT",  // MUST be one of these - NO_TRADE is forbidden
  "preferredExpirationWindow": "0dte" | "1w" | "2w" | "3w" | "1m",
  "preferredMoneyness": "deep_itm" | "itm" | "atm" | "slightly_otm" | "far_otm",
  "targetDeltaRange": [minDelta, maxDelta],
  "riskPercent": 0.01 to 0.05,
  "confidence": 0.0 to 1.0,
  "stopLossPrice": number (ONLY if direction is BUY_CALL or BUY_PUT, based on support/resistance),
  "takeProfitPrice": number (ONLY if direction is BUY_CALL or BUY_PUT, based on support/resistance),
  "reasoning": "One clear sentence with your main thesis",
  "patternAnalysis": "Markdown analysis with technical details"
}

NOTE: You MUST provide stopLossPrice and takeProfitPrice for every signal.

PATTERN ANALYSIS FORMAT:
"""
### Technical Analysis

- **RSI (14)**: [value], [interpretation]
- **MACD**: [values], [trend description]
- **Moving Averages**: [MA alignment description]
- **Bollinger Bands**: [position and interpretation]
- **Support/Resistance**: Support $[level], Resistance $[level]

---

### Market Sentiment

- [Describe trend and momentum]
- [Volume interpretation]

---

### Conclusion

[1-2 sentences: trade thesis and key levels]
"""

STOP LOSS/TAKE PROFIT based on real data (only for BUY_CALL or BUY_PUT):
- BUY_CALL: stopLoss near support $${indicators.support.toFixed(2)}, takeProfit near resistance $${indicators.resistance.toFixed(2)}
- BUY_PUT: stopLoss near resistance $${indicators.resistance.toFixed(2)}, takeProfit near support $${indicators.support.toFixed(2)}
- Adjust by 0.5-1x ATR ($${indicators.atr14.toFixed(2)}) for buffer

Analyze ${symbol} at $${currentPrice.toFixed(2)} and provide your strategy filters.`;
}

// Apply adaptive post-processing to adjust confidence based on historical performance
// Note: AI prompt already receives adaptive context for informed analysis.
// Post-processing applies bounded adjustments (max +/-8%) based on historical metrics.
function applyAdaptivePostProcessing(
  result: AIAnalysisResult,
  adaptive: AdaptiveLearning | null
): AIAnalysisResult {
  // Return unmodified if no adaptive data or insufficient history
  if (!adaptive || adaptive.totalSignals < 10) {
    if (adaptive && adaptive.totalSignals > 0 && adaptive.totalSignals < 10) {
      return {
        ...result,
        adaptiveNote: `Building history (${adaptive.totalSignals} signals tracked)`,
      };
    }
    return result;
  }

  const base = { ...result };
  const winRate = adaptive.successRate;
  const total = adaptive.totalSignals;
  const notes: string[] = [];
  const originalConfidence = base.confidence;

  // Adjust confidence based on historical win rate
  // Max adjustment is +/-8% to avoid double-counting (AI already has context)
  let adjustedConfidence = originalConfidence;

  if (winRate < 0.45) {
    // Cold symbol: apply modest penalty (max -8%)
    const penalty = Math.min(0.08, (0.45 - winRate) * 0.3);
    adjustedConfidence = originalConfidence - penalty;
    notes.push(`${(winRate * 100).toFixed(0)}% historical win rate`);
  } else if (winRate > 0.60 && total >= 15) {
    // Hot symbol: apply modest boost (max +8%)
    const boost = Math.min(0.08, (winRate - 0.60) * 0.3);
    adjustedConfidence = originalConfidence + boost;
    if (boost > 0.01) {
      notes.push(`${(winRate * 100).toFixed(0)}% win rate`);
    }
  }

  // Factor in recent trend (max +/-3%)
  if (adaptive.recentTrend === "DECLINING") {
    adjustedConfidence = adjustedConfidence - 0.03;
    notes.push("Recent trend: declining");
  } else if (adaptive.recentTrend === "IMPROVING" && winRate > 0.50) {
    adjustedConfidence = adjustedConfidence + 0.03;
    notes.push("Recent trend: improving");
  }

  // Strict final clamping to [0.10, 0.95] range
  adjustedConfidence = Math.max(0.10, Math.min(0.95, adjustedConfidence));

  // Build final note
  const adaptiveNote = notes.length > 0 
    ? notes.join(" | ") 
    : `${total} signals tracked, ${(winRate * 100).toFixed(0)}% win rate`;

  return {
    ...base,
    confidence: Number(adjustedConfidence.toFixed(2)),
    adaptiveNote,
  };
}

// Fetch adaptive metrics for a symbol (returns null if unavailable)
async function getAdaptiveContext(symbol: string): Promise<AdaptiveContext | null> {
  try {
    const metrics = await getSymbolLearningMetrics(symbol);
    return {
      symbol: metrics.symbol,
      totalSignals: metrics.totalSignals,
      successRate: metrics.totalSignals > 0 ? metrics.successRate : null,
      recentTrend: metrics.recentTrend,
    };
  } catch (error) {
    console.log(`[AI] Could not fetch adaptive metrics for ${symbol}:`, error);
    return null;
  }
}

// Analyze a single symbol with AI - routes through AI Gateway for Iron Strike Doctrine
async function analyzeSymbolForFilters(
  symbol: string,
  currentPrice: number,
  indicators: TechnicalIndicators,
  adaptiveContext?: AdaptiveContext | null
): Promise<AIAnalysisResult> {
  return await pRetry(
    async () => {
      try {
        const prompt = buildStrategyFilterPrompt(symbol, currentPrice, indicators, adaptiveContext ?? undefined);

        // Route through AI Gateway for Iron Strike Doctrine enforcement
        const gatewayResult = await generateRawSignal(prompt, "gpt-4o", 4096);
        
        if (!gatewayResult.success) {
          console.warn(`[AI Service] Gateway returned non-success:`, gatewayResult.validationErrors);
          // Gateway already provides a valid NO_TRADE response on failure
        }
        
        const parsedContent = gatewayResult.data;
        const direction = parsedContent.direction;

        // Core filters - matches StrategyFilters interface exactly
        const filters: AIStrategyFilters = {
          direction,
          preferredExpirationWindow: parsedContent.preferredExpirationWindow,
          preferredMoneyness: parsedContent.preferredMoneyness,
          targetDeltaRange: parsedContent.targetDeltaRange,
        };

        // Build result with optional price levels
        const result: AIAnalysisResult = {
          filters,
          riskPercent: Math.max(0.01, Math.min(0.05, parsedContent.riskPercent)),
          confidence: parsedContent.confidence,
          reasoning: parsedContent.reasoning,
          patternAnalysis: parsedContent.patternAnalysis,
        };

        // Only add price levels for tradeable directions
        if (direction !== "NO_TRADE") {
          const isBullish = direction === "BUY_CALL";
          const defaultStopLoss = isBullish 
            ? indicators.support - (indicators.atr14 * 0.5)
            : indicators.resistance + (indicators.atr14 * 0.5);
          const defaultTakeProfit = isBullish
            ? indicators.resistance + (indicators.atr14 * 0.5)
            : indicators.support - (indicators.atr14 * 0.5);

          result.priceLevels = {
            stopLossPrice: parsedContent.stopLossPrice || Number(defaultStopLoss.toFixed(2)),
            takeProfitPrice: parsedContent.takeProfitPrice || Number(defaultTakeProfit.toFixed(2)),
          };
        }

        return result;
      } catch (error: any) {
        if (isRateLimitError(error)) {
          throw error;
        }
        throw error;
      }
    },
    {
      retries: 5,
      minTimeout: 2000,
      maxTimeout: 60000,
      factor: 2,
    }
  );
}

// Fail-safe error response for when AI is unavailable
export interface AIErrorResponse {
  error: "AI_UNAVAILABLE";
  message: string;
}

// Check if AI service is available
export function isAIAvailable(): boolean {
  return checkAIAvailable();
}

// Analyze a single symbol and return strategy filters
export async function analyzeSymbol(
  symbol: string,
  currentPrice: number
): Promise<AIAnalysisResult | AIErrorResponse> {
  if (!isAIAvailable()) {
    console.warn("[AI] AI service not configured - returning fail-safe response");
    return {
      error: "AI_UNAVAILABLE",
      message: "AI analysis is currently offline. Please try again soon.",
    };
  }

  try {
    // Fetch adaptive metrics and technical indicators in parallel
    console.log(`[AI] Fetching data for ${symbol}...`);
    const [adaptiveContext, indicators] = await Promise.all([
      getAdaptiveContext(symbol),
      calculateTechnicalIndicators(symbol),
    ]);
    
    if (adaptiveContext && adaptiveContext.totalSignals > 0) {
      console.log(`[AI] ${symbol} adaptive: ${adaptiveContext.totalSignals} signals, ${adaptiveContext.successRate !== null ? (adaptiveContext.successRate * 100).toFixed(0) + '%' : 'N/A'} win rate, ${adaptiveContext.recentTrend} trend`);
    }
    
    console.log(`[AI] Analyzing ${symbol} for strategy filters...`);
    const rawResult = await analyzeSymbolForFilters(symbol, currentPrice, indicators, adaptiveContext);
    
    // Apply adaptive post-processing to adjust confidence based on historical performance
    const adaptiveMetrics = adaptiveContext ? await getSymbolLearningMetrics(symbol) : null;
    const result = applyAdaptivePostProcessing(rawResult, adaptiveMetrics);
    
    console.log(`[AI] ${symbol}: ${result.filters.direction} (${(result.confidence * 100).toFixed(0)}% confidence), ${result.filters.preferredExpirationWindow} expiry${result.adaptiveNote ? `, Adaptive: ${result.adaptiveNote}` : ''}`);
    
    return result;
  } catch (error: any) {
    console.error(`[AI] Analysis failed for ${symbol}:`, error.message);
    return {
      error: "AI_UNAVAILABLE",
      message: "AI analysis encountered an error. Please try again soon.",
    };
  }
}

// Batch process multiple symbols with rate limiting
export async function batchAnalyzeSymbols(
  symbols: string[],
  prices: number[]
): Promise<AIAnalysisResult[] | AIErrorResponse> {
  if (!isAIAvailable()) {
    console.warn("[AI] AI service not configured - returning fail-safe response");
    return {
      error: "AI_UNAVAILABLE",
      message: "AI analysis is currently offline. Please try again soon.",
    };
  }

  try {
    const limit = pLimit(2); // Process up to 2 requests concurrently

    // Fetch technical indicators and adaptive context for all symbols in parallel
    console.log(`[AI] Fetching data for ${symbols.join(', ')}...`);
    const [allIndicators, allAdaptive] = await Promise.all([
      Promise.all(symbols.map(symbol => calculateTechnicalIndicators(symbol))),
      Promise.all(symbols.map(symbol => getAdaptiveContext(symbol))),
    ]);
    
    // Then analyze each symbol with its indicators and adaptive context
    const analysisPromises = symbols.map((symbol, i) =>
      limit(async () => {
        const rawResult = await analyzeSymbolForFilters(symbol, prices[i], allIndicators[i], allAdaptive[i]);
        const adaptiveMetrics = allAdaptive[i] ? await getSymbolLearningMetrics(symbol) : null;
        return applyAdaptivePostProcessing(rawResult, adaptiveMetrics);
      })
    );

    const results = await Promise.all(analysisPromises);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`[AI] ${symbols[i]}: ${result.filters.direction} (${(result.confidence * 100).toFixed(0)}%)${result.adaptiveNote ? ` [${result.adaptiveNote}]` : ''}`);
    }
    
    return results;
  } catch (error: any) {
    console.error("[AI] Batch analysis failed:", error.message);
    return {
      error: "AI_UNAVAILABLE",
      message: "AI analysis encountered an error. Please try again soon.",
    };
  }
}

// Helper to check if response is an error
export function isAIError(response: AIAnalysisResult | AIAnalysisResult[] | AIErrorResponse): response is AIErrorResponse {
  return "error" in response && response.error === "AI_UNAVAILABLE";
}
