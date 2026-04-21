import { LiveOptionSnapshot } from "./live-options-scanner";

export interface TechnicalContext {
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  high: number;
  low: number;
  vwap?: number;
  rsi?: number;
  atr?: number;
  volume?: number;
  avgVolume?: number;
}

export interface StrategySignal {
  id: number;
  symbol: string;
  action: 'BUY_CALL' | 'BUY_PUT' | 'SELL_CALL' | 'SELL_PUT';
  optionType: 'CALL' | 'PUT';
  strikePrice: number;
  currentPrice: number;
  premium: number;
  executionPrice: number;
  bid: number;
  ask: number;
  spreadPercent: number;
  confidence: number;
  confidenceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidenceBreakdown: {
    marketStructure: number;
    optionsFlow: number;
    riskReward: number;
    liquidity: number;
  };
  strategy: string;
  strategyType: 'MOMENTUM_SCALP' | 'GAMMA_SQUEEZE' | 'MEAN_REVERSION' | 'SUPPORT_RESISTANCE';
  expiration: string;
  delta: number;
  theta: number;
  gamma: number;
  iv: number;
  volume: number;
  openInterest: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
  entryTiming: string;
  exitCriteria: string;
  riskFactors: string[];
  profitTarget: number;
  stopLoss: number;
  payoffRatio: number;
  createdAt: string;
}

interface StrategyEvaluation {
  score: number;
  strategy: string;
  strategyType: StrategySignal['strategyType'];
  action: StrategySignal['action'];
  reasoning: string;
  entryTiming: string;
  exitCriteria: string;
  riskFactors: string[];
  profitTarget: number;
  stopLoss: number;
}

const STRATEGY_CONFIG = {
  MINIMUM_VOLUME: 100,
  MINIMUM_OPEN_INTEREST: 50,
  MAX_SPREAD_PERCENT: 15,
  PREFERRED_DELTA_RANGE: { min: 0.20, max: 0.70 },
  HIGH_GAMMA_THRESHOLD: 0.05,
  IV_NORMAL_RANGE: { min: 15, max: 60 },
  VOLUME_OI_UNUSUAL_THRESHOLD: 2.0,
};

function calculateLiquidityScore(option: LiveOptionSnapshot): number {
  const bid = option.bid || 0;
  const ask = option.ask || 0;
  const spread = ask - bid;
  const midPrice = (bid + ask) / 2;
  
  if (midPrice === 0 || spread < 0) return 0;
  
  const spreadPercent = (spread / midPrice) * 100;
  const volume = option.volume || 0;
  const oi = option.openInterest || 1;
  
  let score = 0;
  
  if (spreadPercent <= 2) score += 40;
  else if (spreadPercent <= 5) score += 30;
  else if (spreadPercent <= 10) score += 20;
  else if (spreadPercent <= 15) score += 10;
  else return 0;
  
  if (volume >= 5000) score += 30;
  else if (volume >= 1000) score += 25;
  else if (volume >= 500) score += 20;
  else if (volume >= 100) score += 10;
  
  if (oi >= 5000) score += 20;
  else if (oi >= 1000) score += 15;
  else if (oi >= 500) score += 10;
  else if (oi >= 50) score += 5;
  
  if (bid > 0.05) score += 10;
  
  return Math.min(score, 100);
}

function calculateMarketStructureScore(
  option: LiveOptionSnapshot, 
  technical: TechnicalContext
): number {
  let score = 0;
  const isCall = option.optionType === 'call';
  const strike = option.strike;
  const price = technical.price;
  const dayChange = technical.changePercent;
  const dayRange = technical.high - technical.low;
  const pricePosition = dayRange > 0 ? (price - technical.low) / dayRange : 0.5;
  
  if (isCall) {
    if (dayChange > 0.3 && pricePosition > 0.6) score += 35;
    else if (dayChange > 0) score += 20;
    else if (dayChange < -0.5 && pricePosition < 0.3) score += 10;
    
    const otmPercent = ((strike - price) / price) * 100;
    if (otmPercent >= 0 && otmPercent <= 1) score += 25;
    else if (otmPercent > 1 && otmPercent <= 2) score += 20;
    else if (otmPercent > 2 && otmPercent <= 3) score += 15;
    else if (otmPercent < 0 && otmPercent >= -1) score += 20;
  } else {
    if (dayChange < -0.3 && pricePosition < 0.4) score += 35;
    else if (dayChange < 0) score += 20;
    else if (dayChange > 0.5 && pricePosition > 0.7) score += 10;
    
    const otmPercent = ((price - strike) / price) * 100;
    if (otmPercent >= 0 && otmPercent <= 1) score += 25;
    else if (otmPercent > 1 && otmPercent <= 2) score += 20;
    else if (otmPercent > 2 && otmPercent <= 3) score += 15;
    else if (otmPercent < 0 && otmPercent >= -1) score += 20;
  }
  
  const delta = Math.abs(option.delta || 0);
  if (delta >= 0.30 && delta <= 0.50) score += 20;
  else if (delta >= 0.20 && delta <= 0.60) score += 15;
  else if (delta >= 0.15 && delta <= 0.70) score += 10;
  
  const volumeRatio = (technical.volume || 1) / (technical.avgVolume || 1);
  if (volumeRatio > 1.5) score += 20;
  else if (volumeRatio > 1.0) score += 10;
  
  return Math.min(score, 100);
}

