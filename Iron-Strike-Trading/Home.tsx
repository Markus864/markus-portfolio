import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Radio,
  Sparkles,
  Target,
  BarChart3,
  LineChart,
  Bell,
  Star,
  Calculator,
  Newspaper,
  Image,
  ChevronRight,
  Clock,
  Activity,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Crown,
  Lightbulb,
  Filter,
  CalendarDays,
  Waves,
} from "lucide-react";
import type { SelectSignalHistory, SelectWatchlist, SelectPriceAlert } from "@shared/schema";

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  gradient: string;
}

const featureCards: FeatureCard[] = [
  {
    id: "signals",
    title: "AI Signal Generator",
    description: "GPT-powered options signals with multi-methodology analysis, confidence scoring, and real technical indicators.",
    icon: Sparkles,
    path: "/app/generator",
    badge: "CORE",
    badgeVariant: "secondary",
    gradient: "from-primary/10 to-primary/5",
  },
  {
    id: "live",
    title: "Live Signals",
    description: "Real-time streaming options signals with instant alerts and market-synced recommendations.",
    icon: Radio,
    path: "/app/live",
    badge: "LIVE",
    badgeVariant: "destructive",
    gradient: "from-red-500/10 to-red-600/5",
  },
  {
    id: "charts",
    title: "Market Charts",
    description: "Professional charting with technical overlays, volume analysis, and pattern recognition.",
    icon: LineChart,
    path: "/app/charts",
    gradient: "from-blue-500/10 to-blue-600/5",
  },
  {
    id: "chart-analysis",
    title: "Chart AI Analysis",
    description: "Upload chart screenshots for instant AI-powered pattern detection and trade recommendations.",
    icon: Image,
    path: "/app/chart-analysis",
    badge: "AI",
    badgeVariant: "secondary",
    gradient: "from-purple-500/10 to-purple-600/5",
  },
  {
    id: "screener",
    title: "Options Screener",
    description: "Natural language AI filtering to find the perfect options setups matching your criteria.",
    icon: Filter,
    path: "/app/screener",
    badge: "NEW",
    badgeVariant: "secondary",
    gradient: "from-amber-500/10 to-amber-600/5",
  },
  {
    id: "0dte",
    title: "0DTE Options Hub",
    description: "Specialized intraday options signals for same-day expiration trades with high precision.",
    icon: Flame,
    path: "/app/0dte",
    badge: "HOT",
    badgeVariant: "secondary",
    gradient: "from-orange-500/10 to-orange-600/5",
  },
  {
    id: "whales",
    title: "Whale Tracker",
    description: "Track unusual options activity and large institutional flow to follow smart money.",
    icon: Waves,
    path: "/app/whales",
    badge: "PRO",
    badgeVariant: "secondary",
    gradient: "from-blue-500/10 to-blue-600/5",
  },
  {
    id: "earnings",
    title: "Earnings Plays",
    description: "AI-optimized straddle and strangle strategies around earnings announcements.",
    icon: CalendarDays,
    path: "/app/earnings",
    gradient: "from-pink-500/10 to-pink-600/5",
  },
];

const toolCards = [
  { title: "Portfolio", description: "Track performance", icon: BarChart3, path: "/app/portfolio" },
  { title: "Watchlist", description: "Monitor stocks", icon: Star, path: "/app/watchlist" },
  { title: "Alerts", description: "Price notifications", icon: Bell, path: "/app/alerts" },
  { title: "Calculator", description: "Options profit calc", icon: Calculator, path: "/app/calculator" },
  { title: "News & Trends", description: "Market intelligence", icon: Newspaper, path: "/app/news" },
  { title: "Strategies", description: "Learning center", icon: Lightbulb, path: "/app/strategies" },
];

