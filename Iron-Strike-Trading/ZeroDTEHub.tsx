import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  AlertTriangle,
  Zap,
  Activity,
  BarChart3,
  RefreshCcw,
  Bot,
  Send,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ConfidenceBreakdown {
  marketStructure: number;
  optionsFlow: number;
  riskReward: number;
  liquidity: number;
}

interface ZeroDTESignal {
  id: number;
  symbol: string;
  action: string;
  optionType: string;
  strikePrice: number;
  currentPrice: number;
  premium: number;
  executionPrice?: number;
  bid?: number;
  ask?: number;
  spreadPercent?: number;
  confidence: number;
  confidenceGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
  confidenceBreakdown?: ConfidenceBreakdown;
  strategy?: string;
  strategyType?: string;
  expiration: string;
  delta: number;
  theta: number;
  gamma: number;
  iv: number;
  volume?: number;
  openInterest?: number;
  urgency: string;
  reasoning: string;
  entryTiming?: string;
  exitCriteria?: string;
  riskFactors?: string[];
  profitTarget?: number;
  stopLoss?: number;
  payoffRatio?: number;
  createdAt: string;
}

interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
}

interface ZeroDTEResponse {
  underlying: string;
  signals: ZeroDTESignal[];
  marketStatus: string;
  lastUpdated: string;
  quote: QuoteData | null;
}

