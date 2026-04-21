export interface RiskProfile {
  label: string;
  riskPercent: number;
  maxPercent: number;
}

export const riskProfiles: Record<string, RiskProfile> = {
  UltraConservative: {
    label: "UltraConservative",
    riskPercent: 0.0025,
    maxPercent: 0.005,
  },
  Conservative: {
    label: "Conservative",
    riskPercent: 0.005,
    maxPercent: 0.01,
  },
  Balanced: {
    label: "Balanced",
    riskPercent: 0.01,
    maxPercent: 0.02,
  },
  Growth: {
    label: "Growth",
    riskPercent: 0.02,
    maxPercent: 0.03,
  },
  Aggressive: {
    label: "Aggressive",
    riskPercent: 0.03,
    maxPercent: 0.05,
  },
};

export function getRiskProfile(name: string): RiskProfile {
  return riskProfiles[name] || riskProfiles.Balanced;
}

export function clampRiskPercent(
  aiRiskPercent: number | undefined,
  profile: RiskProfile
): number {
  if (typeof aiRiskPercent !== "number" || aiRiskPercent <= 0) {
    return profile.riskPercent;
  }
  return Math.min(aiRiskPercent, profile.maxPercent);
}

export type Tier = "free" | "pro" | "premium";

export const validTiers: Tier[] = ["free", "pro", "premium"];

export function isValidTier(tier: string): tier is Tier {
  return validTiers.includes(tier as Tier);
}

// Position sizing result interface
export interface PositionSizingResult {
  contracts: number;
  totalCost: number;
  maxLoss: number;
  isUnaffordable: boolean;
  riskViolation: boolean;
}

// Strict + Advisory Override position sizing
// - If can't afford even 1 contract: isUnaffordable = true, contracts = 0
// - If within risk budget: normal sizing, riskViolation = false
// - If exceeds risk budget but can afford 1: riskViolation = true, contracts = 1
export function sizePositionStrictWithOverride({
  accountSize,
  effectiveRiskPercent,
  costPerContract,
  maxPositionPercent,
}: {
  accountSize: number;
  effectiveRiskPercent: number;
  costPerContract: number;
  maxPositionPercent?: number;
}): PositionSizingResult {
  const result: PositionSizingResult = {
    contracts: 0,
    totalCost: 0,
    maxLoss: 0,
    isUnaffordable: false,
    riskViolation: false,
  };

  // Validate inputs
  if (
    !accountSize ||
    !effectiveRiskPercent ||
    !costPerContract ||
    costPerContract <= 0
  ) {
    return result;
  }

  const riskBudget = accountSize * effectiveRiskPercent;

  // 1) If you literally cannot afford a single contract: hard block
  if (costPerContract > accountSize) {
    result.isUnaffordable = true;
    return result;
  }

  // 2) Calculate max contracts by risk budget
  const maxContractsByRisk = Math.floor(riskBudget / costPerContract);

  // 3) Also enforce max position size if provided
  let maxContractsByPosition = Infinity;
  if (maxPositionPercent) {
    const maxPositionBudget = accountSize * maxPositionPercent;
    maxContractsByPosition = Math.floor(maxPositionBudget / costPerContract);
  }

  // 4) Take minimum of both caps
  const maxContracts = Math.min(maxContractsByRisk, maxContractsByPosition);

  // 5) If can afford at least 1 contract within risk limits
  if (maxContracts >= 1) {
    result.contracts = maxContracts;
    result.totalCost = maxContracts * costPerContract;
    result.maxLoss = result.totalCost;
    result.isUnaffordable = false;
    result.riskViolation = false;
    return result;
  }

  // 6) Advisory override: can afford 1 contract but exceeds risk budget
  // costPerContract <= accountSize but costPerContract > riskBudget
  result.contracts = 1;
  result.totalCost = costPerContract;
  result.maxLoss = costPerContract;
  result.isUnaffordable = false;
  result.riskViolation = true;
  return result;
}