export default function Home() {
  const { data: recentSignals, isLoading: signalsLoading } = useQuery<SelectSignalHistory[]>({
    queryKey: ["/api/history"],
  });

  const { data: watchlist, isLoading: watchlistLoading } = useQuery<SelectWatchlist[]>({
    queryKey: ["/api/watchlist"],
  });

  const { data: alerts } = useQuery<SelectPriceAlert[]>({
    queryKey: ["/api/alerts"],
  });

  const latestSignals = recentSignals?.slice(0, 3) || [];
  const activeAlerts = alerts?.filter(a => a.status === 'active')?.length || 0;
  const totalSignals = recentSignals?.length || 0;
  const avgConfidence = recentSignals?.length 
    ? Math.round(recentSignals.reduce((sum, s) => sum + (Number(s.confidence) * 100), 0) / recentSignals.length)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Zap className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Welcome to <span className="text-foreground">Iron Strike</span>
                </h1>
                <p className="text-muted-foreground text-sm md:text-base">
                  Your AI-powered options trading command center
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app/generator">
              <Button data-testid="button-generate-signals">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Signals
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Total Signals</span>
                <Activity className="h-4 w-4 text-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-total-signals">
                {signalsLoading ? <Skeleton className="h-8 w-16" /> : totalSignals}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Generated today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Avg Confidence</span>
                <Target className="h-4 w-4 text-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-avg-confidence">
                {signalsLoading ? <Skeleton className="h-8 w-16" /> : `${avgConfidence}%`}
              </div>
              <Progress value={avgConfidence} className="h-1.5 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Watchlist</span>
                <Star className="h-4 w-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-watchlist">
                {watchlistLoading ? <Skeleton className="h-8 w-16" /> : (watchlist?.length || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tracked symbols</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Active Alerts</span>
                <Bell className="h-4 w-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-foreground font-mono" data-testid="stat-alerts">
                {activeAlerts}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Price notifications</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-foreground" />
              AI-Powered Features
            </h2>
            <Badge variant="outline">
              <Crown className="h-3 w-3 mr-1" />
              Premium Tools
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {featureCards.map((card) => (
              <Link key={card.id} href={card.path}>
                <Card 
                  className={`bg-gradient-to-br ${card.gradient} hover:border-border transition-all cursor-pointer group h-full`}
                  data-testid={`feature-card-${card.id}`}
                >
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2.5 bg-muted rounded-lg group-hover:bg-muted/80 transition-colors">
                        <card.icon className="h-6 w-6 text-foreground" />
                      </div>
                      {card.badge && (
                        <Badge variant={card.badgeVariant || "secondary"} className="text-[10px] px-1.5 py-0">
                          {card.badge}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-foreground font-semibold mb-2 group-hover:text-foreground/80 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground text-sm flex-1">
                      {card.description}
                    </p>
                    <div className="flex items-center text-foreground text-sm mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Launch</span>
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-foreground" />
                Recent Signals
              </h2>
              <Link href="/app/history">
                <Button variant="ghost" size="sm" className="text-foreground hover:text-foreground/80">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            {signalsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : latestSignals.length > 0 ? (
              <div className="space-y-3">
                {latestSignals.map((signal) => {
                  const isBullish = signal.action === "BUY_CALL" || signal.action === "SELL_PUT";
                  const confidencePercent = Math.round(Number(signal.confidence) * 100);
                  
                  return (
                    <Card 
                      key={signal.id} 
                      className="hover:border-border transition-colors"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${isBullish ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                              {isBullish ? (
                                <TrendingUp className="h-5 w-5 text-green-500" />
                              ) : (
                                <TrendingDown className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-foreground font-bold text-lg">{signal.symbol}</span>
                                <Badge 
                                  variant="outline" 
                                  className={isBullish ? 'text-green-500' : 'text-red-400'}
                                >
                                  {signal.action.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                Strike: ${signal.strikePrice} | Current: ${signal.currentPrice}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Confidence</span>
                              <span className={`font-mono font-bold ${confidencePercent >= 60 ? 'text-green-500' : 'text-amber-400'}`}>
                                {confidencePercent}%
                              </span>
                            </div>
                            <Progress value={confidencePercent} className="h-1.5 w-24 mt-1" />
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
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No signals generated yet</p>
                  <Link href="/app/generator">
                    <Button>
                      Generate Your First Signal
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-foreground" />
              Quick Tools
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {toolCards.map((tool) => (
                <Link key={tool.title} href={tool.path}>
                  <Card 
                    className="hover:border-border transition-all cursor-pointer group h-full"
                    data-testid={`tool-card-${tool.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="p-2 bg-muted rounded-lg w-fit mx-auto mb-2 group-hover:bg-muted/80 transition-colors">
                        <tool.icon className="h-5 w-5 text-foreground" />
                      </div>
                      <h3 className="text-foreground text-sm font-medium">{tool.title}</h3>
                      <p className="text-muted-foreground text-xs mt-0.5">{tool.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/20 rounded-xl">
                  <Crown className="h-8 w-8 text-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">
                    Upgrade to Premium
                  </h3>
                  <p className="text-muted-foreground">
                    Unlock unlimited signals, whale tracking, and advanced AI features
                  </p>
                </div>
              </div>
              <Link href="/pricing">
                <Button data-testid="button-upgrade-premium">
                  Upgrade Now
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
