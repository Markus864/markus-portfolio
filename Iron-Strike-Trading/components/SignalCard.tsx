import { TradingSignal, SelectedContract, PositionPreview, RiskProfileName } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Sparkles, PlayCircle, Calendar, Target, AlertTriangle, DollarSign, Clock, BarChart3, AlertCircle, ArrowRight, Lightbulb, Lock, Crown } from "lucide-react";
import { PriceChart } from "./PriceChart";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type DataTier = "free" | "pro" | "premium";

interface ExpirationOption {
  label: string;
  days: number;
  expirationDate: string;
  premium: number;
  contracts: number;
  totalCost: number;
  maxLoss: number;
  maxGain: string;
  breakeven: number;
  greeks: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  };
}

interface AlternativeStock {
  symbol: string;
  sector: string;
  industry: string;
  estimatedPrice: number;
  reason: string;
}

interface ExtendedSignal extends TradingSignal {
  expirationOptions?: ExpirationOption[];
  stopLossPrice?: number;
  takeProfitPrice?: number;
  patternAnalysis?: string;
  preferredExpiry?: string;
  isUnaffordable?: boolean;
  unaffordableReason?: string;
  suggestedAlternatives?: AlternativeStock[];
  maxAffordableStockPrice?: number;
  selectedContract?: SelectedContract | null;
  positionPreview?: PositionPreview | null;
  riskProfileUsed?: RiskProfileName | null;
  effectiveRiskPercent?: number | null;
  riskViolation?: boolean;
  dataTier?: DataTier;
  adaptiveNote?: string | null;
}

function UpgradePrompt({ tier, feature, featureId }: { tier: DataTier; feature: string; featureId: string }) {
  const nextTier = tier === "free" ? "Pro" : "Premium";
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted p-3 text-center" data-testid={`upgrade-prompt-${featureId}`}>
      <div className="flex items-center justify-center gap-2 text-amber-400 mb-1">
        <Lock className="h-4 w-4" />
        <span className="text-sm font-medium">{nextTier} Feature</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Upgrade to {nextTier} to unlock {feature}
      </p>
    </div>
  );
}

function GreeksUpgradeHint() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted p-2 text-center" data-testid="upgrade-hint-greeks">
      <div className="flex items-center justify-center gap-2 text-amber-400">
        <Crown className="h-3 w-3" />
        <span className="text-xs font-medium">Upgrade to Premium for Greeks (Delta, Gamma, Theta, Vega)</span>
      </div>
    </div>
  );
}

interface SignalCardProps {
  signal: ExtendedSignal;
  index: number;
  signalId?: number;
  accountSize?: number;
}

