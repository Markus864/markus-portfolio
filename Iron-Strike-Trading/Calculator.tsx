import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, TrendingDown, Target, DollarSign, Percent, Activity, Gauge, BarChart3, PieChart } from "lucide-react";

type OptionType = "CALL" | "PUT";
type OptionSide = "LONG" | "SHORT";

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

interface BlackScholesResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

function blackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: OptionType
): BlackScholesResult {
  if (T <= 0) {
    const intrinsic = optionType === "CALL" 
      ? Math.max(0, S - K) 
      : Math.max(0, K - S);
    return {
      price: intrinsic,
      delta: optionType === "CALL" ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0
    };
  }

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  const Nd1 = normalCDF(d1);
  const Nd2 = normalCDF(d2);
  const Nnd1 = normalCDF(-d1);
  const Nnd2 = normalCDF(-d2);
  const nd1 = normalPDF(d1);
  
  let price: number;
  let delta: number;
  let rho: number;
  
  if (optionType === "CALL") {
    price = S * Nd1 - K * Math.exp(-r * T) * Nd2;
    delta = Nd1;
    rho = K * T * Math.exp(-r * T) * Nd2 / 100;
  } else {
    price = K * Math.exp(-r * T) * Nnd2 - S * Nnd1;
    delta = Nd1 - 1;
    rho = -K * T * Math.exp(-r * T) * Nnd2 / 100;
  }
  
  const gamma = nd1 / (S * sigma * Math.sqrt(T));
  const theta = -(S * nd1 * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * (optionType === "CALL" ? Nd2 : -Nnd2);
  const vega = S * Math.sqrt(T) * nd1 / 100;
  
  return { price, delta, gamma, theta: theta / 365, vega, rho };
}

function calculateImpliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  optionType: OptionType
): number {
  let sigma = 0.3;
  const tolerance = 0.0001;
  const maxIterations = 100;
  
  for (let i = 0; i < maxIterations; i++) {
    const result = blackScholes(S, K, T, r, sigma, optionType);
    const diff = result.price - marketPrice;
    
    if (Math.abs(diff) < tolerance) {
      return sigma;
    }
    
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const vega = S * Math.sqrt(T) * normalPDF(d1);
    
    if (vega < 0.0001) break;
    
    sigma = sigma - diff / vega;
    
    if (sigma <= 0.001) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }
  
  return sigma;
}