function calculateOptionsFlowScore(option: LiveOptionSnapshot): number {
  let score = 0;
  const volume = option.volume || 0;
  const oi = option.openInterest || 1;
  const volumeOIRatio = volume / oi;
  
  if (volumeOIRatio >= 5) score += 40;
  else if (volumeOIRatio >= 3) score += 35;
  else if (volumeOIRatio >= 2) score += 30;
  else if (volumeOIRatio >= 1) score += 20;
  else if (volumeOIRatio >= 0.5) score += 10;
  
  if (volume >= 10000) score += 30;
  else if (volume >= 5000) score += 25;
  else if (volume >= 2000) score += 20;
  else if (volume >= 500) score += 10;
  
  if (oi >= 10000) score += 20;
  else if (oi >= 5000) score += 15;
  else if (oi >= 1000) score += 10;
  
  const bid = option.bid || 0;
  const ask = option.ask || 0;
  const mid = (bid + ask) / 2;
  if (mid > 0 && bid > mid * 0.85) score += 10;
  
  return Math.min(score, 100);
}

function calculateRiskRewardScore(
  option: LiveOptionSnapshot,
  technical: TechnicalContext
): { score: number; profitTarget: number; stopLoss: number; payoffRatio: number } {
  const bid = option.bid || 0;
  const ask = option.ask || 0;
  const premium = (bid + ask) / 2;
  const dayRange = technical.high - technical.low;
  const atr = technical.atr || dayRange || technical.price * 0.01;
  
  const profitTarget = Math.round(premium * 1.5 * 100) / 100;
  const stopLoss = Math.round(premium * 0.5 * 100) / 100;
  const payoffRatio = profitTarget / (premium - stopLoss);
  
  let score = 0;
  
  if (payoffRatio >= 3) score += 40;
  else if (payoffRatio >= 2) score += 30;
  else if (payoffRatio >= 1.5) score += 20;
  else if (payoffRatio >= 1) score += 10;
  
  const gamma = Math.abs(option.gamma || 0);
  const delta = Math.abs(option.delta || 0);
  if (gamma > 0.05 && delta >= 0.25 && delta <= 0.55) score += 30;
  else if (gamma > 0.03) score += 20;
  else if (gamma > 0.01) score += 10;
  
  const theta = option.theta || 0;
  const premiumPercent = premium > 0 ? (Math.abs(theta) / premium) * 100 : 100;
  if (premiumPercent < 5) score += 20;
  else if (premiumPercent < 10) score += 15;
  else if (premiumPercent < 20) score += 10;
  
  const iv = option.iv || 0;
  if (iv >= 20 && iv <= 50) score += 10;
  
  return { 
    score: Math.min(score, 100), 
    profitTarget, 
    stopLoss,
    payoffRatio: Math.round(payoffRatio * 100) / 100
  };
}

