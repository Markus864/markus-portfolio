import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  ComposedChart,
  Area,
} from "recharts";
import { 
  Target, TrendingUp, AlertTriangle, Lock, Crown, Zap, Scale
} from "lucide-react";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";

type CalibrationBin = {
  binStart: number;
  binEnd: number;
  binMid: number;
  signalCount: number;
  actualWinRate: number;
  avgConfidence: number;
};

type CalibrationResponse = {
  bins: CalibrationBin[];
  calibrationError: number;
  overconfidenceRatio: number;
  totalSignals: number;
  tier: string;
  range: string;
  binsUsed: number;
  maxBinsAllowed: number;
};

function CalibrationChart({ data }: { data: CalibrationBin[] }) {
  const chartData = data.map(bin => ({
    confidence: `${(bin.binMid * 100).toFixed(0)}%`,
    confidenceValue: bin.binMid * 100,
    predicted: bin.avgConfidence * 100,
    actual: bin.actualWinRate * 100,
    count: bin.signalCount,
  }));

  return (
    <Card data-testid="chart-calibration">
      <CardHeader>
        <CardTitle className="text-lg">Calibration Curve</CardTitle>
        <CardDescription>Predicted confidence vs actual win rate</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="confidence" 
              tick={{ fontSize: 11 }}
              label={{ value: 'Predicted Confidence', position: 'bottom', offset: -5 }}
            />
            <YAxis 
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              label={{ value: 'Win Rate', angle: -90, position: 'insideLeft' }}
            />
            <ReferenceLine 
              segment={[{ x: "0%", y: 0 }, { x: "100%", y: 100 }]}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              label={{ value: 'Perfect Calibration', position: 'insideTopRight', fontSize: 10 }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`, 
                name === 'actual' ? 'Actual Win Rate' : 'Predicted'
              ]}
              contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar 
              dataKey="actual" 
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
              opacity={0.7}
              name="actual"
            />
            <Line 
              type="monotone"
              dataKey="confidenceValue"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="perfect"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function BinBreakdown({ data }: { data: CalibrationBin[] }) {
  return (
    <Card data-testid="table-bins">
      <CardHeader>
        <CardTitle className="text-lg">Confidence Bin Analysis</CardTitle>
        <CardDescription>Detailed breakdown by confidence range</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((bin, i) => {
            const predicted = bin.avgConfidence * 100;
            const actual = bin.actualWinRate * 100;
            const diff = actual - predicted;
            const isOverconfident = diff < -5;
            const isUnderconfident = diff > 5;
            
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {(bin.binStart * 100).toFixed(0)}% - {(bin.binEnd * 100).toFixed(0)}%
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {bin.signalCount} signals
                    </Badge>
                    {isOverconfident && (
                      <Badge variant="destructive" className="text-xs">
                        Overconfident
                      </Badge>
                    )}
                    {isUnderconfident && (
                      <Badge variant="secondary" className="text-xs text-green-500">
                        Underconfident
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Predicted</span>
                      <span className="font-mono">{predicted.toFixed(1)}%</span>
                    </div>
                    <Progress value={predicted} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Actual</span>
                      <span className={`font-mono ${actual >= predicted ? 'text-green-500' : 'text-red-500'}`}>
                        {actual.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={actual} 
                      className="h-2"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConfidenceCalibration() {
  const [range, setRange] = useState("30d");
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier: "free" | "pro" | "premium" = isDeveloper ? "premium" : tier;

  const allowedRanges = {
    free: ["30d"],
    pro: ["30d", "90d"],
    premium: ["30d", "90d", "180d", "1y"],
  };

  const tierRanges = allowedRanges[effectiveTier as keyof typeof allowedRanges] || allowedRanges.free;

  const { data, isLoading, error } = useQuery<CalibrationResponse>({
    queryKey: ["/api/analytics/confidence-calibration", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/confidence-calibration?range=${range}`);
      if (!res.ok) throw new Error("Failed to fetch calibration data");
      return res.json();
    },
  });

  if (tierLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
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
              <Scale className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Confidence Calibration</h1>
              <p className="text-sm text-muted-foreground">Measure how well our confidence predictions match actual outcomes</p>
            </div>
          </div>
          <UpgradeBanner 
            feature="confidence calibration analysis"
            description="Upgrade to Pro for calibration curves, bin analysis, and insights into prediction accuracy."
            requiredTier="pro"
          />
        </div>
      </div>
    );
  }

  const getCalibrationGrade = (error: number) => {
    if (error <= 0.05) return { grade: "A", color: "text-green-500", description: "Excellent calibration" };
    if (error <= 0.1) return { grade: "B", color: "text-green-500", description: "Good calibration" };
    if (error <= 0.15) return { grade: "C", color: "text-yellow-500", description: "Moderate calibration" };
    if (error <= 0.2) return { grade: "D", color: "text-orange-500", description: "Poor calibration" };
    return { grade: "F", color: "text-red-500", description: "Needs improvement" };
  };

  const calibrationGrade = data ? getCalibrationGrade(data.calibrationError) : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Scale className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="page-title">Confidence Calibration</h1>
              <p className="text-sm text-muted-foreground">
                How well do our confidence predictions match actual outcomes?
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

        {/* Calibration Methodology Note */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-blue-400">About Calibration:</strong> Calibration is based on historical outcomes recorded in Iron Strike. 
              It improves as more trades are logged. A well-calibrated system has signals at 70% confidence winning approximately 70% of the time.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold">Failed to load calibration data</h3>
            <p className="text-sm text-muted-foreground">Please try again later</p>
          </Card>
        ) : data?.totalSignals === 0 ? (
          <Card className="p-8 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold">No Signal Data</h3>
            <p className="text-sm text-muted-foreground">
              Generate signals and track outcomes to see calibration analysis
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="metric-calibration-grade">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Calibration Grade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${calibrationGrade?.color}`}>
                    {calibrationGrade?.grade}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {calibrationGrade?.description}
                  </p>
                </CardContent>
              </Card>
              
              <Card data-testid="metric-calibration-error">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Mean Calibration Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${data!.calibrationError <= 0.1 ? 'text-green-500' : 'text-red-500'}`}>
                    {(data!.calibrationError * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg deviation from perfect calibration
                  </p>
                </CardContent>
              </Card>
              
              <Card data-testid="metric-overconfidence">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Overconfidence Ratio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold font-mono ${data!.overconfidenceRatio <= 0.5 ? 'text-green-500' : 'text-amber-500'}`}>
                    {(data!.overconfidenceRatio * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data!.overconfidenceRatio > 0.5 ? "Tends to be overconfident" : "Well balanced"}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CalibrationChart data={data!.bins} />
              <BinBreakdown data={data!.bins} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How to Interpret</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Calibration</strong> measures how well our confidence predictions match actual outcomes. 
                  A well-calibrated system should have 70% confidence signals win roughly 70% of the time.
                </p>
                <p>
                  <strong className="text-foreground">Overconfidence</strong> means our predictions are higher than actual win rates. 
                  <strong className="text-foreground"> Underconfidence</strong> means we're being too conservative.
                </p>
                <p>
                  The ideal is the diagonal line where predicted confidence equals actual win rate.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
