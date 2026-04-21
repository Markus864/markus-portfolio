function must(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} must be set`);
  }
  return value;
}

function optional(name: string, defaultValue: string = ""): string {
  return process.env[name] || defaultValue;
}

function optionalInt(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value ? parseInt(value, 10) : defaultValue;
}

function optionalBool(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  isProduction: optional("NODE_ENV", "development") === "production",
  isDevelopment: optional("NODE_ENV", "development") === "development",
  port: optionalInt("PORT", 5000),
  
  devAuth: {
    bypassEnabled: optionalBool("DEV_AUTH_BYPASS", false),
    testUserEmail: optional("DEV_AUTH_TEST_EMAIL", ""), // Required when bypass enabled
    testUserPassword: optional("DEV_AUTH_TEST_PASSWORD", ""), // Required when bypass enabled
  },

  database: {
    url: must("DATABASE_URL"),
  },

  session: {
    secret: optional("SESSION_SECRET", "dev-session-secret-change-in-production"),
  },

  clerk: {
    publishableKey: optional("CLERK_PUBLISHABLE_KEY", ""),
    secretKey: optional("CLERK_SECRET_KEY", ""),
  },

  stripe: {
    secretKey: optional("STRIPE_SECRET_KEY", ""),
    // Legacy single price IDs (for backwards compatibility)
    pricePro: optional("STRIPE_PRICE_PRO", ""),
    pricePremium: optional("STRIPE_PRICE_PREMIUM", ""),
    // New price IDs with interval support
    priceProMonthly: optional("STRIPE_PRICE_PRO_MONTHLY", ""),
    priceProYearly: optional("STRIPE_PRICE_PRO_YEARLY", ""),
    pricePremiumMonthly: optional("STRIPE_PRICE_PREMIUM_MONTHLY", ""),
    pricePremiumYearly: optional("STRIPE_PRICE_PREMIUM_YEARLY", ""),
    webhookSecret: optional("STRIPE_WEBHOOK_SECRET", ""),
    portalReturnUrl: optional("STRIPE_PORTAL_RETURN_URL", ""),
  },

  frontend: {
    baseUrl: optional("FRONTEND_BASE_URL", "http://localhost:5000"),
  },

  ai: {
    replitBaseUrl: optional("AI_INTEGRATIONS_OPENAI_BASE_URL", ""),
    replitApiKey: optional("AI_INTEGRATIONS_OPENAI_API_KEY", ""),
    openaiApiKey: optional("OPENAI_API_KEY", ""),
  },

  ses: {
    region: optional("SES_REGION", "us-east-1"),
    fromAddress: optional("SES_FROM_ADDRESS", ""),
    accessKeyId: optional("AWS_ACCESS_KEY_ID", ""),
    secretAccessKey: optional("AWS_SECRET_ACCESS_KEY", ""),
  },

  marketData: {
    tradierApiKey: optional("TRADIER_API_KEY", ""),
    finnhubApiKey: optional("FINNHUB_API_KEY", ""),
  },

  notifications: {
    discordWebhookUrl: optional("DISCORD_WEBHOOK_URL", ""),
    telegramBotToken: optional("TELEGRAM_BOT_TOKEN", ""),
    telegramChatId: optional("TELEGRAM_CHAT_ID", ""),
  },

  telegram: {
    botToken: optional("TELEGRAM_BOT_TOKEN", ""),
    useWebhook: optionalBool("TELEGRAM_USE_WEBHOOK", false),
    webhookSecret: optional("TELEGRAM_WEBHOOK_SECRET", ""),
    webhookUrl: optional("TELEGRAM_WEBHOOK_URL", ""),
  },

  developer: {
    userIds: optional("DEVELOPER_USER_IDS", "").split(",").map(id => id.trim()).filter(Boolean),
  },
};

export function isAIAvailable(): boolean {
  return !!(env.ai.openaiApiKey || (env.ai.replitBaseUrl && env.ai.replitApiKey));
}

export function isStripeConfigured(): boolean {
  return !!env.stripe.secretKey;
}

export function isDeveloper(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return env.developer.userIds.includes(userId);
}

export function isSESConfigured(): boolean {
  return !!(env.ses.accessKeyId && env.ses.secretAccessKey && env.ses.fromAddress);
}

export function validateProductionEnv(): void {
  const errors: string[] = [];

  if (env.isProduction) {
    if (!env.stripe.secretKey) {
      errors.push("STRIPE_SECRET_KEY is required in production");
    }
    if (!env.clerk.secretKey) {
      errors.push("CLERK_SECRET_KEY is required in production");
    }
    if (!isAIAvailable()) {
      errors.push("Either OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_* must be set");
    }
    if (env.session.secret === "dev-session-secret-change-in-production") {
      errors.push("SESSION_SECRET must be changed from default in production");
    }
  }

  if (errors.length > 0) {
    console.error("Environment validation errors:");
    errors.forEach(e => console.error(`  - ${e}`));
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }
}

export type Env = typeof env;
