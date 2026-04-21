import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { 
  Users, Bot, TrendingUp, TrendingDown, 
  AlertTriangle, Lock, Crown, Zap, Target, Award, Send, Loader2
} from "lucide-react";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { apiRequest } from "@/lib/queryClient";

type MetricsSet = {
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

type TimeSeriesPoint = {
  date: string;
  aiPnL: number;
  userPnL: number;
};

type UserVsAIResponse = {
  aiBaseline: MetricsSet;
  userTakenTrades: MetricsSet;
  userManualTrades: MetricsSet;
  edge: number;
  takenCount: number;
  manualCount: number;
  skippedCount: number;
  timeSeries: TimeSeriesPoint[];
  tier: string;
  range: string;
  limitedView?: boolean;
};

function ComparisonCard({ 
  title, 
  aiValue, 
  userValue, 
  format = "percent",
  higherIsBetter = true,
}: { 
  title: string; 
  aiValue: number; 
  userValue: number;
  format?: "percent" | "currency" | "ratio";
  higherIsBetter?: boolean;
}) {
  const formatValue = (v: number) => {
    if (!isFinite(v)) return "--";
    switch (format) {
      case "percent": return `${(v * 100).toFixed(1)}%`;
      case "currency": return `$${v.toFixed(2)}`;
      case "ratio": return v.toFixed(2);
      default: return v.toFixed(2);
    }
  };

  const diff = userValue - aiValue;
  const userWins = higherIsBetter ? diff > 0 : diff < 0;

  return (
    <Card data-testid={`comparison-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Bot className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">AI</span>
            </div>
            <p className="text-lg font-bold font-mono">{formatValue(aiValue)}</p>
          </div>
          
          <div className="text-center">
            <Badge 
              variant="secondary"
              className={userWins ? "text-green-500" : ""}
            >
              {userWins ? (
                <>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +{Math.abs(diff * (format === "percent" ? 100 : 1)).toFixed(1)}{format === "percent" ? "%" : ""}
                </>
              ) : diff === 0 ? (
                "="
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 mr-1" />
                  {Math.abs(diff * (format === "percent" ? 100 : 1)).toFixed(1)}{format === "percent" ? "%" : ""}
                </>
              )}
            </Badge>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users className="h-4 w-4 text-foreground" />
              <span className="text-xs text-muted-foreground">You</span>
            </div>
            <p className={`text-lg font-bold font-mono ${userWins ? 'text-green-500' : ''}`}>
              {formatValue(userValue)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EquityComparison({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equity Comparison</CardTitle>
          <CardDescription>Cumulative P&L over time</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">Insufficient data for comparison</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="chart-equity-comparison">
      <CardHeader>
        <CardTitle className="text-lg">Equity Comparison</CardTitle>
        <CardDescription>Cumulative P&L: AI baseline vs your trades</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
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
              formatter={(value: number, name: string) => [
                `$${value.toFixed(2)}`, 
                name === 'aiPnL' ? 'AI Baseline' : 'Your Trades'
              ]}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="aiPnL" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
              name="AI Baseline"
            />
            <Line 
              type="monotone" 
              dataKey="userPnL" 
              stroke="#22c55e" 
              strokeWidth={2}
              dot={false}
              name="Your Trades"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TradeBreakdown({ 
  takenCount, 
  manualCount, 
  skippedCount 
}: { 
  takenCount: number; 
  manualCount: number; 
  skippedCount: number;
}) {
  const total = takenCount + manualCount + skippedCount;
  if (total === 0) return null;

  const data = [
    { name: "AI Taken", value: takenCount, color: "#22c55e" },
    { name: "Manual", value: manualCount, color: "#3b82f6" },
    { name: "Skipped", value: skippedCount, color: "#6b7280" },
  ];

  return (
    <Card data-testid="chart-trade-breakdown">
      <CardHeader>
        <CardTitle className="text-lg">Trade Breakdown</CardTitle>
        <CardDescription>How you use AI signals</CardDescription>
      </CardHeader>
      <CardContent className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={70} />
            <Tooltip 
              formatter={(value: number) => [value, 'Trades']}
              contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]}
              fill="hsl(var(--primary))"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function UserVsAI() {
  const [range, setRange] = useState("30d");
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier = isDeveloper ? "premium" : tier;

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

  const allowedRanges = {
    free: ["30d"],
    pro: ["30d", "90d"],
    premium: ["30d", "90d", "180d", "1y"],
  };

  const tierRanges = allowedRanges[effectiveTier as keyof typeof allowedRanges] || allowedRanges.free;

  const { data, isLoading, error } = useQuery<UserVsAIResponse>({
    queryKey: ["/api/analytics/user-vs-ai", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/user-vs-ai?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch comparison data");
      return res.json();
    },
  });

  if (tierLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (effectiveTier === "free") {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-7xl mx-auto p-6 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Man vs. Machine</h1>
              <p className="text-sm text-muted-foreground">Compare your trading decisions against AI recommendations</p>
            </div>
          </div>
          <UpgradeBanner 
            feature="AI comparison analytics"
            description="Upgrade to Pro to see how your trading decisions compare to AI recommendations with equity curves and edge analysis."
            requiredTier="pro"
          />
        </div>
      </div>
    );
  }

  const hasData = data && (data.aiBaseline.tradesCount > 0 || data.userTakenTrades.tradesCount > 0);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Man vs. Machine</h1>
              <p className="text-sm text-muted-foreground">
                Compare your trading decisions against AI recommendations
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

        <Card data-testid="card-iron-strike-coach">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Bot className="h-5 w-5 text-cyan-500" />
              </div>
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Iron Strike Coach</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Analyze your performance against AI. Get insights on improving your edge and decision-making.
            </p>
            <form onSubmit={handleCoachSubmit} className="flex gap-2">
              <Input
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
                placeholder="Ask about your trading performance..."
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


        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold">Failed to load comparison data</h3>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </Card>
        ) : !hasData ? (
          <Card className="p-8 text-center">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold">No Comparison Data</h3>
            <p className="text-sm text-muted-foreground">
              Take some AI signals or log manual trades to see how you compare
            </p>
          </Card>
        ) : (
          <>
            <Card className={data!.edge >= 0 ? "border-green-500/30" : "border-red-500/30"} data-testid="card-edge">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Edge vs AI</p>
                    <p className={`text-3xl font-bold font-mono ${data!.edge >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {data!.edge >= 0 ? '+' : ''}{(data!.edge * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${data!.edge >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {data!.edge >= 0 ? (
                      <Award className="h-8 w-8 text-green-500" />
                    ) : (
                      <Target className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {data!.edge >= 0.05 
                    ? "Your trade selection is adding value over AI baseline!"
                    : data!.edge >= 0
                    ? "You're roughly matching AI performance"
                    : "Consider following more AI signals to improve returns"}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <ComparisonCard 
                title="Win Rate"
                aiValue={data!.aiBaseline.winRate}
                userValue={data!.userTakenTrades.winRate}
                format="percent"
              />
              <ComparisonCard 
                title="Net P&L"
                aiValue={data!.aiBaseline.netPnL}
                userValue={data!.userTakenTrades.netPnL}
                format="currency"
              />
              <ComparisonCard 
                title="Profit Factor"
                aiValue={data!.aiBaseline.profitFactor}
                userValue={data!.userTakenTrades.profitFactor}
                format="ratio"
              />
              <ComparisonCard 
                title="Expectancy"
                aiValue={data!.aiBaseline.expectancy}
                userValue={data!.userTakenTrades.expectancy}
                format="currency"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {!data?.limitedView ? (
                <div className="lg:col-span-2">
                  <EquityComparison data={data!.timeSeries} />
                </div>
              ) : (
                <Card className="lg:col-span-2 border-dashed">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-lg">Equity Comparison</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="h-64 flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <Zap className="h-10 w-10 mx-auto text-blue-500/50" />
                      <p className="text-sm text-muted-foreground">Upgrade to Pro for equity curves</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <TradeBreakdown 
                takenCount={data!.takenCount}
                manualCount={data!.manualCount}
                skippedCount={data!.skippedCount}
              />
            </div>

            {data!.userManualTrades.tradesCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Manual Trades Analysis</CardTitle>
                  <CardDescription>Trades you made without AI signals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Trades</p>
                      <p className="text-xl font-bold font-mono">{data!.userManualTrades.tradesCount}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className={`text-xl font-bold font-mono ${data!.userManualTrades.winRate >= 0.5 ? 'text-green-500' : 'text-red-500'}`}>
                        {(data!.userManualTrades.winRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Net P&L</p>
                      <p className={`text-xl font-bold font-mono ${data!.userManualTrades.netPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ${data!.userManualTrades.netPnL.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Profit Factor</p>
                      <p className="text-xl font-bold font-mono">{data!.userManualTrades.profitFactor.toFixed(2)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
