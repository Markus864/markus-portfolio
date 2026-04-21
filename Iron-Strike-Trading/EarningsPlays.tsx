import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertCircle,
  RefreshCcw,
  Clock,
  Target,
  Zap,
  BarChart3,
  ArrowUpDown,
  Calendar,
  Building2,
  Crown,
} from "lucide-react";
import { useUserTier } from "@/hooks/use-user-tier";
import { UpgradeBanner } from "@/components/UpgradeBanner";

interface EarningsStrategy {
  type: string;
  description: string;
  maxRisk: string;
  breakeven?: string;
  creditReceived?: string;
  confidence: number;
}

interface HistoricalMove {
  quarter: string;
  move: string;
}

interface EarningsEvent {
  id: string;
  symbol: string;
  company: string;
  earningsDate: string;
  timing: string;
  currentPrice: string;
  expectedMove: string;
  impliedVolatility: string;
  strategies: EarningsStrategy[];
  historicalMoves: HistoricalMove[];
}

interface EarningsResponse {
  earnings: EarningsEvent[];
  weekCount: number;
  lastUpdated: string;
}

export default function EarningsPlays() {
  const [timeframe, setTimeframe] = useState("week");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { tier, isLoading: tierLoading, isDeveloper } = useUserTier();
  const effectiveTier = isDeveloper ? "premium" : tier;
  const hasPremiumAccess = effectiveTier === "premium";
  
  const { data: earningsData, isLoading, refetch } = useQuery<EarningsResponse>({
    queryKey: ["/api/earnings"],
  });
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };
  
  const filteredEarnings = (earningsData?.earnings || []).filter(event => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.earningsDate);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (timeframe) {
      case "today":
        return diffDays === 0;
      case "week":
        return diffDays >= 0 && diffDays <= 7;
      case "month":
        return diffDays >= 0 && diffDays <= 30;
      default:
        return true;
    }
  });
  
  const earningsEvents = filteredEarnings;

  if (tierLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasPremiumAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <CalendarDays className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Earnings Plays</h1>
              <p className="text-muted-foreground">AI-optimized straddle and strangle strategies for earnings</p>
            </div>
          </div>
          <UpgradeBanner 
            feature="earnings volatility strategies"
            description="Upgrade to Premium for AI-powered earnings plays with straddle and strangle recommendations, IV analysis, and historical move data."
            requiredTier="premium"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <CalendarDays className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Earnings Plays
              </h1>
              <p className="text-muted-foreground">
                AI-optimized straddle and strangle strategies for earnings
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            data-testid="button-refresh-earnings"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">
                  {timeframe === 'today' ? 'Today' : timeframe === 'week' ? 'This Week' : 'This Month'}
                </span>
                <Calendar className="h-4 w-4 text-pink-400" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {earningsEvents.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Earnings events</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">High IV</span>
                <Activity className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 font-mono">
                {earningsEvents.filter(e => parseFloat(e.impliedVolatility) > 70).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Above 70% IV</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Straddle Picks</span>
                <ArrowUpDown className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-500 font-mono">
                {earningsEvents.filter(e => e.strategies[0]?.confidence > 60).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">High confidence</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Avg IV</span>
                <Target className="h-4 w-4 text-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono">
                {earningsEvents.length > 0 
                  ? (earningsEvents.reduce((sum, e) => sum + parseFloat(e.impliedVolatility), 0) / earningsEvents.length).toFixed(0)
                  : 0}%
              </div>
              <Progress value={65} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs value={timeframe} onValueChange={setTimeframe}>
          <TabsList>
            <TabsTrigger value="today">
              Today
            </TabsTrigger>
            <TabsTrigger value="week">
              This Week
            </TabsTrigger>
            <TabsTrigger value="month">
              This Month
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : earningsEvents.length > 0 ? (
          <div className="space-y-4">
            {earningsEvents.map((event) => {
              const topStrategy = event.strategies[0];
              const isStraddle = topStrategy?.type === 'Long Straddle';
              
              return (
                <Card 
                  key={event.id}
                  className="hover:border-border transition-colors"
                  data-testid={`earnings-card-${event.id}`}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-500/10 rounded-lg">
                          <Building2 className="h-6 w-6 text-pink-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-bold text-xl">{event.symbol}</span>
                            <Badge variant="outline" className="text-muted-foreground">
                              {event.earningsDate}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={event.timing === 'Before Open' ? 'text-amber-400' : 'text-blue-400'}
                            >
                              {event.timing}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{event.company}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Expected Move</div>
                          <div className="text-lg font-bold text-foreground font-mono">
                            {event.expectedMove}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Current Price</div>
                          <div className="text-lg font-bold text-muted-foreground font-mono">
                            ${event.currentPrice}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">IV</div>
                          <div className="text-lg font-bold text-amber-400 font-mono">
                            {event.impliedVolatility}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-muted-foreground mb-1">Max Risk</div>
                          <div className="text-lg font-bold text-red-400 font-mono">
                            ${topStrategy?.maxRisk || '0'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge 
                            variant="secondary"
                            className={isStraddle ? 'text-green-500' : 'text-blue-400'}
                          >
                            {topStrategy?.type || 'ANALYZING'}
                          </Badge>
                          <div className="flex items-center gap-1 mt-1 justify-end">
                            <span className="text-xs text-muted-foreground">Confidence:</span>
                            <span className={`font-mono text-sm font-bold ${(topStrategy?.confidence || 0) >= 70 ? 'text-green-500' : 'text-amber-400'}`}>
                              {Math.round(topStrategy?.confidence || 0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {parseFloat(event.impliedVolatility) > 70 && (
                      <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                          <span className="text-sm text-amber-400">
                            High implied volatility ({event.impliedVolatility}%) - elevated options premiums expected
                          </span>
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
              <CalendarDays className="h-12 w-12 text-pink-400/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Upcoming Earnings
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Check back later for upcoming earnings announcements and AI-recommended volatility strategies.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gradient-to-r from-pink-500/10 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-pink-500/20 rounded-xl">
                <Zap className="h-6 w-6 text-pink-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Volatility Strategy Guide
                </h3>
                <p className="text-muted-foreground text-sm">
                  <strong>Straddle:</strong> Buy ATM call + put when expecting large move either direction.
                  <strong className="ml-2">Strangle:</strong> Buy OTM call + put for lower cost with wider breakeven.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
