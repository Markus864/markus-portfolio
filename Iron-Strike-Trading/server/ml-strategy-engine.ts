import { storage } from "./storage";
import type { SelectSignalHistory, SelectTradeExecution, SelectSignalOutcome } from "@shared/schema";

export interface MLFeatures {
  symbol: string;
  signalId: number;
  confidence: number;
  premium: number;
  contracts: number;
  strikePrice: number;
  currentPrice: number;
  moneyness: number;
  daysToExpiry: number;
  impliedVolatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  riskPercentage: number;
  optionType: string;
  action: string;
}

export interface MLDataPoint {
  features: MLFeatures;
  label: number;
  pnlPercent: number;
}

export interface MLDataset {
  dataPoints: MLDataPoint[];
  featureNames: string[];
  symbolFilter?: string;
  lookbackDays: number;
  totalSignals: number;
  totalTrades: number;
  winRate: number;
}

export interface LogisticRegressionModel {
  weights: number[];
  bias: number;
  featureNames: string[];
  trainedAt: Date;
  trainingAccuracy: number;
  symbolFilter?: string;
}

export interface ModelEvaluation {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalSamples: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  featureImportance: Record<string, number>;
}

function calculateDaysToExpiry(expirationDate: string): number {
  const expiry = new Date(expirationDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

function calculateMoneyness(strikePrice: number, currentPrice: number, optionType: string): number {
  if (optionType === "CALL") {
    return (currentPrice - strikePrice) / currentPrice;
  } else {
    return (strikePrice - currentPrice) / currentPrice;
  }
}

function extractFeaturesFromSignal(signal: SelectSignalHistory): MLFeatures {
  const strikePrice = parseFloat(signal.strikePrice as string);
  const currentPrice = parseFloat(signal.currentPrice as string);
  
  return {
    symbol: signal.symbol,
    signalId: signal.id,
    confidence: parseFloat(signal.confidence as string),
    premium: parseFloat(signal.premium as string),
    contracts: signal.contracts,
    strikePrice,
    currentPrice,
    moneyness: calculateMoneyness(strikePrice, currentPrice, signal.optionType || "CALL"),
    daysToExpiry: calculateDaysToExpiry(signal.expirationDate),
    impliedVolatility: signal.impliedVolatility ? parseFloat(signal.impliedVolatility as string) : null,
    delta: signal.delta ? parseFloat(signal.delta as string) : null,
    gamma: signal.gamma ? parseFloat(signal.gamma as string) : null,
    theta: signal.theta ? parseFloat(signal.theta as string) : null,
    vega: signal.vega ? parseFloat(signal.vega as string) : null,
    riskPercentage: parseFloat(signal.riskPercentage as string),
    optionType: signal.optionType || "CALL",
    action: signal.action,
  };
}

export async function buildTrainingDataset(options: {
  symbol?: string;
  lookbackDays?: number;
}): Promise<MLDataset> {
  const { symbol, lookbackDays = 365 } = options;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  
  let signals: SelectSignalHistory[];
  if (symbol) {
    signals = await storage.getSignalHistoryBySymbol(symbol.toUpperCase());
  } else {
    signals = await storage.getAllSignalHistory();
  }
  
  signals = signals.filter(s => new Date(s.generatedAt) >= cutoffDate);
  
  let outcomes: SelectSignalOutcome[];
  if (symbol) {
    outcomes = await storage.getSignalOutcomes(symbol.toUpperCase());
  } else {
    const allSymbols = await storage.getDistinctSymbolsFromOutcomes();
    const allOutcomes: SelectSignalOutcome[] = [];
    for (const sym of allSymbols) {
      const symOutcomes = await storage.getSignalOutcomes(sym);
      allOutcomes.push(...symOutcomes);
    }
    outcomes = allOutcomes;
  }
  
  const outcomeMap = new Map<number, SelectSignalOutcome>();
  for (const outcome of outcomes) {
    if (outcome.wasSuccessful !== null) {
      outcomeMap.set(outcome.signalId, outcome);
    }
  }
  
  const dataPoints: MLDataPoint[] = [];
  const WIN_THRESHOLD = 5;
  
  for (const signal of signals) {
    const outcome = outcomeMap.get(signal.id);
    if (!outcome) continue;
    
    const pnlPercent = outcome.profitLossPercent 
      ? parseFloat(outcome.profitLossPercent as string) 
      : 0;
    
    const label = pnlPercent >= WIN_THRESHOLD ? 1 : 0;
    
    const features = extractFeaturesFromSignal(signal);
    
    dataPoints.push({
      features,
      label,
      pnlPercent,
    });
  }
  
  const wins = dataPoints.filter(d => d.label === 1).length;
  const winRate = dataPoints.length > 0 ? wins / dataPoints.length : 0;
  
  return {
    dataPoints,
    featureNames: [
      "confidence", "premium", "contracts", "moneyness", "daysToExpiry",
      "impliedVolatility", "delta", "riskPercentage"
    ],
    symbolFilter: symbol,
    lookbackDays,
    totalSignals: signals.length,
    totalTrades: dataPoints.length,
    winRate,
  };
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function featuresToVector(features: MLFeatures, featureNames: string[]): number[] {
  const vector: number[] = [];
  for (const name of featureNames) {
    let value = (features as any)[name];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      value = 0;
    }
    vector.push(value);
  }
  return vector;
}

function normalizeFeatures(dataPoints: MLDataPoint[], featureNames: string[]): { 
  normalized: number[][];
  means: number[];
  stds: number[];
} {
  const n = dataPoints.length;
  const k = featureNames.length;
  
  const means: number[] = new Array(k).fill(0);
  const stds: number[] = new Array(k).fill(0);
  
  const vectors = dataPoints.map(dp => featuresToVector(dp.features, featureNames));
  
  for (let j = 0; j < k; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += vectors[i][j];
    }
    means[j] = sum / n;
  }
  
  for (let j = 0; j < k; j++) {
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      sumSq += Math.pow(vectors[i][j] - means[j], 2);
    }
    stds[j] = Math.sqrt(sumSq / n);
    if (stds[j] < 1e-8) stds[j] = 1;
  }
  
  const normalized = vectors.map(v => 
    v.map((val, j) => (val - means[j]) / stds[j])
  );
  
  return { normalized, means, stds };
}

