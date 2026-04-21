export interface PositionSizingInput {
  accountSize: number;
  riskPercent: number;
  costPerContract: number;
  maxPositionPercent?: number;
  allowAdvisoryOverride?: boolean;
}

export interface PositionSizingResult {
  riskBudget: number;
  costPerContract: number;
  contracts: number;
  totalCost: number;
  maxLoss: number;
  isUnaffordable: boolean;
  riskViolation: boolean;
  advisoryMessage: string | null;
  riskUtilization: number;
}

export function sizePositionStrictWithOverride(input: PositionSizingInput): PositionSizingResult {
  const {
    accountSize,
    riskPercent,
    costPerContract,
    maxPositionPercent = 0.10,
    allowAdvisoryOverride = true,
  } = input;

  const result: PositionSizingResult = {
    riskBudget: 0,
    costPerContract,
    contracts: 0,
    totalCost: 0,
    maxLoss: 0,
    isUnaffordable: false,
    riskViolation: false,
    advisoryMessage: null,
    riskUtilization: 0,
  };

  if (!accountSize || accountSize <= 0) {
    result.advisoryMessage = "Invalid account size";
    return result;
  }

  if (!costPerContract || costPerContract <= 0) {
    result.advisoryMessage = "Invalid cost per contract";
    return result;
  }

  const riskBudget = accountSize * riskPercent;
  result.riskBudget = riskBudget;

  if (costPerContract > accountSize) {
    result.isUnaffordable = true;
    result.advisoryMessage = `Cannot afford even 1 contract. Contract cost ($${costPerContract.toFixed(2)}) exceeds account size ($${accountSize.toFixed(2)}).`;
    return result;
  }

  const maxContractsByRisk = Math.floor(riskBudget / costPerContract);

  const maxPositionBudget = accountSize * maxPositionPercent;
  const maxContractsByPosition = Math.floor(maxPositionBudget / costPerContract);

  const maxContracts = Math.min(maxContractsByRisk, maxContractsByPosition);

  if (maxContracts >= 1) {
    result.contracts = maxContracts;
    result.totalCost = maxContracts * costPerContract;
    result.maxLoss = result.totalCost;
    result.riskViolation = false;
    result.riskUtilization = (result.totalCost / riskBudget) * 100;
    result.advisoryMessage = null;
    return result;
  }

  if (!allowAdvisoryOverride) {
    result.isUnaffordable = true;
    result.advisoryMessage = `Risk budget ($${riskBudget.toFixed(2)}) insufficient for 1 contract ($${costPerContract.toFixed(2)}). Advisory override disabled.`;
    return result;
  }

  result.contracts = 1;
  result.totalCost = costPerContract;
  result.maxLoss = costPerContract;
  result.riskViolation = true;
  result.riskUtilization = (costPerContract / riskBudget) * 100;
  result.advisoryMessage = `Warning: 1 contract exceeds your risk budget by ${((costPerContract / riskBudget - 1) * 100).toFixed(0)}%. Consider reducing position size or increasing account size.`;

  return result;
}

export function calculateBreakeven(
  strike: number,
  premium: number,
  optionType: "CALL" | "PUT"
): number {
  if (optionType === "CALL") {
    return strike + premium;
  } else {
    return strike - premium;
  }
}

export function calculateMaxProfit(
  premium: number,
  contracts: number,
  optionType: "CALL" | "PUT",
  isBuying: boolean
): number | "unlimited" {
  const multiplier = contracts * 100;
  
  if (isBuying) {
    if (optionType === "CALL") {
      return "unlimited";
    } else {
      return (premium * multiplier);
    }
  } else {
    return premium * multiplier;
  }
}

export function calculateMaxLoss(
  premium: number,
  contracts: number,
  strike: number,
  isBuying: boolean
): number | "unlimited" {
  const multiplier = contracts * 100;
  
  if (isBuying) {
    return premium * multiplier;
  } else {
    return "unlimited";
  }
}

export interface RiskMetrics {
  riskRewardRatio: number | null;
  breakevenDistance: number;
  breakevenPercent: number;
  impliedProbabilityProfit: number | null;
}

export function calculateRiskMetrics(
  currentPrice: number,
  strike: number,
  premium: number,
  delta: number | null,
  optionType: "CALL" | "PUT"
): RiskMetrics {
  const breakeven = calculateBreakeven(strike, premium, optionType);
  const breakevenDistance = Math.abs(breakeven - currentPrice);
  const breakevenPercent = (breakevenDistance / currentPrice) * 100;

  let impliedProbabilityProfit: number | null = null;
  if (delta !== null) {
    if (optionType === "CALL") {
      impliedProbabilityProfit = Math.abs(delta) * 100;
    } else {
      impliedProbabilityProfit = (1 - Math.abs(delta)) * 100;
    }
  }

  const riskRewardRatio = premium > 0 ? (strike - premium) / premium : null;

  return {
    riskRewardRatio,
    breakevenDistance,
    breakevenPercent,
    impliedProbabilityProfit,
  };
}
