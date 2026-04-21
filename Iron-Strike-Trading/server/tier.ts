import { getAuth } from "@clerk/express";
import { storage } from "./storage";
import { env, isDeveloper } from "./config/env";
import type { UserRole } from "@shared/schema";

export type Tier = "free" | "pro" | "premium";

export const validTiers: Tier[] = ["free", "pro", "premium"];

export function isValidTier(tier: string): tier is Tier {
  return validTiers.includes(tier as Tier);
}

export function normalizeTier(role: string | null | undefined): Tier {
  if (!role) return "free";
  const normalized = role.toLowerCase().trim();
  if (normalized === "pro" || normalized === "premium") {
    return normalized as Tier;
  }
  return "free";
}

export interface TierResult {
  tier: Tier;
  userId: string | null;
  isDeveloper: boolean;
  effectiveTier: Tier;
}

export async function getTierFromRequest(req: any): Promise<TierResult> {
  const result: TierResult = {
    tier: "free",
    userId: null,
    isDeveloper: false,
    effectiveTier: "free",
  };

  try {
    const { userId } = getAuth(req);
    result.userId = userId || null;

    if (userId) {
      const user = await storage.getUser(userId);
      result.tier = normalizeTier(user?.role);
      result.isDeveloper = isDeveloper(userId);
      result.effectiveTier = result.isDeveloper ? "premium" : result.tier;
    } else if (!env.isProduction) {
      const devTierHeader = req.headers["x-user-tier"];
      if (devTierHeader && isValidTier(devTierHeader)) {
        result.tier = devTierHeader as Tier;
        result.effectiveTier = result.tier;
      }
    }
  } catch (error) {
    console.warn("[Tier] Error getting tier from request:", error);
  }

  return result;
}

export function getTierDisplayName(tier: Tier): string {
  switch (tier) {
    case "premium": return "Premium";
    case "pro": return "Pro";
    default: return "Free";
  }
}

export const TIER_HIERARCHY: Record<Tier, number> = {
  free: 0,
  pro: 1,
  premium: 2,
};

export function hasTierAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export function requireTier(requiredTier: Tier) {
  return async (req: any, res: any, next: any) => {
    const { effectiveTier, userId } = await getTierFromRequest(req);
    
    if (!hasTierAccess(effectiveTier, requiredTier)) {
      return res.status(403).json({
        error: `This feature requires ${getTierDisplayName(requiredTier)} tier or higher`,
        requiredTier,
        currentTier: effectiveTier,
        code: "TIER_REQUIRED",
      });
    }
    
    req.userTier = effectiveTier;
    req.userId = userId;
    next();
  };
}
