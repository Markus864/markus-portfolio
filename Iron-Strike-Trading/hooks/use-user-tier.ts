import { useQuery } from "@tanstack/react-query";

export type Tier = "free" | "pro" | "premium";

export interface UserTierData {
  tier: Tier;
  tierDisplayName: string;
  isDeveloper: boolean;
  features: Record<string, boolean>;
}

export function useUserTier() {
  const { data, isLoading, error } = useQuery<UserTierData>({
    queryKey: ["/api/user/tier"],
  });

  return {
    tier: data?.tier || "free",
    tierDisplayName: data?.tierDisplayName || "Free",
    isDeveloper: data?.isDeveloper || false,
    features: data?.features || {},
    isLoading,
    error,
    hasFeature: (feature: string) => data?.features?.[feature] || false,
    hasTierAccess: (requiredTier: Tier) => {
      const tierHierarchy: Record<Tier, number> = { free: 1, pro: 2, premium: 3 };
      const userLevel = tierHierarchy[data?.tier || "free"];
      const requiredLevel = tierHierarchy[requiredTier];
      return data?.isDeveloper || userLevel >= requiredLevel;
    },
  };
}
