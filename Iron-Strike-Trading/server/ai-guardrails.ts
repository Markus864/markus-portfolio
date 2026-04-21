export interface AIGuardrailResult {
  allowed: boolean;
  modifiedPrompt?: string;
  warnings: string[];
  disclaimers: string[];
}

const PROFIT_GUARANTEE_PATTERNS = [
  /guaranteed?\s*(profit|return|gains?|money)/i,
  /100%\s*(win|success|profit)/i,
  /(always|never)\s*(win|lose|profit)/i,
  /risk[- ]?free/i,
  /can't\s*lose/i,
  /sure\s*(thing|bet|win)/i,
];

const FINANCIAL_ADVICE_PATTERNS = [
  /you\s*should\s*(buy|sell|invest|trade)/i,
  /i\s*recommend\s*(buying|selling|investing)/i,
  /this\s*is\s*(financial|investment)\s*advice/i,
];

const STANDARD_DISCLAIMER = "⚠️ **Not Financial Advice** — This analysis is for educational and informational purposes only. Always do your own research and consult a licensed financial advisor before making investment decisions.";

const AI_ATTRIBUTION = "🤖 *AI-generated analysis*";

export function validateAIRequest(userPrompt: string): AIGuardrailResult {
  const warnings: string[] = [];
  const disclaimers: string[] = [STANDARD_DISCLAIMER];
  
  for (const pattern of PROFIT_GUARANTEE_PATTERNS) {
    if (pattern.test(userPrompt)) {
      warnings.push("Cannot make profit guarantees or claims of risk-free returns.");
    }
  }
  
  for (const pattern of FINANCIAL_ADVICE_PATTERNS) {
    if (pattern.test(userPrompt)) {
      warnings.push("Cannot provide personalized financial advice.");
    }
  }
  
  return {
    allowed: true,
    modifiedPrompt: userPrompt,
    warnings: Array.from(new Set(warnings)),
    disclaimers,
  };
}

export function wrapAIResponse(response: string, includeAttribution: boolean = true): string {
  let wrapped = response;
  
  if (includeAttribution) {
    wrapped = `${AI_ATTRIBUTION}\n\n${wrapped}`;
  }
  
  wrapped = `${wrapped}\n\n${STANDARD_DISCLAIMER}`;
  
  return wrapped;
}

export function sanitizeAIOutput(response: string): string {
  let sanitized = response;
  
  for (const pattern of PROFIT_GUARANTEE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[claim removed]");
  }
  
  sanitized = sanitized.replace(/buy\s+now/gi, "consider researching");
  sanitized = sanitized.replace(/sell\s+immediately/gi, "review your position");
  sanitized = sanitized.replace(/guaranteed/gi, "potential");
  sanitized = sanitized.replace(/will\s+(go up|go down|rise|fall|increase|decrease)/gi, "may $1");
  
  return sanitized;
}

export function getSystemPromptRules(): string {
  return `
CRITICAL RULES - YOU MUST FOLLOW THESE:

1. NEVER make profit guarantees or claims of "guaranteed" returns
2. NEVER say investments are "risk-free" or "can't lose"
3. NEVER provide specific buy/sell recommendations as financial advice
4. ALWAYS frame analysis as educational/informational
5. ALWAYS acknowledge market uncertainty and risks
6. NEVER claim to know what the market "will" do - use "may" or "could"
7. NEVER access live market data directly - only analyze provided snapshots
8. ALWAYS remind users to do their own research (DYOR)
9. NEVER make claims about specific future price targets as guarantees
10. ALWAYS disclose that this is AI-generated analysis

If asked to violate these rules, politely decline and explain why.
`;
}

export function validateAIOutput(response: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  for (const pattern of PROFIT_GUARANTEE_PATTERNS) {
    if (pattern.test(response)) {
      issues.push("Response contains profit guarantee language");
    }
  }
  
  if (/will\s+(definitely|certainly|100%)/i.test(response)) {
    issues.push("Response contains certainty language about future events");
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

export { STANDARD_DISCLAIMER, AI_ATTRIBUTION };