function evaluateMomentumScalp(
  option: LiveOptionSnapshot,
  technical: TechnicalContext
): StrategyEvaluation | null {
  const isCall = option.optionType === 'call';
  const dayChange = technical.changePercent;
  const pricePosition = technical.high !== technical.low 
    ? (technical.price - technical.low) / (technical.high - technical.low) 
    : 0.5;
  
  const isBullishMomentum = dayChange > 0.2 && pricePosition > 0.5;
  const isBearishMomentum = dayChange < -0.2 && pricePosition < 0.5;
  
  if ((isCall && !isBullishMomentum) || (!isCall && !isBearishMomentum)) {
    return null;
  }
  
  const delta = Math.abs(option.delta || 0);
  const volume = option.volume || 0;
  const gamma = Math.abs(option.gamma || 0);
  
  let score = 50;
  if (Math.abs(dayChange) > 0.5) score += 15;
  if (delta >= 0.35 && delta <= 0.55) score += 15;
  if (volume > 1000) score += 10;
  if (gamma > 0.04) score += 10;
  
  const action: StrategySignal['action'] = isCall ? 'BUY_CALL' : 'BUY_PUT';
  const direction = isCall ? 'upward' : 'downward';
  const premium = ((option.bid || 0) + (option.ask || 0)) / 2;
  
  return {
    score,
    strategy: 'Momentum Scalp',
    strategyType: 'MOMENTUM_SCALP',
    action,
    reasoning: `${option.symbol} showing strong ${direction} momentum (+${Math.abs(dayChange).toFixed(2)}% today). Price at ${(pricePosition * 100).toFixed(0)}% of day's range with ${volume.toLocaleString()} contracts traded. Delta ${delta.toFixed(2)} offers good directional exposure for continued momentum.`,
    entryTiming: 'Enter on pullback to VWAP or continuation above current level. Best during first 2 hours of trading.',
    exitCriteria: `Take profit at 50-100% gain ($${(premium * 1.5).toFixed(2)}-$${(premium * 2).toFixed(2)}). Stop loss at 40-50% of premium ($${(premium * 0.5).toFixed(2)}).`,
    riskFactors: [
      'Momentum can reverse quickly on 0DTE',
      'Theta decay accelerates after 2pm ET',
      'Watch for profit-taking at round numbers'
    ],
    profitTarget: Math.round(premium * 1.5 * 100) / 100,
    stopLoss: Math.round(premium * 0.5 * 100) / 100,
  };
}

function evaluateGammaSqueeze(
  option: LiveOptionSnapshot,
  technical: TechnicalContext
): StrategyEvaluation | null {
  const gamma = Math.abs(option.gamma || 0);
  const delta = Math.abs(option.delta || 0);
  const isCall = option.optionType === 'call';
  const strike = option.strike;
  const price = technical.price;
  
  const nearStrike = Math.abs(strike - price) / price < 0.01;
  
  if (gamma < 0.05 || !nearStrike) {
    return null;
  }
  
  const volume = option.volume || 0;
  const oi = option.openInterest || 1;
  const volumeOIRatio = volume / oi;
  
  let score = 55;
  if (gamma > 0.08) score += 15;
  if (nearStrike && delta >= 0.45 && delta <= 0.55) score += 15;
  if (volumeOIRatio > 2) score += 10;
  if (volume > 5000) score += 5;
  
  const action: StrategySignal['action'] = isCall ? 'BUY_CALL' : 'BUY_PUT';
  const premium = ((option.bid || 0) + (option.ask || 0)) / 2;
  
  return {
    score,
    strategy: 'Gamma Squeeze',
    strategyType: 'GAMMA_SQUEEZE',
    action,
    reasoning: `High gamma ${gamma.toFixed(3)} at $${strike} strike near current price $${price.toFixed(2)}. Market makers hedging creates amplified moves. ${volume.toLocaleString()} volume with ${volumeOIRatio.toFixed(1)}x volume/OI ratio suggests positioning for a breakout.`,
    entryTiming: 'Enter when price approaches the strike. Gamma exposure peaks at-the-money.',
    exitCriteria: `Quick scalp: exit at 30-50% profit ($${(premium * 1.3).toFixed(2)}-$${(premium * 1.5).toFixed(2)}). Gamma moves are explosive but short-lived.`,
    riskFactors: [
      'Gamma works both ways - losses accelerate too',
      'Pin risk as expiration approaches',
      'Market makers may lean against obvious gamma levels'
    ],
    profitTarget: Math.round(premium * 1.5 * 100) / 100,
    stopLoss: Math.round(premium * 0.4 * 100) / 100,
  };
}