export default function ZeroDTEHub() {
  const [selectedIndex, setSelectedIndex] = useState("SPY");
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const coachMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/chat", { message });
      return res.json();
    },
    onSuccess: (data) => {
      setCoachResponse(data.response || data.structured?.answer || "Ready to assist.");
    },
    onError: () => {
      setCoachResponse("Unable to process request. Try again.");
    }
  });

  const handleCoachSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachMessage.trim()) {
      coachMutation.mutate(coachMessage);
      setCoachMessage("");
    }
  };
  
  const { data: zeroDTEData, isLoading, refetch } = useQuery<ZeroDTEResponse>({
    queryKey: ["/api/signals/0dte", selectedIndex],
    queryFn: async () => {
      const res = await fetch(`/api/signals/0dte?underlying=${selectedIndex}`);
      if (!res.ok) throw new Error('Failed to fetch 0DTE signals');
      return res.json();
    },
    refetchInterval: 30000,
  });
  
  const signals = zeroDTEData?.signals || [];
  const quote = zeroDTEData?.quote;
  
  const currentPrice = quote?.price || (signals.length > 0 ? signals[0].currentPrice : 0);
  const changePercent = quote?.changePercent || 0;
  
  const getTimeUntilClose = () => {
    const now = new Date();
    const closeTime = new Date();
    closeTime.setUTCHours(21, 0, 0, 0);
    
    if (now > closeTime) {
      return { hours: 0, minutes: 0, isOpen: false };
    }
    
    const diff = closeTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes, isOpen: true };
  };
  
  const timeUntilClose = getTimeUntilClose();

  const indices = [
    { symbol: "SPY", name: "S&P 500 ETF" },
    { symbol: "QQQ", name: "Nasdaq 100 ETF" },
    { symbol: "IWM", name: "Russell 2000 ETF" },
    { symbol: "DIA", name: "Dow Jones ETF" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                0DTE Options Hub
              </h1>
              <p className="text-muted-foreground">
                Same-day expiration trades with high precision signals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="destructive" className="animate-pulse">
              <Activity className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-0dte"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <span className="text-foreground font-medium">High Risk Warning</span>
              </div>
              <span className="text-muted-foreground text-sm">
                0DTE options carry extreme risk. Time decay accelerates rapidly.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-iron-strike-coach">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Bot className="h-5 w-5 text-cyan-500" />
              </div>
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Vol Crush Predictor</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Analyze volatility crush potential on 0DTE options. Get AI-powered IV decay predictions.
            </p>
            <form onSubmit={handleCoachSubmit} className="flex gap-2">
              <Input
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
                placeholder="Ask about 0DTE volatility and timing..."
                className="flex-1"
                data-testid="input-coach-message"
              />
              <Button
                type="submit"
                size="icon"
                disabled={coachMutation.isPending || !coachMessage.trim()}
                data-testid="button-coach-submit"
              >
                {coachMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            {coachResponse && (
              <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground" data-testid="text-coach-response">
                {coachResponse}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs value={selectedIndex} onValueChange={setSelectedIndex}>
          <TabsList className="grid grid-cols-4">
            {indices.map((index) => (
              <TabsTrigger
                key={index.symbol}
                value={index.symbol}
                data-testid={`tab-${index.symbol}`}
              >
                {index.symbol}
              </TabsTrigger>
            ))}
          </TabsList>

          {indices.map((index) => (
            <TabsContent key={index.symbol} value={index.symbol} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-current-price">
                      {isLoading ? (
                        <Skeleton className="h-8 w-20 mx-auto" />
                      ) : currentPrice > 0 ? (
                        `$${currentPrice.toFixed(2)}`
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Current Price</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div 
                      className={`text-2xl font-bold font-mono ${
                        changePercent > 0 ? 'text-green-500' : changePercent < 0 ? 'text-red-400' : 'text-muted-foreground'
                      }`} 
                      data-testid="stat-todays-change"
                    >
                      {isLoading ? (
                        <Skeleton className="h-8 w-16 mx-auto" />
                      ) : quote ? (
                        `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Today's Change</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-active-signals">
                      {isLoading ? (
                        <Skeleton className="h-8 w-8 mx-auto" />
                      ) : (
                        signals.length
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Active Signals</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-400 font-mono flex items-center justify-center gap-1" data-testid="stat-until-close">
                      <Clock className="h-4 w-4" />
                      {timeUntilClose.isOpen ? (
                        `${timeUntilClose.hours}h ${timeUntilClose.minutes}m`
                      ) : (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Until Close</div>
                  </CardContent>
                </Card>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-32 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : signals.length > 0 ? (
                <div className="space-y-4">
                  {signals.map((signal) => {
                    const isBullish = signal.action.includes("CALL") || signal.action === "SELL_PUT";
                    const confidencePercent = signal.confidence > 1 ? signal.confidence : Math.round(signal.confidence * 100);
                    const gradeColors: Record<string, string> = {
                      'A': 'text-green-500 bg-green-500/20',
                      'B': 'text-blue-400 bg-blue-500/20',
                      'C': 'text-amber-400 bg-yellow-500/20',
                      'D': 'text-orange-400 bg-orange-500/20',
                      'F': 'text-red-400 bg-red-500/20',
                    };
                    const grade = signal.confidenceGrade || (confidencePercent >= 80 ? 'A' : confidencePercent >= 65 ? 'B' : confidencePercent >= 50 ? 'C' : confidencePercent >= 35 ? 'D' : 'F');
                    
                    return (
                      <Card 
                        key={signal.id}
                        className={`border-l-4 ${
                          signal.urgency === 'HIGH' 
                            ? 'border-l-orange-500' 
                            : signal.urgency === 'MEDIUM'
                            ? 'border-l-amber-400'
                            : 'border-l-green-500'
                        }`}
                        data-testid={`signal-card-${signal.id}`}
                      >
                        <CardContent className="p-4 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-2 rounded-lg ${isBullish ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                {isBullish ? (
                                  <TrendingUp className="h-5 w-5 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-foreground font-bold text-lg">{signal.symbol}</span>
                                  <Badge 
                                    variant="outline"
                                    className={isBullish ? 'text-green-500' : 'text-red-400'}
                                  >
                                    {signal.action.replace('_', ' ')}
                                  </Badge>
                                  {signal.strategy && (
                                    <Badge variant="outline" className="text-purple-400">
                                      {signal.strategy}
                                    </Badge>
                                  )}
                                  {signal.urgency === 'HIGH' && (
                                    <Badge variant="destructive" className="text-xs">
                                      <Zap className="h-3 w-3 mr-1" />
                                      URGENT
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1 font-mono">
                                  ${signal.strikePrice} Strike | ${signal.premium.toFixed(2)} Premium | Δ {signal.delta.toFixed(2)}
                                  {signal.bid !== undefined && signal.ask !== undefined && (
                                    <span className="text-muted-foreground"> | Bid/Ask: ${signal.bid.toFixed(2)}/${signal.ask.toFixed(2)}</span>
                                  )}
                                </div>
                                {signal.volume !== undefined && signal.openInterest !== undefined && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    Vol: {signal.volume.toLocaleString()} | OI: {signal.openInterest.toLocaleString()}
                                    {signal.spreadPercent !== undefined && (
                                      <span> | Spread: {signal.spreadPercent.toFixed(1)}%</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`px-3 py-1.5 rounded-md font-bold text-lg ${gradeColors[grade]}`}>
                                {grade}
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Confidence</div>
                                <span className={`font-mono font-bold ${confidencePercent >= 60 ? 'text-green-500' : confidencePercent >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                                  {confidencePercent}%
                                </span>
                                <Progress value={confidencePercent} className="h-1.5 w-20 mt-1" />
                              </div>
                            </div>
                          </div>
                          
                          {signal.confidenceBreakdown && (
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div className="bg-muted rounded p-2 text-center">
                                <div className="text-muted-foreground">Market</div>
                                <div className="text-foreground font-mono">{signal.confidenceBreakdown.marketStructure}%</div>
                              </div>
                              <div className="bg-muted rounded p-2 text-center">
                                <div className="text-muted-foreground">Flow</div>
                                <div className="text-foreground font-mono">{signal.confidenceBreakdown.optionsFlow}%</div>
                              </div>
                              <div className="bg-muted rounded p-2 text-center">
                                <div className="text-muted-foreground">Risk/Reward</div>
                                <div className="text-foreground font-mono">{signal.confidenceBreakdown.riskReward}%</div>
                              </div>
                              <div className="bg-muted rounded p-2 text-center">
                                <div className="text-muted-foreground">Liquidity</div>
                                <div className="text-foreground font-mono">{signal.confidenceBreakdown.liquidity}%</div>
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                            <div className="font-medium text-foreground mb-1">Why This Trade:</div>
                            {signal.reasoning}
                          </div>
                          
                          {(signal.entryTiming || signal.exitCriteria) && (
                            <div className="grid md:grid-cols-2 gap-3">
                              {signal.entryTiming && (
                                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                                  <div className="text-xs text-green-500 font-medium mb-1 flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Entry Timing
                                  </div>
                                  <div className="text-sm text-muted-foreground">{signal.entryTiming}</div>
                                </div>
                              )}
                              {signal.exitCriteria && (
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                                  <div className="text-xs text-blue-400 font-medium mb-1 flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    Exit Criteria
                                  </div>
                                  <div className="text-sm text-muted-foreground">{signal.exitCriteria}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {(signal.profitTarget || signal.stopLoss) && (
                            <div className="flex flex-wrap gap-4 text-sm">
                              {signal.profitTarget && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Target:</span>
                                  <span className="text-green-500 font-mono">${signal.profitTarget.toFixed(2)}</span>
                                </div>
                              )}
                              {signal.stopLoss && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Stop:</span>
                                  <span className="text-red-400 font-mono">${signal.stopLoss.toFixed(2)}</span>
                                </div>
                              )}
                              {signal.payoffRatio && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">R:R:</span>
                                  <span className="text-foreground font-mono">{signal.payoffRatio.toFixed(1)}:1</span>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {signal.riskFactors && signal.riskFactors.length > 0 && (
                            <div className="border-t border-border pt-3">
                              <div className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Risk Factors
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {signal.riskFactors.map((risk, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs text-muted-foreground">
                                    {risk}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Flame className="h-12 w-12 text-orange-400/50 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No {index.symbol} Signals Available
                    </h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Generate signals for {index.symbol} using the Signal Generator to see 0DTE opportunities here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-foreground" />
                Quick Scalps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Ultra-short term plays targeting 10-30% gains in minutes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-foreground" />
                Precision Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                AI-timed entries at key support/resistance levels.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-foreground" />
                Real-Time Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Live market flow and momentum indicators.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
