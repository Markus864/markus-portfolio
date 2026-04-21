/**
 * AI Gateway - Centralized AI service for Iron Strike Trading
 * 
 * All OpenAI calls MUST route through this gateway.
 * Enforces Iron Strike Doctrine: calm authority, technical precision, zero hype.
 */

import OpenAI from "openai";
import { z } from "zod";
import { env } from "./config/env";

// ═══════════════════════════════════════════════════════════════
// OPENAI CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function createOpenAIClient(): OpenAI {
  if (env.ai.replitBaseUrl && env.ai.replitApiKey) {
    return new OpenAI({
      baseURL: env.ai.replitBaseUrl,
      apiKey: env.ai.replitApiKey,
    });
  }
  
  if (env.ai.openaiApiKey) {
    return new OpenAI({
      apiKey: env.ai.openaiApiKey,
    });
  }
  
  console.warn("[AI Gateway] No AI credentials configured");
  return new OpenAI({ apiKey: "dummy" });
}

const openai = createOpenAIClient();

// ═══════════════════════════════════════════════════════════════
// IRON STRIKE DOCTRINE - IMMUTABLE SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════

const IRON_STRIKE_DOCTRINE = `You are Iron Strike, an AI decision engine for options traders. You operate under strict doctrine:

VOICE & TONE:
- Calm authority. Technical precision. Zero hype.
- Never use exclamation marks, emojis, or enthusiasm.
- Never say "great opportunity", "perfect setup", "can't miss", or similar promotional language.
- State facts. Provide probabilities. Let data speak.

FORBIDDEN LANGUAGE (reject any response containing):
- "guaranteed", "sure thing", "easy money", "moon", "rocket", "explosive"
- "you should", "you must", "definitely", "absolutely"
- Price predictions with certainty ("will hit $X", "going to $X")
- Emotional appeals ("don't miss out", "act now", "FOMO")

REQUIRED ELEMENTS (every trading response must include):
- risk: Clear statement of what could go wrong
- invalidation: Specific price level or condition that negates the thesis
- next_actions: Concrete steps the trader should take

VERDICT LOGIC:
- Default to "NO_TRADE" when:
  * Data integrity is insufficient (missing indicators, stale data)
  * Conflicting signals with no clear resolution
  * Risk/reward ratio is unfavorable
  * Market conditions are unclear
- Only suggest a trade when evidence clearly supports it

RESPONSE FORMAT:
- Always respond in valid JSON matching the requested schema
- No markdown code blocks, no explanations outside the JSON
- If you cannot provide a valid response, return a NO_TRADE with explanation`;

// ═══════════════════════════════════════════════════════════════
// AI MODE SCHEMAS
// ═══════════════════════════════════════════════════════════════

export type AIMode = "signal_context" | "coach_review" | "explain";