function evaluateMeanReversion(
  option: LiveOptionSnapshot,
  technical: TechnicalContext
): StrategyEvaluation | null {
  const dayChange = technical.changePercent;
  const pricePosition = technical.high !== technical.low 
    ? (technical.price - technical.low) / (technical.high - technical.low) 
    : 0.5;
  const isCall = option.optionType === 'call';
  
  const isOverextendedDown = dayChange < -1.0 && pricePosition < 0.25;
  const isOverextendedUp = dayChange > 1.0 && pricePosition > 0.75;
  
  const shouldBuyCall = isOverextendedDown && isCall;
  const shouldBuyPut = isOverextendedUp && !isCall;
  
  if (!shouldBuyCall && !shouldBuyPut) {
    return null;
  }
  
  const delta = Math.abs(option.delta || 0);
  const iv = option.iv || 0;
  
  let score = 45;
  if (Math.abs(dayChange) > 1.5) score += 15;
  if (delta >= 0.30 && delta <= 0.50) score += 10;
  if (iv > 30) score += 10;
  if ((isOverextendedDown && pricePosition < 0.15) || (isOverextendedUp && pricePosition > 0.85)) score += 10;
  
  const action: StrategySignal['action'] = isCall ? 'BUY_CALL' : 'BUY_PUT';
  const fadeDirection = isCall ? 'bounce' : 'pullback';
  const premium = ((option.bid || 0) + (option.ask || 0)) / 2;
  
  return {
    score,
    strategy: 'Mean Reversion Fade',
    strategyType: 'MEAN_REVERSION',
    action,
    reasoning: `${option.symbol} overextended ${dayChange > 0 ? 'up' : 'down'} ${Math.abs(dayChange).toFixed(2)}% today. Price at ${(pricePosition * 100).toFixed(0)}% of range suggests potential ${fadeDirection}. IV at ${iv.toFixed(1)}% provides good premium for reversal trade.`,
    entryTiming: `Wait for signs of exhaustion: volume decrease, failed new ${dayChange > 0 ? 'high' : 'low'}, or reversal candle pattern.`,
    exitCriteria: `Target 50% premium gain on reversion to VWAP ($${(premium * 1.5).toFixed(2)}). Stop at new extreme.`,
    riskFactors: [
      'Trend can continue despite overextension',
      'News-driven moves may not revert same day',
      'Requires precise timing for entry'
    ],
    profitTarget: Math.round(premium * 1.5 * 100) / 100,
    stopLoss: Math.round(premium * 0.6 * 100) / 100,
  };
}

function evaluateSupportResistance(
  option: LiveOptionSnapshot,
  technical: TechnicalContext
): StrategyEvaluation | null {
  const price = technical.price;
  const dayHigh = technical.high;
  const dayLow = technical.low;
  const prevClose = technical.prevClose;
  const isCall = option.optionType === 'call';
  const strike = option.strike;
  
  const nearDayHigh = Math.abs(price - dayHigh) / price < 0.003;
  const nearDayLow = Math.abs(price - dayLow) / price < 0.003;
  const nearPrevClose = Math.abs(price - prevClose) / price < 0.002;
  
  const callBreakout = isCall && nearDayHigh && strike >= dayHigh && strike <= dayHigh * 1.01;
  const putBreakdown = !isCall && nearDayLow && strike <= dayLow && strike >= dayLow * 0.99;
  
  if (!callBreakout && !putBreakdown) {
    return null;
  }
  
  const volume = option.volume || 0;
  const gamma = Math.abs(option.gamma || 0);
  
  let score = 50;
  if (volume > 2000) score += 15;
  if (gamma > 0.04) score += 10;
  if (!nearPrevClose) score += 10;
  
  const action: StrategySignal['action'] = isCall ? 'BUY_CALL' : 'BUY_PUT';
  const level = isCall ? `day high $${dayHigh.toFixed(2)}` : `day low $${dayLow.toFixed(2)}`;
  const premium = ((option.bid || 0) + (option.ask || 0)) / 2;
  
  return {
    score,
    strategy: 'Support/Resistance Breakout',
    strategyType: 'SUPPORT_RESISTANCE',
    action,
    reasoning: `Price testing ${level}. Strike $${strike} positioned for breakout trade. ${volume.toLocaleString()} volume at this level shows institutional interest. Gamma ${gamma.toFixed(3)} will amplify move on break.`,
    entryTiming: 'Enter on confirmed break with volume. Wait for candle close above/below level.',
    exitCriteria: `Target 75-100% gain on momentum ($${(premium * 1.75).toFixed(2)}-$${(premium * 2).toFixed(2)}). Stop if price reverses back through level.`,
    riskFactors: [
      'False breakouts common near key levels',
      'Requires quick decision-making',
      'Volume confirmation essential'
    ],
    profitTarget: Math.round(premium * 1.75 * 100) / 100,
    stopLoss: Math.round(premium * 0.5 * 100) / 100,
  };
}

function validatePremium(option: LiveOptionSnapshot): { 
  isValid: boolean; 
  executionPrice: number; 
  spreadPercent: number;
  reason?: string;
} {
  const bid = option.bid || 0;
  const ask = option.ask || 0;
  
  if (bid <= 0 || ask <= 0) {
    return { isValid: false, executionPrice: 0, spreadPercent: 100, reason: 'No valid bid/ask' };
  }
  
  const spread = ask - bid;
  const midPrice = (bid + ask) / 2;
  const spreadPercent = (spread / midPrice) * 100;
  
  if (spreadPercent > STRATEGY_CONFIG.MAX_SPREAD_PERCENT) {
    return { isValid: false, executionPrice: midPrice, spreadPercent, reason: `Spread ${spreadPercent.toFixed(1)}% too wide` };
  }
  
  if (midPrice < 0.05) {
    return { isValid: false, executionPrice: midPrice, spreadPercent, reason: 'Premium too low for reliable execution' };
  }
  
  const executionPrice = spreadPercent <= 3 ? midPrice : (bid * 0.6 + ask * 0.4);
  
  return { isValid: true, executionPrice: Math.round(executionPrice * 100) / 100, spreadPercent };
}

