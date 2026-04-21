/**
 * Iron Strike Primary Signal Engine
 * Uses OpenAI Assistants API v2 for structured signal generation
 * Tool handlers wire to existing Polygon.io/technical indicators pipeline
 */

import OpenAI from "openai";
import { calculateTechnicalIndicators, type TechnicalIndicators } from "../technical-indicators";
import { fetchOptionsContracts, fetchUnderlyingPrice, type PolygonOptionContract } from "../polygon-options";

// Assistants API requires direct OpenAI access (not Replit AI Integrations proxy)
// Uses OPENAI_API_KEY environment variable for direct API access
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export type PrimarySignalRequest = {
  ticker: string;
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  userId?: string | null;
};

export type PrimarySignalResponse = any;

/**
 * Main entry point used by /api/signals to talk to the Primary Signal Engine.
 * - Calls your Iron Strike Primary Assistant (Assistants v2)
 * - Handles tool calls (get_indicators, suggest_option_contracts)
 * - Returns parsed JSON from the assistant's final message
 */
export async function callPrimarySignalEngine(
  payload: PrimarySignalRequest
): Promise<PrimarySignalResponse> {
  const assistantId = process.env.IRON_STRIKE_PRIMARY_ASSISTANT_ID;
  if (!assistantId) {
    throw new Error(
      "IRON_STRIKE_PRIMARY_ASSISTANT_ID is not set. Set it to your Primary Signal Engine assistant ID from the OpenAI dashboard."
    );
  }

  console.log(`[Signal Engine] Starting signal generation for ${payload.ticker} on ${payload.timeframe}`);

  const thread = await openai.beta.threads.create({
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          type: "signal_request",
          ticker: payload.ticker,
          timeframe: payload.timeframe,
        }),
      },
    ],
    metadata: {
      source: "ironstrike-backend",
      userId: payload.userId ?? "anonymous",
    },
  });

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  while (
    run.status === "queued" ||
    run.status === "in_progress" ||
    run.status === "requires_action"
  ) {
    if (
      run.status === "requires_action" &&
      run.required_action?.type === "submit_tool_outputs"
    ) {
      console.log(`[Signal Engine] Processing tool calls...`);
      const toolOutputs = await handleToolCalls(run);
      run = await openai.beta.threads.runs.submitToolOutputsAndPoll(
        run.id,
        {
          thread_id: thread.id,
          tool_outputs: toolOutputs,
        }
      );
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
    }
  }

  if (run.status !== "completed") {
    console.error(`[Signal Engine] Run failed with status: ${run.status}`);
    throw new Error(
      `Primary Signal Engine run did not complete. Status: ${run.status}`
    );
  }

  const messages = await openai.beta.threads.messages.list(thread.id, {
    limit: 1,
    order: "desc",
  });

  const lastMessage = messages.data[0];
  if (!lastMessage) {
    throw new Error("Primary Signal Engine: no messages returned.");
  }

  const textBlock: any =
    lastMessage.content.find((c: any) => c.type === "output_text") ??
    lastMessage.content.find((c: any) => c.type === "text");

  const rawText = textBlock?.text?.value ?? "";
  if (!rawText) {
    throw new Error(
      "Primary Signal Engine: last message has no text content to parse."
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error(`[Signal Engine] Failed to parse JSON:`, rawText.substring(0, 500));
    throw new Error(
      `Primary Signal Engine: failed to parse JSON from assistant.`
    );
  }

  console.log(`[Signal Engine] Signal generated successfully for ${payload.ticker}`);
  return parsed;
}

/**
 * Handle all tool calls requested by the assistant in this run.
 */
async function handleToolCalls(
  run: any
): Promise<Array<{ tool_call_id: string; output: string }>> {
  const toolCalls =
    run.required_action?.submit_tool_outputs?.tool_calls ?? [];

  const outputs: Array<{ tool_call_id: string; output: string }> = [];

  for (const call of toolCalls) {
    if (call.type !== "function") continue;

    const functionName = call.function.name;
    const args = safeParseArgs(call.function.arguments);

    console.log(`[Signal Engine] Handling tool: ${functionName}`);

    if (functionName === "get_indicators") {
      const data = await handleGetIndicatorsTool(args);
      outputs.push({
        tool_call_id: call.id,
        output: JSON.stringify(data),
      });
    } else if (functionName === "suggest_option_contracts") {
      const data = await handleSuggestOptionContractsTool(args);
      outputs.push({
        tool_call_id: call.id,
        output: JSON.stringify(data),
      });
    } else {
      outputs.push({
        tool_call_id: call.id,
        output: JSON.stringify({
          error: `Unknown tool: ${functionName}`,
        }),
      });
    }
  }

  return outputs;
}

