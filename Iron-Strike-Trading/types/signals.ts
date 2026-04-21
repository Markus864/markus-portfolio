export type Bias = "BUY_CALL" | "BUY_PUT" | "NO_TRADE";
export type Direction = "CALL" | "PUT";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ExpirationWindow = "0dte" | "1w" | "2w" | "3w" | "1m";

export interface RecommendedTrade {
  expiration: ExpirationWindow;
  direction: Direction;
  rationale: string;
  target_strike: number;
  approx_delta: number;
  stop_loss_price: number;
  take_profit_price: number;
  risk_level: RiskLevel;
}

export interface SymbolSignal {
  symbol: string;
  bias: Bias;
  confidence: number;
  summary: string;
  technical_reasoning: string[];
  recommended_trades: RecommendedTrade[];
  risk_notes: string[];
}

export interface SignalsResponse {
  symbols: SymbolSignal[];
}

export interface GenerateSignalsPayload {
  symbols: string[];
  expirationWindows?: ExpirationWindow[];
}