function calculateConfidenceGrade(confidence: number): StrategySignal['confidenceGrade'] {
  if (confidence >= 80) return 'A';
  if (confidence >= 65) return 'B';
  if (confidence >= 50) return 'C';
  if (confidence >= 35) return 'D';
  return 'F';
}

function determineUrgency(confidence: number, gamma: number, daysToExpiry: number): StrategySignal['urgency'] {
  if (confidence >= 75 && gamma > 0.05 && daysToExpiry === 0) return 'HIGH';
  if (confidence >= 60 || gamma > 0.04) return 'MEDIUM';
  return 'LOW';
}

export function generateZeroDTESignals(
  options: LiveOptionSnapshot[],
  technical: TechnicalContext
): StrategySignal[] {
  const signals: StrategySignal[] = [];
  
  const validOptions = options.filter(opt => {
    if ((opt.volume || 0) < STRATEGY_CONFIG.MINIMUM_VOLUME) return false;
    if ((opt.openInterest || 0) < STRATEGY_CONFIG.MINIMUM_OPEN_INTEREST) return false;
    if (opt.daysToExpiry > 1) return false;
    
    const premiumValidation = validatePremium(opt);
    if (!premiumValidation.isValid) return false;
    
    return true;
  });
  
  for (const option of validOptions) {
    const strategies = [
      evaluateMomentumScalp(option, technical),
      evaluateGammaSqueeze(option, technical),
      evaluateMeanReversion(option, technical),
      evaluateSupportResistance(option, technical),
    ].filter(Boolean) as StrategyEvaluation[];
    
    if (strategies.length === 0) continue;
    
    const bestStrategy = strategies.reduce((best, curr) => 
      curr.score > best.score ? curr : best
    );
    
    const liquidityScore = calculateLiquidityScore(option);
    const marketStructureScore = calculateMarketStructureScore(option, technical);
    const flowScore = calculateOptionsFlowScore(option);
    const { score: rrScore, profitTarget, stopLoss, payoffRatio } = calculateRiskRewardScore(option, technical);
    
    const confidence = Math.round(
      (marketStructureScore * 0.30) +
      (flowScore * 0.25) +
      (rrScore * 0.25) +
      (liquidityScore * 0.20)
    );
    
    if (confidence < 40) continue;
    
    const premiumValidation = validatePremium(option);
    const gamma = Math.abs(option.gamma || 0);
    
    signals.push({
      id: signals.length + 1,
      symbol: option.symbol,
      action: bestStrategy.action,
      optionType: option.optionType === 'call' ? 'CALL' : 'PUT',
      strikePrice: option.strike,
      currentPrice: option.underlyingPrice || technical.price,
      premium: premiumValidation.executionPrice,
      executionPrice: premiumValidation.executionPrice,
      bid: option.bid || 0,
      ask: option.ask || 0,
      spreadPercent: premiumValidation.spreadPercent,
      confidence,
      confidenceGrade: calculateConfidenceGrade(confidence),
      confidenceBreakdown: {
        marketStructure: marketStructureScore,
        optionsFlow: flowScore,
        riskReward: rrScore,
        liquidity: liquidityScore,
      },
      strategy: bestStrategy.strategy,
      strategyType: bestStrategy.strategyType,
      expiration: option.expiration,
      delta: option.delta || 0,
      theta: option.theta || 0,
      gamma: option.gamma || 0,
      iv: option.iv || 0,
      volume: option.volume || 0,
      openInterest: option.openInterest || 0,
      urgency: determineUrgency(confidence, gamma, option.daysToExpiry),
      reasoning: bestStrategy.reasoning,
      entryTiming: bestStrategy.entryTiming,
      exitCriteria: bestStrategy.exitCriteria,
      riskFactors: bestStrategy.riskFactors,
      profitTarget: bestStrategy.profitTarget || profitTarget,
      stopLoss: bestStrategy.stopLoss || stopLoss,
      payoffRatio,
      createdAt: new Date().toISOString(),
    });
  }
  
  return signals
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);
}
