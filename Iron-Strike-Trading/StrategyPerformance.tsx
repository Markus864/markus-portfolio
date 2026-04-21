import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { 
  Layers, TrendingUp, TrendingDown, DollarSign, Target,
  Activity, Award, Lock, Crown, Zap, AlertTriangle, Eye, Bot, Send, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";

type StrategyMetrics = {
  strategyId: number | null;
  strategyName: string;
  metrics: {
    winRate: number;
    lossRate: number;
    tradesCount: number;
    netPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    expectancy: number;
    avgRMultiple: number;
    maxDrawdown: number;
    avgHoldTime: number;
    disciplineScore: number;
    sharpeLike: number;
    avgConfidence: number;
  };
  timeSeries: Array<{ date: string; cumulativePnL: number; tradesCount: number }>;
  bestSymbol: { symbol: string; pnl: number } | null;
  worstSymbol: { symbol: string; pnl: number } | null;
  sharpeLike: number | null;
};

type StrategyResponse = {
  strategies: StrategyMetrics[];
  tier: string;
  range: string;
  limitedView?: boolean;
};

function StrategyCard({ 
  strategy, 
  onViewDetails 
}: { 
  strategy: StrategyMetrics; 
  onViewDetails: () => void;
}) {
  const { metrics } = strategy;
  const isPositive = metrics.netPnL >= 0;

  return (
    <Card className="hover-elevate cursor-pointer" onClick={onViewDetails} data-testid={`card-strategy-${strategy.strategyId || 'untagged'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{strategy.strategyName}</CardTitle>
          <Badge variant={isPositive ? "default" : "destructive"}>
            {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {isPositive ? "Profitable" : "Losing"}
          </Badge>
        </div>
        <CardDescription>{metrics.tradesCount} trades</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Win Rate</p>
            <p className={`text-lg font-bold font-mono ${metrics.winRate >= 0.5 ? 'text-green-500' : 'text-red-500'}`}>
              {(metrics.winRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Net P&L</p>
            <p className={`text-lg font-bold font-mono ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              ${metrics.netPnL.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Profit Factor</p>
            <p className={`text-lg font-bold font-mono ${metrics.profitFactor >= 1 ? 'text-green-500' : 'text-red-500'}`}>
              {(metrics.profitFactor ?? 0).toFixed(2)}
            </p>
          </div>
        </div>
        
        {strategy.timeSeries.length > 1 && (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={strategy.timeSeries}>
                <defs>
                  <linearGradient id={`gradient-${strategy.strategyId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="cumulativePnL" 
                  stroke={isPositive ? "#22c55e" : "#ef4444"} 
                  fill={`url(#gradient-${strategy.strategyId})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <Button variant="ghost" size="sm" className="w-full" data-testid={`button-view-${strategy.strategyId || 'untagged'}`}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

function StrategyDetailModal({ 
  strategy, 
  open, 
  onOpenChange 
}: { 
  strategy: StrategyMetrics; 
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { metrics, timeSeries, bestSymbol, worstSymbol } = strategy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{strategy.strategyName} Performance</DialogTitle>
          <DialogDescription>Detailed metrics and equity curve</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className={`text-xl font-bold font-mono ${metrics.winRate >= 0.5 ? 'text-green-500' : 'text-red-500'}`}>
                {(metrics.winRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Net P&L</p>
              <p className={`text-xl font-bold font-mono ${metrics.netPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${metrics.netPnL.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Profit Factor</p>
              <p className="text-xl font-bold font-mono">{(metrics.profitFactor ?? 0).toFixed(2)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Expectancy</p>
              <p className="text-xl font-bold font-mono">${(metrics.expectancy ?? 0).toFixed(2)}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Trades</p>
              <p className="text-xl font-bold font-mono">{metrics.tradesCount}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Avg R-Multiple</p>
              <p className="text-xl font-bold font-mono">{(metrics.avgRMultiple ?? 0).toFixed(2)}R</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Max Drawdown</p>
              <p className="text-xl font-bold font-mono text-red-500">{((metrics.maxDrawdown ?? 0) * 100).toFixed(1)}%</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Sharpe-Like</p>
              <p className="text-xl font-bold font-mono">{(metrics.sharpeLike ?? 0).toFixed(2)}</p>
            </div>
          </div>
          
          {timeSeries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis 
                      tickFormatter={(v) => `$${v}`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative P&L']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cumulativePnL" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {(bestSymbol || worstSymbol) && (
            <div className="grid grid-cols-2 gap-4">
              {bestSymbol && (
                <Card className="border-green-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-green-500" />
                      Best Performer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{bestSymbol.symbol}</p>
                    <p className="text-green-500 font-mono">+${(bestSymbol.pnl ?? 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
              )}
              {worstSymbol && (
                <Card className="border-red-500/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Worst Performer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold">{worstSymbol.symbol}</p>
                    <p className="text-red-500 font-mono">${(worstSymbol.pnl ?? 0).toFixed(2)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function StrategyPerformance() {
  const [range, setRange] = useState("30d");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyMetrics | null>(null);
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier: "free" | "pro" | "premium" = isDeveloper ? "premium" : tier;

  const allowedRanges = {
    free: ["30d"],
    pro: ["30d", "90d"],
    premium: ["30d", "90d", "180d", "1y"],
  };

  const tierRanges = allowedRanges[effectiveTier as keyof typeof allowedRanges] || allowedRanges.free;

  const { data, isLoading, error } = useQuery<StrategyResponse>({
    queryKey: ["/api/analytics/strategy-performance", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/strategy-performance?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch strategy performance");
      return res.json();
    },
  });

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

  if (tierLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans relative">
        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (effectiveTier === "free") {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans relative">
        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Layers className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Strategy Performance</h1>
              <p className="text-sm text-muted-foreground">Compare performance across your trading strategies</p>
            </div>
          </div>
          <UpgradeBanner 
            feature="strategy performance analytics"
            description="Upgrade to Pro to compare your trading strategies with equity curves, symbol breakdowns, and performance metrics."
            requiredTier="pro"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Layers className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Strategy Performance</h1>
              <p className="text-sm text-muted-foreground">
                Compare performance across your trading strategies
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36" data-testid="select-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d" disabled={!tierRanges.includes("90d")}>
                  Last 90 Days {!tierRanges.includes("90d") && <Lock className="inline h-3 w-3 ml-1" />}
                </SelectItem>
                <SelectItem value="180d" disabled={!tierRanges.includes("180d")}>
                  Last 180 Days {!tierRanges.includes("180d") && <Lock className="inline h-3 w-3 ml-1" />}
                </SelectItem>
                <SelectItem value="1y" disabled={!tierRanges.includes("1y")}>
                  Last Year {!tierRanges.includes("1y") && <Lock className="inline h-3 w-3 ml-1" />}
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Badge variant={effectiveTier === "premium" ? "default" : effectiveTier === "pro" ? "secondary" : "outline"}>
              {effectiveTier === "premium" ? (
                <><Crown className="h-3 w-3 mr-1" /> Premium</>
              ) : effectiveTier === "pro" ? (
                <><Zap className="h-3 w-3 mr-1" /> Pro</>
              ) : (
                "Free"
              )}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : error ? (
              <Card className="p-8 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-4" />
                <h3 className="font-semibold">Failed to load strategies</h3>
                <p className="text-sm text-muted-foreground">Please try again later</p>
              </Card>
            ) : data?.strategies.length === 0 ? (
              <Card className="p-8 text-center">
                <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold">No Strategy Data</h3>
                <p className="text-sm text-muted-foreground">
                  Tag your trades with strategies to see performance comparisons
                </p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data?.strategies.map((strategy) => (
                    <StrategyCard 
                      key={strategy.strategyId || 'untagged'} 
                      strategy={strategy}
                      onViewDetails={() => setSelectedStrategy(strategy)}
                    />
                  ))}
                </div>
                
                {data?.limitedView && (
                  <Card className="border-dashed p-4">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Lock className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Limited View</p>
                        <p className="text-sm">Upgrade to Pro for equity curves and detailed breakdowns</p>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
          
          <div className="space-y-6">
            <Card data-testid="card-coach">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Coach's Report Card
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {coachResponse && (
                  <div className="p-3 bg-muted rounded-lg text-sm text-foreground" data-testid="text-coach-response">
                    {coachResponse}
                  </div>
                )}
                <form onSubmit={handleCoachSubmit} className="flex gap-2">
                  <Input placeholder="Ask the coach..." value={coachMessage} onChange={(e) => setCoachMessage(e.target.value)} className="flex-1 text-sm" data-testid="input-coach-message" />
                  <Button type="submit" size="icon" disabled={coachMutation.isPending || !coachMessage.trim()} data-testid="button-coach-send">
                    {coachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {selectedStrategy && (
          <StrategyDetailModal 
            strategy={selectedStrategy}
            open={!!selectedStrategy}
            onOpenChange={(open) => !open && setSelectedStrategy(null)}
          />
        )}
      </div>
    </div>
  );
}
