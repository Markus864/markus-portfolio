/**
 * Iron Strike Unified Assistants Module
 * Provides a single interface for all OpenAI Assistants:
 * - Primary Signal Engine: Trading signal generation
 * - Iron Strike Coach: Educational Q&A
 * - Iron Strike Explain: Signal explanation
 * - Iron Strike Backtest: Historical analysis
 */

import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

export type AssistantType = "signal" | "coach" | "explain" | "backtest";

interface AssistantConfig {
  envVar: string;
  name: string;
  description: string;
}

const ASSISTANT_CONFIGS: Record<AssistantType, AssistantConfig> = {
  signal: {
    envVar: "IRON_STRIKE_PRIMARY_ASSISTANT_ID",
    name: "Primary Signal Engine",
    description: "Generates trading signals with technical analysis",
  },
  coach: {
    envVar: "IRON_STRIKE_COACH_ASSISTANT_ID",
    name: "Iron Strike Coach",
    description: "Educational Q&A about Iron Strike and options trading",
  },
  explain: {
    envVar: "IRON_STRIKE_EXPLAIN_ASSISTANT_ID",
    name: "Iron Strike Explain",
    description: "Translates signals into plain language explanations",
  },
  backtest: {
    envVar: "IRON_STRIKE_BACKTEST_ASSISTANT_ID",
    name: "Iron Strike Backtest",
    description: "Analyzes historical data for performance metrics",
  },
};

function getAssistantId(type: AssistantType): string {
  const config = ASSISTANT_CONFIGS[type];
  const id = process.env[config.envVar];
  if (!id) {
    throw new Error(
      `${config.envVar} is not set. Set it to your ${config.name} assistant ID from the OpenAI dashboard.`
    );
  }
  return id;
}

export interface AssistantResponse {
  content: string;
  threadId: string;
  runId: string;
}

/**
 * Call an Iron Strike assistant with a message.
 * Returns the assistant's text response.
 * 
 * @param type - Which assistant to call
 * @param message - User message to send
 * @param threadId - Optional existing thread ID for conversation continuity
 * @param metadata - Optional metadata for the thread
 */
export async function callAssistant(
  type: AssistantType,
  message: string,
  threadId?: string,
  metadata?: Record<string, string>
): Promise<AssistantResponse> {
  const assistantId = getAssistantId(type);
  const config = ASSISTANT_CONFIGS[type];

  console.log(`[Assistants] Calling ${config.name}...`);

  let thread: OpenAI.Beta.Threads.Thread;

  if (threadId) {
    thread = await openai.beta.threads.retrieve(threadId);
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });
  } else {
    thread = await openai.beta.threads.create({
      messages: [{ role: "user", content: message }],
      metadata: {
        source: "ironstrike-backend",
        assistantType: type,
        ...metadata,
      },
    });
  }

  let run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
  });

  const MAX_POLL_ATTEMPTS = 60;
  let pollCount = 0;

  while (
    run.status === "queued" ||
    run.status === "in_progress" ||
    run.status === "requires_action"
  ) {
    if (pollCount++ >= MAX_POLL_ATTEMPTS) {
      console.error(`[Assistants] ${config.name} timed out after ${MAX_POLL_ATTEMPTS} seconds`);
      throw new Error(`${config.name} timed out waiting for response`);
    }

    if (
      run.status === "requires_action" &&
      run.required_action?.type === "submit_tool_outputs"
    ) {
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      console.warn(
        `[Assistants] ${config.name} unexpectedly requested tools: ${toolCalls.map(t => t.function?.name).join(", ")}. ` +
        `Coach/Explain/Backtest assistants should not require tools. Submitting fallback.`
      );
      const toolOutputs = toolCalls.map((call) => ({
        tool_call_id: call.id,
        output: JSON.stringify({ 
          error: "This assistant does not support tool calls. Please provide a direct response." 
        }),
      }));
      run = await openai.beta.threads.runs.submitToolOutputsAndPoll(run.id, {
        thread_id: thread.id,
        tool_outputs: toolOutputs,
      });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
    }
  }

  if (run.status !== "completed") {
    console.error(`[Assistants] ${config.name} run failed with status: ${run.status}`);
    throw new Error(`${config.name} run did not complete. Status: ${run.status}`);
  }

  const messages = await openai.beta.threads.messages.list(thread.id, {
    limit: 1,
    order: "desc",
  });

  const lastMessage = messages.data[0];
  if (!lastMessage) {
    throw new Error(`${config.name}: no messages returned.`);
  }

  const textBlock: any =
    lastMessage.content.find((c: any) => c.type === "output_text") ??
    lastMessage.content.find((c: any) => c.type === "text");

  const content = textBlock?.text?.value ?? "";
  if (!content) {
    throw new Error(`${config.name}: last message has no text content.`);
  }

  console.log(`[Assistants] ${config.name} responded successfully`);

  return {
    content,
    threadId: thread.id,
    runId: run.id,
  };
}

/**
 * Call the Coach assistant for educational Q&A
 */
export async function askCoach(
  question: string,
  metadata?: Record<string, string>
): Promise<string> {
  const response = await callAssistant("coach", question, undefined, metadata);
  return response.content;
}

/**
 * Call the Explain assistant to translate a signal into plain language
 */
export async function explainSignal(
  signalJson: string | object,
  metadata?: Record<string, string>
): Promise<string> {
  const message =
    typeof signalJson === "string"
      ? signalJson
      : JSON.stringify(signalJson, null, 2);
  const response = await callAssistant("explain", message, undefined, metadata);
  return response.content;
}

/**
 * Call the Backtest assistant for historical analysis
 */
export async function runBacktest(
  request: {
    ticker: string;
    timeframe?: string;
    startDate?: string;
    endDate?: string;
    strategy?: string;
  },
  metadata?: Record<string, string>
): Promise<string> {
  const message = JSON.stringify({
    type: "backtest_request",
    ...request,
  });
  const response = await callAssistant("backtest", message, undefined, metadata);
  return response.content;
}

/**
 * Check if all assistant IDs are configured
 */
export function checkAssistantConfig(): {
  configured: AssistantType[];
  missing: AssistantType[];
} {
  const configured: AssistantType[] = [];
  const missing: AssistantType[] = [];

  for (const [type, config] of Object.entries(ASSISTANT_CONFIGS)) {
    if (process.env[config.envVar]) {
      configured.push(type as AssistantType);
    } else {
      missing.push(type as AssistantType);
    }
  }

  return { configured, missing };
}
