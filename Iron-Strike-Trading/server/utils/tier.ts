import { UserRole } from "@shared/schema";
import { isDeveloper } from "../config/env";

export type Tier = "free" | "pro" | "premium";

const TIER_HIERARCHY: Record<Tier, number> = {
  free: 1,
  pro: 2,
  premium: 3,
};

export interface TierUser {
  id?: string | null;
  role?: string | null;
}

export function getUserTier(user: TierUser | null | undefined): Tier {
  if (!user) return "free";
  const role = user.role?.toLowerCase();
  if (role === "premium") return "premium";
  if (role === "pro") return "pro";
  return "free";
}

export function requireTier(user: TierUser | null | undefined, requiredTier: Tier): boolean {
  if (!user) return false;
  
  if (isDeveloper(user.id)) {
    return true;
  }
  
  const userTier = getUserTier(user);
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export function hasTierAccess(userTier: Tier, requiredTier: Tier, userId?: string | null): boolean {
  if (isDeveloper(userId)) {
    return true;
  }
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export function getTierDisplayName(tier: Tier): string {
  switch (tier) {
    case "free": return "Free";
    case "pro": return "Pro";
    case "premium": return "Premium";
    default: return "Free";
  }
}

export function getTierColor(tier: Tier): string {
  switch (tier) {
    case "free": return "gray";
    case "pro": return "blue";
    case "premium": return "emerald";
    default: return "gray";
  }
}