export function SignalCard({ signal, index, signalId, accountSize }: SignalCardProps) {
  const { toast } = useToast();
  const [selectedExpiry, setSelectedExpiry] = useState<string>(
    signal.expirationOptions?.[0]?.label || "1 Week"
  );
  
  const sc = signal.selectedContract;
  const pv = signal.positionPreview;
  const tier = signal.dataTier || "premium";
  const isFree = tier === "free";
  const isPro = tier === "pro";
  const isPremium = tier === "premium";
  
  const actionConfig = {
    BUY_CALL: {
      color: "bg-muted text-green-500",
      icon: TrendingUp,
      variant: "secondary" as const,
      label: "BUY CALL",
    },
    BUY_PUT: {
      color: "bg-muted text-red-400",
      icon: TrendingDown,
      variant: "secondary" as const,
      label: "BUY PUT",
    },
    SELL_CALL: {
      color: "bg-muted text-blue-400",
      icon: TrendingDown,
      variant: "secondary" as const,
      label: "SELL CALL",
    },
    SELL_PUT: {
      color: "bg-muted text-purple-400",
      icon: TrendingUp,
      variant: "secondary" as const,
      label: "SELL PUT",
    },
    HOLD: {
      color: "bg-muted text-muted-foreground",
      icon: Minus,
      variant: "secondary" as const,
      label: "HOLD",
    },
    NO_TRADE: {
      color: "bg-muted text-muted-foreground",
      icon: Minus,
      variant: "secondary" as const,
      label: "NO TRADE",
    },
  };

  const getSelectedOption = () => {
    if (signal.expirationOptions && signal.expirationOptions.length > 0) {
      return signal.expirationOptions.find(opt => opt.label === selectedExpiry) || signal.expirationOptions[0];
    }
    return null;
  };

  const hasContractData = signal.strikePrice != null && 
    signal.premium != null && 
    signal.contracts != null;

  const executeTradeMutation = useMutation({
    mutationFn: async () => {
      if (!hasContractData) {
        throw new Error("Cannot execute trade: contract data not available in strategy-only mode");
      }

      const selectedOption = getSelectedOption();
      const tradeData = selectedOption ? {
        signalId: signalId || 0,
        symbol: signal.symbol,
        action: signal.action,
        optionType: signal.optionType,
        optionSide: signal.optionSide,
        strikePrice: signal.strikePrice!.toString(),
        expirationDate: selectedOption.expirationDate,
        entryPremium: selectedOption.premium.toString(),
        contracts: selectedOption.contracts,
        contractMultiplier: signal.contractMultiplier,
        totalCost: selectedOption.totalCost.toString(),
        targetPremiumPercent: signal.takeProfitPercent,
        stopLossPremiumPercent: signal.stopLossPercent,
        status: "open",
      } : {
        signalId: signalId || 0,
        symbol: signal.symbol,
        action: signal.action,
        optionType: signal.optionType,
        optionSide: signal.optionSide,
        strikePrice: signal.strikePrice!.toString(),
        expirationDate: signal.expirationDate,
        entryPremium: signal.premium!.toString(),
        contracts: signal.contracts,
        contractMultiplier: signal.contractMultiplier,
        totalCost: signal.totalCost!.toString(),
        targetPremiumPercent: signal.takeProfitPercent,
        stopLossPremiumPercent: signal.stopLossPercent,
        status: "open",
      };
      const response = await apiRequest("POST", "/api/trades", tradeData);
      return response.json();
    },
    onSuccess: () => {
      const selectedOption = getSelectedOption();
      queryClient.invalidateQueries({ queryKey: ["/api/trades/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      const contracts = selectedOption?.contracts ?? signal.contracts ?? 0;
      const premium = selectedOption?.premium ?? signal.premium ?? 0;
      const strikeDisplay = signal.strikePrice != null ? `$${signal.strikePrice}` : '';
      toast({
        title: "Options Trade Executed",
        description: `${signal.action} ${contracts} contract(s) of ${signal.symbol} ${strikeDisplay} ${signal.optionType || ''} @ $${premium.toFixed(2)}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Execute Trade",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const config = actionConfig[signal.action];
  const ActionIcon = config.icon;
  const confidencePercent = signal.confidence * 100;

  const formatExpiry = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  };

  return (
    <Card
      className="overflow-visible hover-elevate active-elevate-2 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: `${index * 50}ms` }}
      data-testid={`card-signal-${signal.symbol}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className="text-sm font-bold tracking-wide px-3 py-1"
            data-testid={`badge-symbol-${signal.symbol}`}
          >
            {signal.symbol}
          </Badge>
          {signal.strikePrice != null && signal.optionType && (
            <Badge
              variant="outline"
              className="gap-1 text-xs"
            >
              ${signal.strikePrice} {signal.optionType}
            </Badge>
          )}
          {signal.optionType && !signal.strikePrice && (
            <Badge
              variant="outline"
              className="gap-1 text-xs"
            >
              {signal.optionType}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="gap-1 text-xs"
            data-testid={`badge-ai-${signal.symbol}`}
          >
            <Sparkles className="h-3 w-3" />
            AI
          </Badge>
        </div>
        <Badge
          variant={config.variant}
          className="gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wide whitespace-nowrap"
          data-testid={`badge-action-${signal.symbol}`}
        >
          <ActionIcon className="h-3.5 w-3.5" />
          {config.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {signal.isUnaffordable && (
          <Alert variant="destructive" className="border-border bg-muted" data-testid={`alert-unaffordable-${signal.symbol}`}>
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertTitle className="text-amber-400 font-semibold">Insufficient Account Balance</AlertTitle>
            <AlertDescription className="text-muted-foreground space-y-3">
              <p>{signal.unaffordableReason}</p>
              
              {signal.suggestedAlternatives && signal.suggestedAlternatives.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-400 mb-2">
                    <Lightbulb className="h-3 w-3" />
                    Affordable Alternatives
                  </div>
                  <div className="space-y-2">
                    {signal.suggestedAlternatives.slice(0, 5).map((alt, idx) => (
                      <div 
                        key={alt.symbol}
                        className="flex items-center justify-between p-2 bg-background/50 rounded-md border border-border/50"
                        data-testid={`alternative-${alt.symbol}`}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold">
                            {alt.symbol}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {alt.industry}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            ~${alt.estimatedPrice.toFixed(0)}
                          </span>
                          <ArrowRight className="h-3 w-3 text-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {signal.maxAffordableStockPrice && (
                    <p className="text-xs text-muted-foreground mt-2">
                      With your account, you can afford options on stocks up to ~${signal.maxAffordableStockPrice.toFixed(0)}/share
                    </p>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">
              Confidence
            </span>
            <span
              className="font-mono font-semibold text-foreground"
              data-testid={`text-confidence-${signal.symbol}`}
            >
              {confidencePercent.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={confidencePercent}
            className="h-2"
            data-testid={`progress-confidence-${signal.symbol}`}
          />
          {signal.adaptiveNote && !isFree && (
            <p 
              className="text-xs text-muted-foreground mt-1 flex items-center gap-1"
              data-testid={`text-adaptive-${signal.symbol}`}
            >
              <Sparkles className="h-3 w-3 text-foreground" />
              <span className="text-muted-foreground">Adaptive:</span> {signal.adaptiveNote}
            </p>
          )}
        </div>

        {isFree ? (
          <UpgradePrompt tier={tier} feature="contract details" featureId="contract-details" />
        ) : sc && (
          <div className="mt-4 rounded-xl border bg-muted/40 p-3 text-sm space-y-2" data-testid={`contract-summary-${signal.symbol}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium">Contract</span>
              <Badge variant="outline" className="text-xs font-semibold">
                {signal.action === "BUY_CALL" || signal.action === "SELL_CALL" ? "Call" : "Put"}
              </Badge>
            </div>
            <p className="font-mono text-base font-semibold" data-testid={`text-contract-desc-${signal.symbol}`}>
              {signal.symbol} {sc.strike} {sc.type.toUpperCase()} – Exp {sc.expirationDate}
            </p>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Premium (mid)</span>
              <span className="font-mono font-semibold text-foreground" data-testid={`text-contract-premium-${signal.symbol}`}>
                ${sc.mid?.toFixed(2) ?? "N/A"}
              </span>
            </div>
            {isPremium && sc.delta !== null ? (
              <div className="grid grid-cols-4 gap-2 text-xs text-center pt-2 border-t border-border/50">
                <div>
                  <p className="text-muted-foreground">Delta</p>
                  <p className="font-mono font-semibold">{sc.delta?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gamma</p>
                  <p className="font-mono font-semibold">{sc.gamma?.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Theta</p>
                  <p className="font-mono font-semibold">{sc.theta?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vega</p>
                  <p className="font-mono font-semibold">{sc.vega?.toFixed(2)}</p>
                </div>
              </div>
            ) : isPro && sc.delta !== null ? (
              <div className="pt-2 border-t border-border/50">
                <GreeksUpgradeHint />
              </div>
            ) : null}
          </div>
        )}

        {!isFree && (signal.contracts != null || signal.isUnaffordable === true || pv != null) && (
          <div className="mt-3 rounded-xl border bg-background p-3 text-xs space-y-2" data-testid={`position-sizing-${signal.symbol}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Position Sizing</span>
              {signal.riskProfileUsed && (
                <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
                  {signal.riskProfileUsed}
                </Badge>
              )}
            </div>

            {signal.effectiveRiskPercent != null && accountSize && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Risk Budget ({(signal.effectiveRiskPercent * 100).toFixed(1)}% of ${accountSize.toLocaleString()})</span>
                <span className="font-mono font-semibold text-foreground" data-testid={`text-risk-budget-${signal.symbol}`}>
                  ${(accountSize * signal.effectiveRiskPercent).toFixed(0)}
                </span>
              </div>
            )}

            {signal.isUnaffordable && pv ? (
              <Alert variant="destructive" className="border-border bg-muted mt-2" data-testid={`alert-position-unaffordable-${signal.symbol}`}>
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertTitle className="text-red-400 font-semibold text-xs">Cannot Afford Even 1 Contract</AlertTitle>
                <AlertDescription className="text-muted-foreground text-xs">
                  This setup costs <span className="font-mono font-semibold">${pv.costPerContract.toFixed(0)}</span> per contract, 
                  which exceeds your account size of <span className="font-mono font-semibold">${accountSize?.toLocaleString() ?? "N/A"}</span>. 
                  Consider lower-priced underlyings or increasing your account size.
                </AlertDescription>
              </Alert>
            ) : signal.riskViolation && pv ? (
              <>
                <Alert className="border-border bg-muted mt-2" data-testid={`alert-risk-violation-${signal.symbol}`}>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertTitle className="text-amber-400 font-semibold text-xs">Outside Risk Profile (Advisory Override)</AlertTitle>
                  <AlertDescription className="text-muted-foreground text-xs space-y-2">
                    <p>
                      This trade risks <span className="font-mono font-semibold">${pv.costPerContract.toFixed(0)}</span> per contract 
                      vs your risk budget of <span className="font-mono font-semibold">
                        ${accountSize && signal.effectiveRiskPercent ? (accountSize * signal.effectiveRiskPercent).toFixed(0) : "N/A"}
                      </span> ({signal.riskProfileUsed} profile).
                    </p>
                    <p>
                      Sized at <span className="font-mono font-semibold">1 contract</span> anyway. Proceed only if you accept the elevated risk.
                    </p>
                  </AlertDescription>
                </Alert>
                {signal.contracts != null && signal.contracts > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <p className="text-muted-foreground">Contracts</p>
                      <p className="font-mono text-lg font-semibold text-amber-400" data-testid={`text-position-contracts-${signal.symbol}`}>
                        {signal.contracts}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Cost</p>
                      <p className="font-mono text-lg font-semibold text-amber-400" data-testid={`text-position-cost-${signal.symbol}`}>
                        ${signal.totalCost?.toLocaleString() ?? "N/A"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {signal.contracts != null && signal.contracts > 0 && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <p className="text-muted-foreground">Contracts</p>
                      <p className="font-mono text-lg font-semibold text-foreground" data-testid={`text-position-contracts-${signal.symbol}`}>
                        {signal.contracts}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Cost</p>
                      <p className="font-mono text-lg font-semibold text-foreground" data-testid={`text-position-cost-${signal.symbol}`}>
                        ${signal.totalCost?.toLocaleString() ?? "N/A"}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!isFree && signal.patternAnalysis && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
              <BarChart3 className="h-3 w-3" />
              Analysis & Insights
            </p>
            <div className="space-y-3 text-sm">
              {signal.patternAnalysis.split('---').map((section: string, sectionIndex: number) => {
                const trimmedSection = section.trim();
                if (!trimmedSection) return null;
                
                const lines = trimmedSection.split('\n').filter((line: string) => line.trim());
                const headerLine = lines.find((line: string) => line.startsWith('###'));
                const header = headerLine?.replace(/^###\s*/, '').trim();
                const content = lines.filter((line: string) => !line.startsWith('###'));
                
                return (
                  <div key={sectionIndex} className="space-y-1.5">
                    {header && (
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {header}
                      </h4>
                    )}
                    <div className="space-y-1">
                      {content.map((line: string, lineIndex: number) => {
                        const cleanLine = line.replace(/^[-*]\s*/, '').trim();
                        if (!cleanLine) return null;
                        
                        const boldMatch = cleanLine.match(/^\*\*([^*]+)\*\*:\s*(.+)/);
                        if (boldMatch) {
                          return (
                            <p key={lineIndex} className="text-muted-foreground">
                              <span className="font-medium text-foreground">{boldMatch[1]}:</span>{' '}
                              {boldMatch[2]}
                            </p>
                          );
                        }
                        
                        return (
                          <p key={lineIndex} className="text-muted-foreground">
                            {cleanLine.startsWith('-') ? cleanLine.substring(1).trim() : cleanLine}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isFree && signal.expirationOptions && signal.expirationOptions.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
              <Clock className="h-3 w-3" />
              Expiration Options
            </p>
            <Tabs value={selectedExpiry} onValueChange={setSelectedExpiry}>
              <TabsList className="grid w-full grid-cols-5 h-8">
                {signal.expirationOptions.map((opt) => (
                  <TabsTrigger 
                    key={opt.label} 
                    value={opt.label}
                    className="text-xs px-1"
                    data-testid={`tab-expiry-${opt.label.replace(/\s/g, "-")}`}
                  >
                    {opt.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {signal.expirationOptions.map((opt) => (
                <TabsContent key={opt.label} value={opt.label} className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Premium
                      </p>
                      <p className="font-mono text-lg font-semibold" data-testid={`text-premium-${signal.symbol}`}>
                        ${opt.premium.toFixed(2)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Contracts
                      </p>
                      <p className="font-mono text-lg font-semibold" data-testid={`text-contracts-${signal.symbol}`}>
                        {opt.contracts}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Total Cost
                      </p>
                      <p className="font-mono text-lg font-semibold" data-testid={`text-totalcost-${signal.symbol}`}>
                        ${opt.totalCost.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Expiration
                      </p>
                      <p className="font-mono text-base font-semibold" data-testid={`text-expiry-${signal.symbol}`}>
                        {formatExpiry(opt.expirationDate)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Breakeven
                      </p>
                      <p className="font-mono text-base font-semibold" data-testid={`text-breakeven-${signal.symbol}`}>
                        ${opt.breakeven.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Max Loss
                      </p>
                      <p className="font-mono text-base font-semibold text-destructive" data-testid={`text-maxloss-${signal.symbol}`}>
                        ${opt.maxLoss.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Max Gain
                      </p>
                      <p className="font-mono text-base font-semibold text-chart-2" data-testid={`text-maxgain-${signal.symbol}`}>
                        {opt.maxGain === "Unlimited" ? "Unlimited" : `$${parseFloat(opt.maxGain).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {isPremium ? (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Delta</p>
                        <p className="font-mono text-sm font-semibold">{opt.greeks.delta.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Gamma</p>
                        <p className="font-mono text-sm font-semibold">{opt.greeks.gamma.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Theta</p>
                        <p className="font-mono text-sm font-semibold">{opt.greeks.theta.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Vega</p>
                        <p className="font-mono text-sm font-semibold">{opt.greeks.vega.toFixed(2)}</p>
                      </div>
                    </div>
                  ) : (
                    <GreeksUpgradeHint />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {!isFree && (signal.stopLossPrice != null || signal.takeProfitPrice != null) && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            {signal.stopLossPrice != null && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Stop Loss Price
                </p>
                <p className="font-mono text-base font-semibold text-destructive" data-testid={`text-stoploss-${signal.symbol}`}>
                  ${signal.stopLossPrice.toFixed(2)}
                </p>
              </div>
            )}
            {signal.takeProfitPrice != null && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Take Profit Price
                </p>
                <p className="font-mono text-base font-semibold text-chart-2" data-testid={`text-takeprofit-${signal.symbol}`}>
                  ${signal.takeProfitPrice.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        {!isFree ? (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Price Trend (1M)
            </p>
            <PriceChart symbol={signal.symbol} currentPrice={signal.currentPrice} compact />
          </div>
        ) : (
          <div className="pt-2 border-t">
            <UpgradePrompt tier={tier} feature="price charts and analysis" featureId="price-charts" />
          </div>
        )}

        {signal.reasoning && (
          <div className="pt-2 border-t">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
              AI Options Analysis
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {signal.reasoning}
            </p>
          </div>
        )}

        <div className="pt-3 border-t mt-2" data-testid={`disclaimer-${signal.symbol}`}>
          <p className="text-xs text-muted-foreground/70 text-center">
            Educational use only. Not financial advice. Options trading involves substantial risk.
          </p>
        </div>

      </CardContent>
    </Card>
  );
}
