import Stripe from "stripe";
import { env, isStripeConfigured } from "./config/env";

let stripeClient: Stripe | null = null;

if (isStripeConfigured()) {
  stripeClient = new Stripe(env.stripe.secretKey, {
    apiVersion: "2024-06-20" as any,
  });
} else {
  console.warn("[Stripe] STRIPE_SECRET_KEY not configured - billing features disabled");
}

export const stripe: Stripe | null = stripeClient;
export const STRIPE_PRICE_PRO = env.stripe.pricePro;
export const STRIPE_PRICE_PREMIUM = env.stripe.pricePremium;
export const FRONTEND_BASE_URL = env.frontend.baseUrl;
export const STRIPE_PORTAL_RETURN_URL = env.stripe.portalReturnUrl;

export const STRIPE_PRICE_PRO_MONTHLY = env.stripe.priceProMonthly;
export const STRIPE_PRICE_PRO_YEARLY = env.stripe.priceProYearly;
export const STRIPE_PRICE_PREMIUM_MONTHLY = env.stripe.pricePremiumMonthly;
export const STRIPE_PRICE_PREMIUM_YEARLY = env.stripe.pricePremiumYearly;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe is not configured. STRIPE_SECRET_KEY must be set.");
    this.name = "StripeNotConfiguredError";
  }
}

export function getStripe(): Stripe {
  if (!stripeClient) {
    throw new StripeNotConfiguredError();
  }
  return stripeClient;
}

export type BillingInterval = "monthly" | "yearly";

export function getPriceIdForTier(plan: "pro" | "premium", interval: BillingInterval = "monthly"): string {
  if (plan === "pro") {
    if (interval === "yearly") {
      if (!STRIPE_PRICE_PRO_YEARLY) {
        throw new Error(`Yearly pricing not configured for Pro plan. Set STRIPE_PRICE_PRO_YEARLY.`);
      }
      return STRIPE_PRICE_PRO_YEARLY;
    }
    const monthlyPrice = STRIPE_PRICE_PRO_MONTHLY || STRIPE_PRICE_PRO;
    if (!monthlyPrice) {
      throw new Error(`Monthly pricing not configured for Pro plan. Set STRIPE_PRICE_PRO_MONTHLY.`);
    }
    return monthlyPrice;
  }
  if (plan === "premium") {
    if (interval === "yearly") {
      if (!STRIPE_PRICE_PREMIUM_YEARLY) {
        throw new Error(`Yearly pricing not configured for Premium plan. Set STRIPE_PRICE_PREMIUM_YEARLY.`);
      }
      return STRIPE_PRICE_PREMIUM_YEARLY;
    }
    const monthlyPrice = STRIPE_PRICE_PREMIUM_MONTHLY || STRIPE_PRICE_PREMIUM;
    if (!monthlyPrice) {
      throw new Error(`Monthly pricing not configured for Premium plan. Set STRIPE_PRICE_PREMIUM_MONTHLY.`);
    }
    return monthlyPrice;
  }
  throw new Error(`No Stripe price for plan: ${plan}`);
}

export function isYearlyPricingConfigured(): boolean {
  return !!(STRIPE_PRICE_PRO_YEARLY && STRIPE_PRICE_PREMIUM_YEARLY);
}

export function getTierFromPriceId(priceId: string): "pro" | "premium" | null {
  if (priceId === STRIPE_PRICE_PRO || priceId === STRIPE_PRICE_PRO_MONTHLY || priceId === STRIPE_PRICE_PRO_YEARLY) {
    return "pro";
  }
  if (priceId === STRIPE_PRICE_PREMIUM || priceId === STRIPE_PRICE_PREMIUM_MONTHLY || priceId === STRIPE_PRICE_PREMIUM_YEARLY) {
    return "premium";
  }
  return null;
}

export { isStripeConfigured };