function calculateProbabilityOfProfit(
  S: number,
  K: number,
  T: number,
  sigma: number,
  premium: number,
  optionType: OptionType,
  optionSide: OptionSide
): number {
  if (T <= 0) return 0;
  
  const breakeven = optionType === "CALL" ? K + premium : K - premium;
  
  const d2 = (Math.log(S / breakeven) + (0 - (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const probAboveBreakeven = normalCDF(d2);
  const probBelowBreakeven = 1 - probAboveBreakeven;
  
  if (optionSide === "LONG") {
    return optionType === "CALL" 
      ? probAboveBreakeven * 100 
      : probBelowBreakeven * 100;
  } else {
    return optionType === "CALL" 
      ? probBelowBreakeven * 100 
      : probAboveBreakeven * 100;
  }
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  positive,
  neutral
}: { 
  title: string; 
  value: string; 
  description: string; 
  icon: typeof TrendingUp;
  positive?: boolean;
  neutral?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${
              neutral ? "text-foreground" : 
              positive ? "text-green-500" : "text-red-400"
            }`}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function GreeksDisplay({ delta, gamma, theta, vega, rho }: { 
  delta: number; 
  gamma: number; 
  theta: number; 
  vega: number;
  rho: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-foreground">Δ</span>
          <span className="text-xs text-muted-foreground">Delta</span>
        </div>
        <p className="text-xl font-mono font-bold text-foreground">
          {delta.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Price sensitivity</p>
      </div>
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-foreground">Γ</span>
          <span className="text-xs text-muted-foreground">Gamma</span>
        </div>
        <p className="text-xl font-mono font-bold text-foreground">
          {gamma.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Delta change rate</p>
      </div>
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-foreground">Θ</span>
          <span className="text-xs text-muted-foreground">Theta</span>
        </div>
        <p className={`text-xl font-mono font-bold ${theta < 0 ? "text-red-400" : "text-green-500"}`}>
          {theta.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Time decay/day</p>
      </div>
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-foreground">ν</span>
          <span className="text-xs text-muted-foreground">Vega</span>
        </div>
        <p className="text-xl font-mono font-bold text-foreground">
          {vega.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">IV sensitivity</p>
      </div>
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-foreground">ρ</span>
          <span className="text-xs text-muted-foreground">Rho</span>
        </div>
        <p className="text-xl font-mono font-bold text-foreground">
          {rho.toFixed(4)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Rate sensitivity</p>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  const [stockPrice, setStockPrice] = useState("100");
  const [strikePrice, setStrikePrice] = useState("100");
  const [daysToExpiry, setDaysToExpiry] = useState("30");
  const [volatility, setVolatility] = useState("30");
  const [riskFreeRate, setRiskFreeRate] = useState("5");
  const [optionType, setOptionType] = useState<OptionType>("CALL");
  const [optionSide, setOptionSide] = useState<OptionSide>("LONG");
  const [contracts, setContracts] = useState("1");
  const [marketPremium, setMarketPremium] = useState("");
  
  const calculations = useMemo(() => {
    const S = parseFloat(stockPrice) || 0;
    const K = parseFloat(strikePrice) || 0;
    const T = (parseFloat(daysToExpiry) || 0) / 365;
    const sigma = (parseFloat(volatility) || 0) / 100;
    const r = (parseFloat(riskFreeRate) || 0) / 100;
    const numContracts = parseInt(contracts) || 1;
    const multiplier = 100;
    
    if (S <= 0 || K <= 0 || T < 0 || sigma <= 0) {
      return null;
    }
    
    const bs = blackScholes(S, K, T, r, sigma, optionType);
    const premium = bs.price;
    const totalCost = premium * multiplier * numContracts;
    
    let maxLoss: number;
    let maxGain: number | string;
    let breakeven: number;
    
    if (optionSide === "LONG") {
      maxLoss = totalCost;
      if (optionType === "CALL") {
        maxGain = "Unlimited";
        breakeven = K + premium;
      } else {
        maxGain = (K - premium) * multiplier * numContracts;
        breakeven = K - premium;
      }
    } else {
      if (optionType === "CALL") {
        maxGain = totalCost;
        maxLoss = Infinity;
        breakeven = K + premium;
      } else {
        maxGain = totalCost;
        maxLoss = (K - premium) * multiplier * numContracts;
        breakeven = K - premium;
      }
    }
    
    const impliedVol = marketPremium 
      ? calculateImpliedVolatility(parseFloat(marketPremium), S, K, T, r, optionType)
      : null;
    
    const probProfit = calculateProbabilityOfProfit(S, K, T, sigma, premium, optionType, optionSide);
    
    const intrinsicValue = optionType === "CALL" 
      ? Math.max(0, S - K) 
      : Math.max(0, K - S);
    const extrinsicValue = premium - intrinsicValue;
    
    const moneyness = optionType === "CALL"
      ? S > K ? "ITM" : S < K ? "OTM" : "ATM"
      : S < K ? "ITM" : S > K ? "OTM" : "ATM";
    
    return {
      premium,
      totalCost,
      maxLoss,
      maxGain,
      breakeven,
      delta: bs.delta * (optionSide === "LONG" ? 1 : -1),
      gamma: bs.gamma,
      theta: bs.theta * (optionSide === "LONG" ? 1 : -1),
      vega: bs.vega,
      rho: bs.rho * (optionSide === "LONG" ? 1 : -1),
      impliedVol,
      probProfit,
      intrinsicValue,
      extrinsicValue,
      moneyness,
      numContracts,
      multiplier
    };
  }, [stockPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType, optionSide, contracts, marketPremium]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6" data-testid="calculator-page">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Options Tools</span>
              </div>
              <h1 className="text-2xl font-semibold text-foreground" data-testid="text-calculator-title">Options Calculator</h1>
              <p className="text-sm text-muted-foreground">Calculate premium, Greeks, IV, and probability of profit</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-foreground" />
                Input Parameters
              </CardTitle>
              <CardDescription>Enter option details for calculations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Option Type</Label>
                  <Select value={optionType} onValueChange={(v) => setOptionType(v as OptionType)}>
                    <SelectTrigger data-testid="select-option-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">CALL</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Position</Label>
                  <Select value={optionSide} onValueChange={(v) => setOptionSide(v as OptionSide)}>
                    <SelectTrigger data-testid="select-option-side">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LONG">LONG (Buy)</SelectItem>
                      <SelectItem value="SHORT">SHORT (Sell)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Stock Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={stockPrice}
                  onChange={(e) => setStockPrice(e.target.value)}
                  className="font-mono"
                  data-testid="input-stock-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Strike Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={strikePrice}
                  onChange={(e) => setStrikePrice(e.target.value)}
                  className="font-mono"
                  data-testid="input-strike-price"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Days to Expiration</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={daysToExpiry}
                  onChange={(e) => setDaysToExpiry(e.target.value)}
                  className="font-mono"
                  data-testid="input-days-to-expiry"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Implied Volatility (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={volatility}
                  onChange={(e) => setVolatility(e.target.value)}
                  className="font-mono"
                  data-testid="input-volatility"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Risk-Free Rate (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={riskFreeRate}
                  onChange={(e) => setRiskFreeRate(e.target.value)}
                  className="font-mono"
                  data-testid="input-risk-free-rate"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Number of Contracts</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={contracts}
                  onChange={(e) => setContracts(e.target.value)}
                  className="font-mono"
                  data-testid="input-contracts"
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Market Premium (optional, for IV calc)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter market price to calculate IV"
                  value={marketPremium}
                  onChange={(e) => setMarketPremium(e.target.value)}
                  className="font-mono"
                  data-testid="input-market-premium"
                />
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            {calculations && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    title="Premium"
                    value={`$${calculations.premium.toFixed(2)}`}
                    description={`Per share price`}
                    icon={DollarSign}
                    neutral
                  />
                  <StatCard
                    title="Total Cost"
                    value={`$${calculations.totalCost.toFixed(2)}`}
                    description={`${calculations.numContracts} contract${calculations.numContracts > 1 ? 's' : ''}`}
                    icon={DollarSign}
                    neutral
                  />
                  <StatCard
                    title="Max Loss"
                    value={calculations.maxLoss === Infinity ? "Unlimited" : `$${calculations.maxLoss.toFixed(2)}`}
                    description={optionSide === "SHORT" && optionType === "CALL" ? "Naked call risk" : "Maximum risk"}
                    icon={TrendingDown}
                    positive={false}
                  />
                  <StatCard
                    title="Max Gain"
                    value={typeof calculations.maxGain === "string" ? calculations.maxGain : `$${calculations.maxGain.toFixed(2)}`}
                    description={optionSide === "LONG" && optionType === "CALL" ? "Unlimited upside" : "Maximum profit"}
                    icon={TrendingUp}
                    positive
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    title="Breakeven"
                    value={`$${calculations.breakeven.toFixed(2)}`}
                    description="At expiration"
                    icon={Target}
                    neutral
                  />
                  <StatCard
                    title="Prob. of Profit"
                    value={`${calculations.probProfit.toFixed(1)}%`}
                    description="At expiration"
                    icon={Percent}
                    positive={calculations.probProfit > 50}
                  />
                  <StatCard
                    title="Intrinsic"
                    value={`$${calculations.intrinsicValue.toFixed(2)}`}
                    description={calculations.moneyness}
                    icon={BarChart3}
                    neutral
                  />
                  <StatCard
                    title="Extrinsic"
                    value={`$${calculations.extrinsicValue.toFixed(2)}`}
                    description="Time value"
                    icon={PieChart}
                    neutral
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-foreground" />
                      Option Greeks
                    </CardTitle>
                    <CardDescription>Sensitivity measures for the option</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GreeksDisplay
                      delta={calculations.delta}
                      gamma={calculations.gamma}
                      theta={calculations.theta}
                      vega={calculations.vega}
                      rho={calculations.rho}
                    />
                  </CardContent>
                </Card>

                {calculations.impliedVol && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Activity className="h-5 w-5 text-foreground" />
                        Implied Volatility from Market Price
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="text-3xl font-bold font-mono text-foreground">
                          {(calculations.impliedVol * 100).toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Based on market premium of ${parseFloat(marketPremium).toFixed(2)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-foreground">Position Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <Badge variant={optionSide === "LONG" ? "default" : "destructive"} className="text-sm">
                        {optionSide}
                      </Badge>
                      <Badge variant={optionType === "CALL" ? "default" : "secondary"} className="text-sm">
                        {optionType}
                      </Badge>
                      <Badge variant="outline" className={`text-sm ${
                        calculations.moneyness === "ITM" ? "text-green-500" :
                        calculations.moneyness === "OTM" ? "text-red-400" :
                        "text-amber-400"
                      }`}>
                        {calculations.moneyness}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {optionSide === "LONG" 
                        ? `Buying ${calculations.numContracts} ${optionType.toLowerCase()} contract${calculations.numContracts > 1 ? 's' : ''} at $${strikePrice} strike for $${calculations.premium.toFixed(2)} per share ($${calculations.totalCost.toFixed(2)} total).`
                        : `Selling ${calculations.numContracts} ${optionType.toLowerCase()} contract${calculations.numContracts > 1 ? 's' : ''} at $${strikePrice} strike for $${calculations.premium.toFixed(2)} per share ($${calculations.totalCost.toFixed(2)} credit).`
                      }
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