// Schema for signal_context mode - used by Signal Generator
export const SignalContextSchema = z.object({
  verdict: z.enum(["BUY_CALL", "BUY_PUT", "SELL_CALL", "SELL_PUT", "NO_TRADE"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10).max(500),
  risk: z.string().min(10).max(300),
  invalidation: z.string().min(5).max(200),
  next_actions: z.array(z.string().min(5).max(100)).min(1).max(5),
  technical_summary: z.object({
    trend: z.enum(["bullish", "bearish", "neutral"]),
    momentum: z.enum(["strong", "moderate", "weak", "diverging"]),
    volatility: z.enum(["high", "normal", "low"]),
    support_level: z.number().optional(),
    resistance_level: z.number().optional(),
  }),
  position_guidance: z.object({
    suggested_expiration: z.enum(["0dte", "1w", "2w", "3w", "1m"]),
    suggested_moneyness: z.enum(["deep_itm", "itm", "atm", "slightly_otm", "far_otm"]),
    max_risk_percent: z.number().min(0.005).max(0.05),
  }),
});
export type SignalContextResponse = z.infer<typeof SignalContextSchema>;

// Schema for coach_review mode - used by Trade Journal AI Review
export const CoachReviewSchema = z.object({
  verdict: z.enum(["WELL_EXECUTED", "NEEDS_IMPROVEMENT", "REVIEW_REQUIRED"]),
  setup_score: z.number().min(0).max(100),
  risk_score: z.number().min(0).max(100),
  grade: z.enum(["A+", "A", "B+", "B", "C+", "C", "D", "F"]),
  summary: z.string().min(20).max(300),
  risk: z.string().min(10).max(200),
  invalidation: z.string().min(5).max(150),
  next_actions: z.array(z.string().min(5).max(100)).min(1).max(5),
  psychological_notes: z.array(z.string().max(100)).max(5),
  pattern_observations: z.array(z.string().max(100)).max(3),
});
export type CoachReviewResponse = z.infer<typeof CoachReviewSchema>;

// Schema for explain mode - used by AI Chatbot
export const ExplainSchema = z.object({
  answer: z.string().min(10).max(1000),
  confidence: z.number().min(0).max(1),
  risk: z.string().min(5).max(200),
  invalidation: z.string().optional(),
  next_actions: z.array(z.string().min(5).max(100)).min(1).max(5),
  sources: z.array(z.string().max(100)).max(3).optional(),
  disclaimer: z.string().max(200).optional(),
});
export type ExplainResponse = z.infer<typeof ExplainSchema>;

// Union type for all responses
export type AIGatewayResponse = SignalContextResponse | CoachReviewResponse | ExplainResponse;

// ═══════════════════════════════════════════════════════════════
// HYPE/PREDICTION LANGUAGE FILTER
// ═══════════════════════════════════════════════════════════════

const FORBIDDEN_PATTERNS = [
  /guaranteed/i,
  /sure thing/i,
  /easy money/i,
  /moon(ing)?/i,
  /rocket/i,
  /explosive/i,
  /can'?t miss/i,
  /perfect setup/i,
  /great opportunity/i,
  /don'?t miss out/i,
  /act now/i,
  /will hit \$?\d+/i,
  /going to \$?\d+/i,
  /definitely/i,
  /absolutely/i,
  /you should/i,
  /you must/i,
  /!!+/,
  /🚀|🌙|💰|💎|🔥/,
];

function containsForbiddenLanguage(text: string): { hasForbidden: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  return { hasForbidden: matches.length > 0, matches };
}

// ═══════════════════════════════════════════════════════════════
// MODE-SPECIFIC PROMPTS
// ═══════════════════════════════════════════════════════════════

const MODE_PROMPTS: Record<AIMode, string> = {
  signal_context: `Analyze the provided market data and technical indicators to generate a trading signal.

OUTPUT JSON SCHEMA:
{
  "verdict": "BUY_CALL" | "BUY_PUT" | "SELL_CALL" | "SELL_PUT" | "NO_TRADE",
  "confidence": 0.0 to 1.0,
  "reasoning": "Clear technical analysis supporting the verdict (max 500 chars)",
  "risk": "What could go wrong with this trade (max 300 chars)",
  "invalidation": "Specific price or condition that negates this thesis (max 200 chars)",
  "next_actions": ["Action 1", "Action 2", ...] (1-5 concrete steps),
  "technical_summary": {
    "trend": "bullish" | "bearish" | "neutral",
    "momentum": "strong" | "moderate" | "weak" | "diverging",
    "volatility": "high" | "normal" | "low",
    "support_level": number (optional),
    "resistance_level": number (optional)
  },
  "position_guidance": {
    "suggested_expiration": "0dte" | "1w" | "2w" | "3w" | "1m",
    "suggested_moneyness": "deep_itm" | "itm" | "atm" | "slightly_otm" | "far_otm",
    "max_risk_percent": 0.005 to 0.05
  }
}

Default to NO_TRADE if data is insufficient or signals conflict.`,

  coach_review: `Review the provided trade execution and journal data. Provide constructive coaching feedback.

OUTPUT JSON SCHEMA:
{
  "verdict": "WELL_EXECUTED" | "NEEDS_IMPROVEMENT" | "REVIEW_REQUIRED",
  "setup_score": 0 to 100,
  "risk_score": 0 to 100,
  "grade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "summary": "Concise assessment of the trade (max 300 chars)",
  "risk": "Key risk management observations (max 200 chars)",
  "invalidation": "What the trader should have watched for (max 150 chars)",
  "next_actions": ["Improvement 1", "Improvement 2", ...] (1-5 actionable steps),
  "psychological_notes": ["Note 1", ...] (max 5 observations about trader psychology),
  "pattern_observations": ["Pattern 1", ...] (max 3 recurring patterns identified)
}

Be honest but constructive. Focus on process, not outcome.`,

  explain: `Answer the user's question about trading, markets, or options. Provide clear, educational response.

OUTPUT JSON SCHEMA:
{
  "answer": "Clear explanation of the topic (max 1000 chars)",
  "confidence": 0.0 to 1.0 (how confident you are in this answer),
  "risk": "Key risks or caveats to consider (max 200 chars)",
  "invalidation": "When this information might not apply (optional)",
  "next_actions": ["Step 1", "Step 2", ...] (1-5 suggested next steps),
  "sources": ["Source 1", ...] (optional, max 3 references),
  "disclaimer": "Brief legal/educational disclaimer (optional, max 200 chars)"
}

Never give specific financial advice. Always remind users to do their own research.`,
};

// ═══════════════════════════════════════════════════════════════
// DEFAULT RESPONSES FOR VALIDATION FAILURES
// ═══════════════════════════════════════════════════════════════

function getDefaultNoTradeResponse(): SignalContextResponse {
  return {
    verdict: "NO_TRADE",
    confidence: 0,
    reasoning: "Unable to generate valid signal. Data integrity check failed or response validation failed.",
    risk: "All trading carries risk. This signal was not generated due to system validation failure.",
    invalidation: "N/A - No trade signal generated",
    next_actions: ["Wait for clearer market conditions", "Verify data sources are functioning", "Review technical setup manually"],
    technical_summary: {
      trend: "neutral",
      momentum: "weak",
      volatility: "normal",
    },
    position_guidance: {
      suggested_expiration: "2w",
      suggested_moneyness: "atm",
      max_risk_percent: 0.01,
    },
  };
}

function getDefaultCoachResponse(): CoachReviewResponse {
  return {
    verdict: "REVIEW_REQUIRED",
    setup_score: 50,
    risk_score: 50,
    grade: "C",
    summary: "Unable to generate AI review. Please review trade manually.",
    risk: "AI review unavailable. Manual review recommended.",
    invalidation: "Review your original trade thesis",
    next_actions: ["Review your trade journal manually", "Check your risk management rules", "Consider discussing with a mentor"],
    psychological_notes: [],
    pattern_observations: [],
  };
}

function getDefaultExplainResponse(): ExplainResponse {
  return {
    answer: "I apologize, but I was unable to generate a valid response to your question. Please try rephrasing or ask a more specific question.",
    confidence: 0,
    risk: "Response generation failed. Information may be incomplete.",
    next_actions: ["Try asking a more specific question", "Consult additional resources", "Consider speaking with a financial advisor"],
    disclaimer: "This is not financial advice. Always do your own research.",
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN GATEWAY FUNCTION
// ═══════════════════════════════════════════════════════════════

export interface AIGatewayOptions {
  mode: AIMode;
  userPrompt: string;
  contextData?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGatewayResult<T extends AIGatewayResponse> {
  success: boolean;
  data: T;
  rawResponse?: string;
  validationErrors?: string[];
  forbiddenLanguage?: string[];
}

export async function callAIGateway<T extends AIGatewayResponse>(
  options: AIGatewayOptions
): Promise<AIGatewayResult<T>> {
  const { mode, userPrompt, contextData, temperature = 0.3, maxTokens = 1500 } = options;

  const systemPrompt = `${IRON_STRIKE_DOCTRINE}\n\n${MODE_PROMPTS[mode]}`;
  
  const fullUserPrompt = contextData 
    ? `${contextData}\n\n${userPrompt}` 
    : userPrompt;

  try {
    console.log(`[AI Gateway] Calling mode: ${mode}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fullUserPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0]?.message?.content || "{}";
    console.log(`[AI Gateway] Raw response length: ${rawContent.length}`);

    // Check for forbidden language (skip for explain mode - more conversational)
    if (mode !== "explain") {
      const { hasForbidden, matches } = containsForbiddenLanguage(rawContent);
      if (hasForbidden) {
        console.warn(`[AI Gateway] Forbidden language detected: ${matches.join(", ")}`);
        return {
          success: false,
          data: getDefaultResponse(mode) as T,
          rawResponse: rawContent,
          forbiddenLanguage: matches,
        };
      }
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseError) {
      console.error(`[AI Gateway] JSON parse error:`, parseError);
      return {
        success: false,
        data: getDefaultResponse(mode) as T,
        rawResponse: rawContent,
        validationErrors: ["Invalid JSON response"],
      };
    }

    // Validate against schema
    const schema = getSchema(mode);
    const validation = schema.safeParse(parsed);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
      console.warn(`[AI Gateway] Schema validation failed:`, errors);
      
      // Try to salvage partial response
      const salvaged = salvagedResponse(mode, parsed as Record<string, unknown>);
      return {
        success: false,
        data: salvaged as T,
        rawResponse: rawContent,
        validationErrors: errors,
      };
    }

    // Check for required fields based on mode
    const data = validation.data as Record<string, unknown>;
    const missingFields: string[] = [];

    if (!data.risk || (typeof data.risk === "string" && data.risk.length < 5)) {
      missingFields.push("risk");
    }
    if (!data.next_actions || !Array.isArray(data.next_actions) || data.next_actions.length === 0) {
      missingFields.push("next_actions");
    }
    if (mode === "signal_context" && (!data.invalidation || (typeof data.invalidation === "string" && data.invalidation.length < 5))) {
      missingFields.push("invalidation");
    }

    if (missingFields.length > 0 && mode === "signal_context") {
      console.warn(`[AI Gateway] Missing required fields for integrity: ${missingFields.join(", ")}`);
      // For signal_context, default to NO_TRADE when integrity is insufficient
      const noTrade = getDefaultNoTradeResponse();
      noTrade.reasoning = `Signal rejected due to missing integrity fields: ${missingFields.join(", ")}`;
      return {
        success: false,
        data: noTrade as T,
        rawResponse: rawContent,
        validationErrors: missingFields.map(f => `Missing required field: ${f}`),
      };
    }

    console.log(`[AI Gateway] Success - mode: ${mode}`);
    return {
      success: true,
      data: validation.data as T,
      rawResponse: rawContent,
    };

  } catch (error: any) {
    console.error(`[AI Gateway] Error:`, error.message);
    return {
      success: false,
      data: getDefaultResponse(mode) as T,
      validationErrors: [error.message || "Unknown error"],
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getSchema(mode: AIMode): z.ZodSchema {
  switch (mode) {
    case "signal_context":
      return SignalContextSchema;
    case "coach_review":
      return CoachReviewSchema;
    case "explain":
      return ExplainSchema;
  }
}

function getDefaultResponse(mode: AIMode): AIGatewayResponse {
  switch (mode) {
    case "signal_context":
      return getDefaultNoTradeResponse();
    case "coach_review":
      return getDefaultCoachResponse();
    case "explain":
      return getDefaultExplainResponse();
  }
}

function salvagedResponse(mode: AIMode, partial: Record<string, unknown>): AIGatewayResponse {
  const defaultResp = getDefaultResponse(mode);
  
  // For explain mode, try to extract answer from various JSON structures
  if (mode === "explain") {
    let extractedAnswer = "";
    
    // Check for common response patterns
    if (typeof partial.response === "string" && partial.response.length > 10) {
      extractedAnswer = partial.response;
    } else if (typeof partial.answer === "string" && partial.answer.length > 10) {
      extractedAnswer = partial.answer;
    } else if (typeof partial.text === "string" && partial.text.length > 10) {
      extractedAnswer = partial.text;
    } else if (typeof partial.message === "string" && partial.message.length > 10) {
      extractedAnswer = partial.message;
    } else if (typeof partial.content === "string" && partial.content.length > 10) {
      extractedAnswer = partial.content;
    } else {
      // Try to convert any object to a readable string
      const keys = Object.keys(partial).filter(k => !["confidence", "risk", "sources"].includes(k));
      if (keys.length > 0) {
        extractedAnswer = keys
          .map(k => {
            const v = partial[k];
            if (typeof v === "string") return v;
            if (typeof v === "object" && v !== null) {
              return Object.entries(v as Record<string, unknown>)
                .map(([subK, subV]) => `${subK}: ${subV}`)
                .join(". ");
            }
            return String(v);
          })
          .filter(s => s.length > 0)
          .join("\n\n");
      }
    }
    
    if (extractedAnswer.length > 0) {
      return {
        answer: extractedAnswer,
        confidence: typeof partial.confidence === "number" ? partial.confidence : 0.7,
        risk: typeof partial.risk === "string" ? partial.risk : "Consider multiple perspectives and verify with additional sources.",
        next_actions: Array.isArray(partial.next_actions) 
          ? partial.next_actions.filter(a => typeof a === "string").slice(0, 5) as string[]
          : ["Review this information carefully", "Consider consulting additional resources"],
        disclaimer: "This is educational information, not financial advice.",
      } as ExplainResponse;
    }
  }
  
  // Try to merge valid fields from partial response
  const merged = { ...defaultResp };
  
  for (const key of Object.keys(defaultResp)) {
    if (partial[key] !== undefined && partial[key] !== null) {
      let value = partial[key];
      
      // Special handling for 'answer' field in explain mode - convert objects to formatted strings
      if (key === "answer" && mode === "explain" && typeof value === "object" && value !== null) {
        // Convert object response to a formatted string
        try {
          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length > 0) {
            value = entries
              .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
              .join("\n");
          } else {
            value = (defaultResp as ExplainResponse).answer;
          }
        } catch {
          value = (defaultResp as ExplainResponse).answer;
        }
      }
      
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  
  return merged;
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS FOR EACH MODE
// ═══════════════════════════════════════════════════════════════

export async function generateSignalContext(
  marketData: string,
  symbol: string
): Promise<AIGatewayResult<SignalContextResponse>> {
  return callAIGateway<SignalContextResponse>({
    mode: "signal_context",
    userPrompt: `Analyze ${symbol} and provide a trading signal.`,
    contextData: marketData,
    temperature: 0.2,
    maxTokens: 1200,
  });
}

export async function generateCoachReview(
  tradeData: string
): Promise<AIGatewayResult<CoachReviewResponse>> {
  return callAIGateway<CoachReviewResponse>({
    mode: "coach_review",
    userPrompt: "Review this trade and provide coaching feedback.",
    contextData: tradeData,
    temperature: 0.5,
    maxTokens: 1000,
  });
}

export async function generateExplanation(
  question: string,
  context?: string
): Promise<AIGatewayResult<ExplainResponse>> {
  return callAIGateway<ExplainResponse>({
    mode: "explain",
    userPrompt: question,
    contextData: context,
    temperature: 0.4,
    maxTokens: 1200,
  });
}

// ═══════════════════════════════════════════════════════════════
// RAW SIGNAL GENERATION (Used by ai-service.ts for complex prompts)
// ═══════════════════════════════════════════════════════════════

export const RawSignalSchema = z.object({
  direction: z.enum(["BUY_CALL", "BUY_PUT", "NO_TRADE"]),
  preferredExpirationWindow: z.enum(["0dte", "1w", "2w", "3w", "1m"]),
  preferredMoneyness: z.enum(["deep_itm", "itm", "atm", "slightly_otm", "far_otm"]),
  targetDeltaRange: z.tuple([z.number(), z.number()]),
  riskPercent: z.number().min(0.005).max(0.10),
  confidence: z.number().min(0).max(1),
  stopLossPrice: z.number().optional(),
  takeProfitPrice: z.number().optional(),
  reasoning: z.string().min(5).max(500),
  patternAnalysis: z.string().min(10).max(2000),
});
export type RawSignalResponse = z.infer<typeof RawSignalSchema>;

const IRON_STRIKE_SIGNAL_DOCTRINE = `CRITICAL CONSTRAINTS - Your response MUST comply:

1. NEVER use hype language: "guaranteed", "sure thing", "easy money", "moon", "rocket", "explosive"
2. NEVER make predictions with certainty: "will hit $X", "going to $X"
3. NEVER use emotional appeals: "don't miss out", "act now"
4. ALWAYS base analysis on the technical data provided
5. ALWAYS provide reasoning that explains the technical basis
6. Default to NO_TRADE when:
   - Data is insufficient or stale
   - Signals conflict with no resolution
   - Confidence would be below 0.40
`;

export interface RawSignalResult {
  success: boolean;
  data: RawSignalResponse;
  rawResponse?: string;
  validationErrors?: string[];
  forbiddenLanguage?: string[];
}

export async function generateRawSignal(
  fullPrompt: string,
  model: string = "gpt-4o",
  maxTokens: number = 4096
): Promise<RawSignalResult> {
  const enhancedPrompt = `${IRON_STRIKE_SIGNAL_DOCTRINE}\n\n${fullPrompt}`;
  
  try {
    console.log(`[AI Gateway] Raw signal generation with model: ${model}`);
    
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: enhancedPrompt }],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content || "{}";
    console.log(`[AI Gateway] Raw signal response length: ${rawContent.length}`);

    // Check for forbidden language
    const { hasForbidden, matches } = containsForbiddenLanguage(rawContent);
    if (hasForbidden) {
      console.warn(`[AI Gateway] Forbidden language in signal: ${matches.join(", ")}`);
      return {
        success: false,
        data: getDefaultRawNoTrade("Signal rejected: contains forbidden hype language"),
        rawResponse: rawContent,
        forbiddenLanguage: matches,
      };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseError) {
      console.error(`[AI Gateway] JSON parse error in signal:`, parseError);
      return {
        success: false,
        data: getDefaultRawNoTrade("Invalid JSON response from AI"),
        rawResponse: rawContent,
        validationErrors: ["Invalid JSON response"],
      };
    }

    // Validate against schema
    const validation = RawSignalSchema.safeParse(parsed);

    if (!validation.success) {
      const errors = validation.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
      console.warn(`[AI Gateway] Signal schema validation failed:`, errors);
      
      // Try to salvage with defaults - if we have a valid direction, consider it a success
      const salvaged = salvageRawSignal(parsed as Record<string, unknown>);
      const partialData = parsed as Record<string, unknown>;
      const hasValidDirection = ["BUY_CALL", "BUY_PUT", "NO_TRADE"].includes(partialData.direction as string);
      
      // If direction is valid, treat as success with salvaged data
      if (hasValidDirection) {
        console.log(`[AI Gateway] Salvaged signal with direction: ${salvaged.direction}`);
        return {
          success: true,
          data: salvaged,
          rawResponse: rawContent,
        };
      }
      
      return {
        success: false,
        data: salvaged,
        rawResponse: rawContent,
        validationErrors: errors,
      };
    }

    console.log(`[AI Gateway] Raw signal success: ${validation.data.direction}`);
    return {
      success: true,
      data: validation.data,
      rawResponse: rawContent,
    };

  } catch (error: any) {
    console.error(`[AI Gateway] Raw signal error:`, error.message);
    return {
      success: false,
      data: getDefaultRawNoTrade(`AI error: ${error.message}`),
      validationErrors: [error.message || "Unknown error"],
    };
  }
}

function getDefaultRawNoTrade(reason: string): RawSignalResponse {
  return {
    direction: "NO_TRADE",
    preferredExpirationWindow: "2w",
    preferredMoneyness: "atm",
    targetDeltaRange: [0.30, 0.50],
    riskPercent: 0.02,
    confidence: 0,
    reasoning: reason,
    patternAnalysis: "Analysis unavailable due to system error. Please retry.",
  };
}

function salvageRawSignal(partial: Record<string, unknown>): RawSignalResponse {
  const defaultResp = getDefaultRawNoTrade("Partial response salvaged");
  
  return {
    direction: (["BUY_CALL", "BUY_PUT", "NO_TRADE"].includes(partial.direction as string) 
      ? partial.direction : defaultResp.direction) as "BUY_CALL" | "BUY_PUT" | "NO_TRADE",
    preferredExpirationWindow: (["0dte", "1w", "2w", "3w", "1m"].includes(partial.preferredExpirationWindow as string)
      ? partial.preferredExpirationWindow : defaultResp.preferredExpirationWindow) as "0dte" | "1w" | "2w" | "3w" | "1m",
    preferredMoneyness: (["deep_itm", "itm", "atm", "slightly_otm", "far_otm"].includes(partial.preferredMoneyness as string)
      ? partial.preferredMoneyness : defaultResp.preferredMoneyness) as "deep_itm" | "itm" | "atm" | "slightly_otm" | "far_otm",
    targetDeltaRange: Array.isArray(partial.targetDeltaRange) && partial.targetDeltaRange.length === 2
      ? [Number(partial.targetDeltaRange[0]) || 0.30, Number(partial.targetDeltaRange[1]) || 0.50]
      : defaultResp.targetDeltaRange,
    riskPercent: typeof partial.riskPercent === "number" 
      ? Math.max(0.005, Math.min(0.10, partial.riskPercent)) : defaultResp.riskPercent,
    confidence: typeof partial.confidence === "number" 
      ? Math.max(0, Math.min(1, partial.confidence)) : defaultResp.confidence,
    stopLossPrice: typeof partial.stopLossPrice === "number" ? partial.stopLossPrice : undefined,
    takeProfitPrice: typeof partial.takeProfitPrice === "number" ? partial.takeProfitPrice : undefined,
    reasoning: typeof partial.reasoning === "string" && partial.reasoning.length > 0
      ? partial.reasoning : defaultResp.reasoning,
    patternAnalysis: typeof partial.patternAnalysis === "string" && partial.patternAnalysis.length > 0
      ? partial.patternAnalysis : defaultResp.patternAnalysis,
  };
}

// ═══════════════════════════════════════════════════════════════
// VISION API (Screenshot parsing - special case, not routed through main gateway)
// ═══════════════════════════════════════════════════════════════

export const VisionParseSchema = z.object({
  symbol: z.string().max(10),
  side: z.enum(["LONG_CALL", "LONG_PUT", "SHORT_CALL", "SHORT_PUT", "LONG_STOCK", "SHORT_STOCK"]),
  positionType: z.enum(["options", "equity"]),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  contracts: z.number().int().positive(),
  multiplier: z.number().default(100),
  fees: z.number().nullable(),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
  strikePrice: z.number().nullable(),
  expirationDate: z.string().nullable(),
  notes: z.string().max(500),
  parseConfidence: z.number().min(0).max(1),
});
export type VisionParseResponse = z.infer<typeof VisionParseSchema>;

export async function parseScreenshotWithVision(
  base64Image: string,
  mimeType: string,
  symbolHint?: string,
  model: string = "gpt-4o"
): Promise<{ success: boolean; data: VisionParseResponse | null; error?: string }> {
  const prompt = `Analyze this trading screenshot and extract trade details.
Return ONLY a valid JSON object with this exact schema (no markdown, no explanation):
{
  "symbol": "TICKER",
  "side": "LONG_CALL" | "LONG_PUT" | "SHORT_CALL" | "SHORT_PUT" | "LONG_STOCK" | "SHORT_STOCK",
  "positionType": "options" | "equity",
  "entryPrice": number,
  "exitPrice": number | null,
  "contracts": number,
  "multiplier": 100,
  "fees": number | null,
  "openTime": "ISO8601 timestamp" | null,
  "closeTime": "ISO8601 timestamp" | null,
  "strikePrice": number | null,
  "expirationDate": "YYYY-MM-DD" | null,
  "notes": "any additional context from the screenshot",
  "parseConfidence": 0.0 to 1.0 (how confident you are in the extraction)
}

If the trade appears to be closed (has both entry and exit), set both prices.
If only entry is visible, set exitPrice to null.
Parse numbers without currency symbols or commas.
Set parseConfidence between 0.0 and 1.0 based on how clearly you could read the data.
${symbolHint ? `Hint: The symbol might be ${symbolHint}` : ""}`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: model === "gpt-4o" ? "high" : "low",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || "{}";
    
    // Clean potential markdown wrapping
    const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const parsed = JSON.parse(cleanContent);
    const validation = VisionParseSchema.safeParse(parsed);

    if (!validation.success) {
      return {
        success: false,
        data: null,
        error: validation.error.errors.map(e => e.message).join(", "),
      };
    }

    return { success: true, data: validation.data };
  } catch (error: any) {
    console.error("[AI Gateway Vision] Error:", error.message);
    return { success: false, data: null, error: error.message };
  }
}

// Export check function for external use
export { containsForbiddenLanguage };
