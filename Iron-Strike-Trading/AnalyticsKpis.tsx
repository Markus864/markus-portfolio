import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { 
  BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, 
  Activity, Award, Target, AlertTriangle, Lock, Crown, Zap
} from "lucide-react";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";

type KPIMetrics = {
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

type KPIResponse = {
  overall: KPIMetrics;
  bySymbol: Record<string, KPIMetrics>;
  byDTEBucket: Record<string, KPIMetrics>;
  byDirection: Record<string, KPIMetrics>;
  tier: string;
  range: string;
};

function MetricCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend,
  format = "default"
}: { 
  title: string; 
  value: number | string; 
  subValue?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  format?: "percent" | "currency" | "ratio" | "default";
}) {
  const formatValue = (v: number | string) => {
    if (typeof v === "string") return v;
    if (v === null || v === undefined || !isFinite(v)) return "--";
    switch (format) {
      case "percent": return `${(v * 100).toFixed(1)}%`;
      case "currency": return `$${v.toFixed(2)}`;
      case "ratio": return v.toFixed(2);
      default: return v.toFixed(2);
    }
  };

  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  
  return (
    <Card data-testid={`metric-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Icon className={`h-4 w-4 ${trendColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold font-mono ${trendColor}`}>
          {formatValue(value)}
        </div>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownChart({ 
  data, 
  dataKey = "winRate",
  title 
}: { 
  data: Array<{ name: string; value: number; pnl?: number }>;
  dataKey?: string;
  title: string;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid={`chart-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" width={60} />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Win Rate"]}
              contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar 
              dataKey="value" 
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RadarMetrics({ metrics }: { metrics: KPIMetrics }) {
  const data = [
    { metric: "Win Rate", value: metrics.winRate * 100, fullMark: 100 },
    { metric: "Profit Factor", value: Math.min(metrics.profitFactor * 20, 100), fullMark: 100 },
    { metric: "Expectancy", value: Math.min(Math.max(metrics.expectancy / 10 * 100 + 50, 0), 100), fullMark: 100 },
    { metric: "Discipline", value: metrics.disciplineScore, fullMark: 100 },
    { metric: "Sharpe-Like", value: Math.min(Math.max(metrics.sharpeLike / 3 * 100, 0), 100), fullMark: 100 },
  ];

  return (
    <Card data-testid="chart-radar-metrics">
      <CardHeader>
        <CardTitle className="text-lg">Performance Radar</CardTitle>
        <CardDescription>Multi-dimensional performance overview</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar 
              name="Performance" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              fill="hsl(var(--primary))" 
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function LockedSection({ title, requiredTier }: { title: string; requiredTier: "pro" | "premium" }) {
  return (
    <Card className="border-dashed opacity-75">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription>Upgrade to {requiredTier === "pro" ? "Pro" : "Premium"} to unlock</CardDescription>
      </CardHeader>
      <CardContent className="h-48 flex items-center justify-center">
        <div className="text-center space-y-3">
          {requiredTier === "premium" ? (
            <Crown className="h-10 w-10 mx-auto text-amber-500/50" />
          ) : (
            <Zap className="h-10 w-10 mx-auto text-blue-500/50" />
          )}
          <p className="text-sm text-muted-foreground">
            {requiredTier === "pro" ? "$49/month" : "$99/month"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsKpis() {
  const [range, setRange] = useState("30d");
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier = isDeveloper ? "premium" : tier;

  const allowedRanges = {
    free: ["30d"],
    pro: ["30d", "90d"],
    premium: ["30d", "90d", "180d", "1y"],
  };

  const tierRanges = allowedRanges[effectiveTier as keyof typeof allowedRanges] || allowedRanges.free;

  const { data: kpis, isLoading, error } = useQuery<KPIResponse>({
    queryKey: ["/api/analytics/kpis", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/kpis?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch KPIs");
      return res.json();
    },
  });

  if (tierLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (effectiveTier === "free") {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Performance KPIs</h1>
              <p className="text-sm text-muted-foreground">
                Comprehensive trading performance metrics
              </p>
            </div>
          </div>
          <UpgradeBanner 
            feature="Performance KPIs"
            description="Upgrade to Pro to access comprehensive performance metrics including win rate, profit factor, expectancy, and detailed breakdowns."
            requiredTier="pro"
          />
        </div>
      </div>
    );
  }

  const metrics = kpis?.overall || {
    winRate: 0,
    lossRate: 0,
    tradesCount: 0,
    netPnL: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    expectancy: 0,
    avgRMultiple: 0,
    maxDrawdown: 0,
    avgHoldTime: 0,
    disciplineScore: 0,
    sharpeLike: 0,
    avgConfidence: 0,
  };

  const symbolData = Object.entries(kpis?.bySymbol || {}).map(([name, m]) => ({
    name,
    value: m.winRate * 100,
    pnl: m.netPnL,
  }));

  const dteData = Object.entries(kpis?.byDTEBucket || {}).map(([name, m]) => ({
    name,
    value: m.winRate * 100,
    pnl: m.netPnL,
  }));

  const directionData = Object.entries(kpis?.byDirection || {}).map(([name, m]) => ({
    name,
    value: m.winRate * 100,
    pnl: m.netPnL,
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Performance KPIs</h1>
              <p className="text-sm text-muted-foreground">
                Comprehensive trading performance metrics
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


        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold">Failed to load analytics</h3>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Win Rate" 
                value={metrics.winRate} 
                format="percent"
                icon={metrics.winRate >= 0.5 ? TrendingUp : TrendingDown}
                trend={metrics.winRate >= 0.5 ? "up" : "down"}
                subValue={`${metrics.tradesCount} trades`}
              />
              <MetricCard 
                title="Net P&L" 
                value={metrics.netPnL} 
                format="currency"
                icon={DollarSign}
                trend={metrics.netPnL >= 0 ? "up" : "down"}
              />
              <MetricCard 
                title="Profit Factor" 
                value={metrics.profitFactor} 
                format="ratio"
                icon={Activity}
                trend={metrics.profitFactor >= 1 ? "up" : "down"}
                subValue={metrics.profitFactor >= 2 ? "Excellent" : metrics.profitFactor >= 1 ? "Profitable" : "Needs work"}
              />
              <MetricCard 
                title="Expectancy" 
                value={metrics.expectancy} 
                format="currency"
                icon={Target}
                trend={metrics.expectancy >= 0 ? "up" : "down"}
                subValue="Per trade average"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Avg Win" 
                value={metrics.avgWin} 
                format="currency"
                icon={TrendingUp}
                trend="up"
              />
              <MetricCard 
                title="Avg Loss" 
                value={Math.abs(metrics.avgLoss)} 
                format="currency"
                icon={TrendingDown}
                trend="down"
              />
              <MetricCard 
                title="Avg R-Multiple" 
                value={metrics.avgRMultiple} 
                format="ratio"
                icon={Award}
                trend={metrics.avgRMultiple >= 1 ? "up" : metrics.avgRMultiple >= 0 ? "neutral" : "down"}
              />
              <MetricCard 
                title="Max Drawdown" 
                value={metrics.maxDrawdown} 
                format="percent"
                icon={AlertTriangle}
                trend="down"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Discipline Score" 
                value={`${(metrics.disciplineScore ?? 0).toFixed(0)}%`}
                icon={Target}
                trend={(metrics.disciplineScore ?? 0) >= 80 ? "up" : (metrics.disciplineScore ?? 0) >= 60 ? "neutral" : "down"}
                subValue={(metrics.disciplineScore ?? 0) >= 80 ? "Great discipline" : "Room for improvement"}
              />
              <MetricCard 
                title="Sharpe-Like Ratio" 
                value={metrics.sharpeLike} 
                format="ratio"
                icon={Activity}
                trend={metrics.sharpeLike >= 1 ? "up" : metrics.sharpeLike >= 0 ? "neutral" : "down"}
              />
              <MetricCard 
                title="Avg Confidence" 
                value={metrics.avgConfidence} 
                format="percent"
                icon={Percent}
                trend="neutral"
              />
              <MetricCard 
                title="Avg Hold Time" 
                value={`${((metrics.avgHoldTime ?? 0) / 60).toFixed(1)}h`}
                icon={Activity}
                trend="neutral"
                subValue="Minutes in position"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RadarMetrics metrics={metrics} />
              <BreakdownChart 
                data={symbolData.sort((a, b) => b.pnl! - a.pnl!).slice(0, 8)} 
                title="Win Rate by Symbol" 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BreakdownChart 
                data={dteData} 
                title="Win Rate by DTE Bucket" 
              />
              <BreakdownChart 
                data={directionData} 
                title="Win Rate by Direction" 
              />
            </div>

            {kpis && Object.keys(kpis.bySymbol || {}).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Symbol Performance</CardTitle>
                  <CardDescription>Per-symbol metrics breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Trades</TableHead>
                        <TableHead className="text-right">Win Rate</TableHead>
                        <TableHead className="text-right">Net P&L</TableHead>
                        <TableHead className="text-right">Profit Factor</TableHead>
                        <TableHead className="text-right">Avg R</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(kpis.bySymbol)
                        .sort(([, a], [, b]) => b.netPnL - a.netPnL)
                        .map(([symbol, m]) => (
                          <TableRow key={symbol} data-testid={`row-symbol-${symbol}`}>
                            <TableCell className="font-medium">{symbol}</TableCell>
                            <TableCell className="text-right font-mono">{m.tradesCount}</TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={m.winRate >= 0.5 ? "text-green-500" : "text-red-500"}>
                                {(m.winRate * 100).toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span className={m.netPnL >= 0 ? "text-green-500" : "text-red-500"}>
                                ${m.netPnL.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">{(m.profitFactor ?? 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{(m.avgRMultiple ?? 0).toFixed(2)}R</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
