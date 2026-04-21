import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Waves,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertCircle,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Zap,
  Bot,
  Send,
  Loader2,
} from "lucide-react";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { apiRequest } from "@/lib/queryClient";

interface WhaleActivity {
  id: string;
  symbol: string;
  optionType: string;
  strikePrice: number;
  expiration: string;
  contracts: number;
  premium: number;
  totalValue: number;
  sentiment: string;
  unusualRatio: string;
  timestamp: string;
  openInterest: number;
  avgOpenInterest: number;
  confidence: number;
}

interface WhaleSummary {
  totalFlow: number;
  bullishFlow: number;
  bearishFlow: number;
  unusualCount: number;
  netSentiment: string;
}

interface WhaleResponse {
  activity: WhaleActivity[];
  summary: WhaleSummary;
  lastUpdated: string;
}

export default function WhaleTracker() {
  const [filter, setFilter] = useState<"all" | "BULLISH" | "BEARISH">("all");
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier = isDeveloper ? "premium" : tier;
  const hasPremiumAccess = effectiveTier === "premium";

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
  
  const { data: whaleData, isLoading, refetch } = useQuery<WhaleResponse>({
    queryKey: ["/api/whales"],
    refetchInterval: 60000,
  });
  
  const activity = whaleData?.activity || [];
  const summary = whaleData?.summary;
  
  const filteredData = activity.filter(
    (item) => filter === "all" || item.sentiment === filter
  );

  const formatPremium = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (tierLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasPremiumAccess) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-6xl mx-auto p-6 space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Waves className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Whale Tracker</h1>
              <p className="text-muted-foreground">Track unusual options activity and follow smart money</p>
            </div>
          </div>
          <UpgradeBanner 
            feature="whale activity tracking"
            description="Upgrade to Premium to track unusual options activity, institutional flow, and smart money movements in real-time."
            requiredTier="premium"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Waves className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Whale Tracker
              </h1>
              <p className="text-muted-foreground">
                Track unusual options activity and follow smart money
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-blue-400">PRO</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-refresh-whales"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Total Flow</span>
                <DollarSign className="h-4 w-4 text-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {summary ? formatPremium(summary.totalFlow) : '$0'}
              </div>
              <p className="text-xs text-green-500 mt-1">From signals</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Bullish Flow</span>
                <ArrowUpRight className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500 font-mono">
                {summary ? formatPremium(summary.bullishFlow) : '$0'}
              </div>
              <Progress 
                value={summary ? (summary.bullishFlow / (summary.totalFlow || 1)) * 100 : 0} 
                className="h-1.5 mt-2" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Bearish Flow</span>
                <ArrowDownRight className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400 font-mono">
                {summary ? formatPremium(summary.bearishFlow) : '$0'}
              </div>
              <Progress 
                value={summary ? (summary.bearishFlow / (summary.totalFlow || 1)) * 100 : 0} 
                className="h-1.5 mt-2 [&>div]:bg-red-500" 
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Unusual Alerts</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {summary?.unusualCount || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">High confidence</p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-iron-strike-coach">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Bot className="h-5 w-5 text-cyan-500" />
              </div>
              <CardTitle className="text-sm font-medium uppercase tracking-wide">Smart Money Interpreter</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ask about whale activity patterns, institutional flow analysis, and smart money signals.
            </p>
            <form onSubmit={handleCoachSubmit} className="flex gap-2">
              <Input
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
                placeholder="What does this whale activity suggest?"
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

        <div className="flex items-center gap-3">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            data-testid="filter-all"
          >
            All Flow
          </Button>
          <Button
            variant={filter === "BULLISH" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("BULLISH")}
            data-testid="filter-bullish"
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Bullish
          </Button>
          <Button
            variant={filter === "BEARISH" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("BEARISH")}
            data-testid="filter-bearish"
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Bearish
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredData.length > 0 ? (
          <div className="space-y-3">
            {filteredData.map((whale) => {
              const isBullish = whale.sentiment === 'BULLISH';
              const unusualScore = Math.round(parseFloat(whale.unusualRatio) * 20);
              
              return (
                <Card 
                  key={whale.id}
                  className="hover:border-border transition-colors"
                  data-testid={`whale-activity-${whale.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${isBullish ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          {isBullish ? (
                            <TrendingUp className="h-6 w-6 text-green-500" />
                          ) : (
                            <TrendingDown className="h-6 w-6 text-red-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-bold text-xl">{whale.symbol}</span>
                            <Badge 
                              variant="outline" 
                              className={whale.optionType === 'CALL' ? 'text-green-500' : 'text-red-400'}
                            >
                              {whale.optionType}
                            </Badge>
                            <Badge variant="outline" className="text-muted-foreground">
                              ${whale.strikePrice}
                            </Badge>
                            <span className="text-muted-foreground text-sm">{whale.expiration}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>Contracts: {whale.contracts.toLocaleString()}</span>
                            <span>OI: {whale.openInterest.toLocaleString()}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(whale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground font-mono">
                            {formatPremium(whale.totalValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Value</div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Zap className={`h-4 w-4 ${unusualScore >= 70 ? 'text-amber-400' : 'text-muted-foreground'}`} />
                            <span className={`font-mono font-bold ${unusualScore >= 70 ? 'text-amber-400' : 'text-muted-foreground'}`}>
                              {whale.unusualRatio}x
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">vs Avg OI</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Waves className="h-12 w-12 text-blue-400/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Whale Activity Yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Generate signals to see unusual options activity. The whale tracker monitors high-confidence signals for large institutional flow.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-r from-blue-500/10 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Target className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Follow the Smart Money
                </h3>
                <p className="text-muted-foreground text-sm">
                  Whale activity often precedes major price moves. Use these signals as one factor in your analysis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