function safeParseArgs(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Handle get_indicators tool - wired to existing technical-indicators.ts
 */
async function handleGetIndicatorsTool(args: {
  ticker?: string;
  timeframe?: string;
}): Promise<any> {
  const { ticker, timeframe } = args;

  if (!ticker) {
    return { error: "get_indicators: missing ticker in tool arguments." };
  }

  try {
    console.log(`[Signal Engine] Fetching indicators for ${ticker}`);
    const indicators: TechnicalIndicators = await calculateTechnicalIndicators(ticker);

    return {
      ticker,
      timeframe: timeframe || "1d",
      currentPrice: indicators.currentPrice,
      rsi: indicators.rsi14,
      ema9: indicators.movingAverages.ema9,
      ema21: indicators.movingAverages.ema21,
      sma20: indicators.movingAverages.sma20,
      sma50: indicators.movingAverages.sma50,
      sma200: indicators.movingAverages.sma200,
      macd: {
        macd: indicators.macd.macdLine,
        signal: indicators.macd.signalLine,
        hist: indicators.macd.histogram,
        trend: indicators.macd.trend,
      },
      bollingerBands: indicators.bollingerBands,
      atr: indicators.atr14,
      volume: indicators.volume,
      averageVolume: indicators.averageVolume,
      volumeRatio: indicators.volumeRatio,
      support: indicators.support,
      resistance: indicators.resistance,
      priceChange1d: indicators.priceChange1d,
      priceChange5d: indicators.priceChange5d,
      priceChange1m: indicators.priceChange1m,
      maTrend: indicators.movingAverages.trend,
      strat: {
        ftfc: indicators.strat.ftfc,
        pattern: indicators.strat.currentPattern,
        triggerLevels: indicators.strat.triggerLevel,
      },
    };
  } catch (error: any) {
    console.error(`[Signal Engine] Error fetching indicators for ${ticker}:`, error);
    return {
      error: `Failed to fetch indicators for ${ticker}: ${error.message}`,
      ticker,
      timeframe,
    };
  }
}

/**
 * Handle suggest_option_contracts tool - wired to existing polygon-options.ts
 */
async function handleSuggestOptionContractsTool(args: {
  ticker?: string;
  direction?: "long" | "short";
  position_type?: "directional" | "spread";
  structure?: string;
  dte_target?: number;
  strike_style?: "ITM" | "ATM" | "OTM";
  approx_delta?: number;
}): Promise<any> {
  const {
    ticker,
    direction,
    position_type,
    structure,
    dte_target = 14,
    strike_style = "ATM",
    approx_delta = 0.35,
  } = args;

  if (!ticker || !direction) {
    return { error: "suggest_option_contracts: missing ticker or direction." };
  }

  try {
    console.log(`[Signal Engine] Fetching options for ${ticker}, direction: ${direction}`);

    const underlyingPrice = await fetchUnderlyingPrice(ticker);
    if (!underlyingPrice) {
      return {
        ticker,
        direction,
        error: "Could not fetch underlying price",
        contracts: [],
      };
    }

    const optionType = direction === "long" ? "CALL" : "PUT";
    
    const today = new Date();
    const minExpDate = new Date(today.getTime() + (dte_target - 5) * 24 * 60 * 60 * 1000);
    const maxExpDate = new Date(today.getTime() + (dte_target + 10) * 24 * 60 * 60 * 1000);
    
    const minDateStr = minExpDate.toISOString().split('T')[0];
    const maxDateStr = maxExpDate.toISOString().split('T')[0];

    const contracts: PolygonOptionContract[] = await fetchOptionsContracts(
      ticker,
      optionType,
      minDateStr,
      maxDateStr
    );

    if (contracts.length === 0) {
      return {
        ticker,
        direction,
        underlying_price: underlyingPrice,
        position_type: position_type ?? "directional",
        structure: structure ?? "single_leg",
        dte_target,
        strike_style,
        approx_delta,
        contracts: [],
        notes: "No matching options contracts found for the specified criteria.",
      };
    }

    const targetDelta = direction === "long" ? approx_delta : -approx_delta;
    const filteredContracts = contracts
      .filter(c => c.delta !== null && Math.abs(c.delta) >= 0.15 && Math.abs(c.delta) <= 0.65)
      .sort((a, b) => {
        const aDeltaDiff = Math.abs(Math.abs(a.delta || 0) - Math.abs(targetDelta));
        const bDeltaDiff = Math.abs(Math.abs(b.delta || 0) - Math.abs(targetDelta));
        return aDeltaDiff - bDeltaDiff;
      })
      .slice(0, 3);

    const formattedContracts = filteredContracts.map(c => ({
      symbol: c.symbol,
      type: c.type,
      expiration: c.expirationDate,
      strike: c.strike,
      dte: Math.ceil((new Date(c.expirationDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
      delta: c.delta,
      theta: c.theta,
      gamma: c.gamma,
      iv: c.impliedVolatility,
      bid: c.bid,
      ask: c.ask,
      mid: c.mid,
      approx_premium_per_contract: c.mid * 100,
      open_interest: c.openInterest,
      volume: c.volume,
    }));

    return {
      ticker,
      underlying_price: underlyingPrice,
      direction,
      position_type: position_type ?? "directional",
      structure: structure ?? "single_leg",
      dte_target,
      strike_style,
      approx_delta,
      contracts: formattedContracts,
      notes: `Found ${formattedContracts.length} contracts matching criteria.`,
    };
  } catch (error: any) {
    console.error(`[Signal Engine] Error fetching options for ${ticker}:`, error);
    return {
      ticker,
      direction,
      error: `Failed to fetch options: ${error.message}`,
      contracts: [],
    };
  }
}