export function trainSimpleModel(dataset: MLDataset): LogisticRegressionModel | null {
  if (dataset.dataPoints.length < 10) {
    console.log("[ML] Not enough data points for training (need at least 10)");
    return null;
  }
  
  const featureNames = dataset.featureNames;
  const k = featureNames.length;
  const n = dataset.dataPoints.length;
  
  const { normalized, means, stds } = normalizeFeatures(dataset.dataPoints, featureNames);
  const labels = dataset.dataPoints.map(dp => dp.label);
  
  let weights = new Array(k).fill(0);
  let bias = 0;
  
  const learningRate = 0.1;
  const epochs = 100;
  const lambda = 0.01;
  
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(k).fill(0);
    let gradB = 0;
    
    for (let i = 0; i < n; i++) {
      const x = normalized[i];
      const y = labels[i];
      
      let z = bias;
      for (let j = 0; j < k; j++) {
        z += weights[j] * x[j];
      }
      const pred = sigmoid(z);
      const error = pred - y;
      
      for (let j = 0; j < k; j++) {
        gradW[j] += error * x[j];
      }
      gradB += error;
    }
    
    for (let j = 0; j < k; j++) {
      weights[j] -= learningRate * (gradW[j] / n + lambda * weights[j]);
    }
    bias -= learningRate * (gradB / n);
  }
  
  let correct = 0;
  for (let i = 0; i < n; i++) {
    let z = bias;
    for (let j = 0; j < k; j++) {
      z += weights[j] * normalized[i][j];
    }
    const pred = sigmoid(z) >= 0.5 ? 1 : 0;
    if (pred === labels[i]) correct++;
  }
  const trainingAccuracy = correct / n;
  
  const adjustedWeights = weights.map((w, j) => w / stds[j]);
  const adjustedBias = bias - weights.reduce((sum, w, j) => sum + w * means[j] / stds[j], 0);
  
  console.log(`[ML] Trained model: ${n} samples, accuracy=${(trainingAccuracy * 100).toFixed(1)}%`);
  
  return {
    weights: adjustedWeights,
    bias: adjustedBias,
    featureNames,
    trainedAt: new Date(),
    trainingAccuracy,
    symbolFilter: dataset.symbolFilter,
  };
}

function predictWithModel(model: LogisticRegressionModel, features: MLFeatures): number {
  const vector = featuresToVector(features, model.featureNames);
  let z = model.bias;
  for (let j = 0; j < model.weights.length; j++) {
    z += model.weights[j] * vector[j];
  }
  return sigmoid(z);
}

export function evaluateModel(model: LogisticRegressionModel, dataset: MLDataset): ModelEvaluation {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  
  for (const dp of dataset.dataPoints) {
    const prob = predictWithModel(model, dp.features);
    const pred = prob >= 0.5 ? 1 : 0;
    const actual = dp.label;
    
    if (pred === 1 && actual === 1) tp++;
    else if (pred === 0 && actual === 0) tn++;
    else if (pred === 1 && actual === 0) fp++;
    else fn++;
  }
  
  const accuracy = dataset.dataPoints.length > 0 ? (tp + tn) / dataset.dataPoints.length : 0;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1Score = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
  
  const featureImportance: Record<string, number> = {};
  const totalWeight = model.weights.reduce((sum, w) => sum + Math.abs(w), 0);
  for (let i = 0; i < model.featureNames.length; i++) {
    const importance = totalWeight > 0 ? Math.abs(model.weights[i]) / totalWeight : 0;
    featureImportance[model.featureNames[i]] = Math.round(importance * 100) / 100;
  }
  
  return {
    accuracy,
    precision,
    recall,
    f1Score,
    totalSamples: dataset.dataPoints.length,
    truePositives: tp,
    trueNegatives: tn,
    falsePositives: fp,
    falseNegatives: fn,
    featureImportance,
  };
}

export async function runMLEvaluation(options: {
  symbol?: string;
  lookbackDays?: number;
}): Promise<{
  success: boolean;
  error?: string;
  dataset?: MLDataset;
  model?: LogisticRegressionModel;
  evaluation?: ModelEvaluation;
}> {
  try {
    const dataset = await buildTrainingDataset(options);
    
    if (dataset.dataPoints.length < 10) {
      return {
        success: false,
        error: `Insufficient data for ML evaluation. Need at least 10 completed trades, found ${dataset.dataPoints.length}.`,
        dataset,
      };
    }
    
    const model = trainSimpleModel(dataset);
    if (!model) {
      return {
        success: false,
        error: "Failed to train model",
        dataset,
      };
    }
    
    const evaluation = evaluateModel(model, dataset);
    
    return {
      success: true,
      dataset,
      model,
      evaluation,
    };
  } catch (error) {
    console.error("[ML] Evaluation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during ML evaluation",
    };
  }
}
