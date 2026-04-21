import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { Link } from "wouter"
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  CheckCircle2, 
  Radio,
  Zap,
  BarChart3,
  Clock,
  Sparkles,
  ArrowRight,
  Bot,
  Send,
  Loader2,
  Shield,
  Target,
  LineChart,
  ScanLine,
  Briefcase,
  ClipboardList,
  ChevronRight
} from "lucide-react"
import { format } from "date-fns"

interface DashboardStats {
  activeSignals: number;
  alertsActive: number;
  winRate: number | null;
  totalPnl: number | null;
  openPositions: number;
  dailyRiskUsed: number;
  availableCapital: number | null;
}

interface RecentSignal {
  id: number;
  symbol: string;
  action: string;
  confidence: number;
  createdAt: string;
}

interface RecentActivity {
  id: number;
  type: string;
  description: string;
  timestamp: string;
}

function StatSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);
  
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 60000,
  });

  const { data: recentSignals = [], isLoading: signalsLoading } = useQuery<RecentSignal[]>({
    queryKey: ["/api/signals/recent"],
  });

  const { data: recentActivity = [], isLoading: activityLoading } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activity"],
  });

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

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard-container">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span>Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground" data-testid="text-dashboard-title">
              System Overview
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl" data-testid="text-dashboard-subtitle">
              Monitor active signals, system health, and key performance metrics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/generator">
              <Button size="sm" data-testid="button-generate-signal">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Signal
              </Button>
            </Link>
          </div>
        </header>

        {/* Quick Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="section-quick-stats">
          {statsLoading ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                    <Radio className="h-3.5 w-3.5" />
                    Active Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold font-mono text-foreground" data-testid="text-stat-active-signals">
                    {stats?.activeSignals ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Pending review</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Alerts Active
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold font-mono text-foreground" data-testid="text-stat-alerts-active">
                    {stats?.alertsActive ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Monitoring levels</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Win Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold font-mono text-foreground" data-testid="text-stat-win-rate">
                    {stats?.winRate != null ? `${(stats.winRate * 100).toFixed(0)}%` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Total P&L
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold font-mono ${stats?.totalPnl != null ? (stats.totalPnl >= 0 ? "text-green-500" : "text-red-400") : "text-foreground"}`} data-testid="text-stat-pnl">
                    {stats?.totalPnl != null ? `$${stats.totalPnl.toLocaleString()}` : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Month to date</p>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <div className="grid grid-cols-12 gap-6">
          {/* MAIN CONTENT */}
          <section className="col-span-12 lg:col-span-8 space-y-6" data-testid="dashboard-main">
            {/* Signal Queue */}
            <Card data-testid="card-active-signals">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    Signal Queue
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Recent signals requiring attention or review.
                  </CardDescription>
                </div>
                <Link href="/app/history">
                  <Button variant="ghost" size="sm" data-testid="button-view-all-signals">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {signalsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : recentSignals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid="text-signals-empty">
                      No active signals in queue.
                    </p>
                    <Link href="/app/generator">
                      <Button size="sm" className="mt-4" data-testid="button-first-signal">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Signal
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentSignals.slice(0, 5).map((signal) => (
                      <div key={signal.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50" data-testid={`signal-row-${signal.id}`}>
                        <div className="flex items-center gap-3">
                          {signal.action.includes("CALL") ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : signal.action.includes("PUT") ? (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          ) : (
                            <Target className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-mono font-medium text-foreground">{signal.symbol}</span>
                          <Badge variant="secondary" className={signal.action.includes("CALL") ? "text-green-500" : signal.action.includes("PUT") ? "text-red-400" : "text-muted-foreground"}>
                            {signal.action}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-primary font-mono">
                            {(signal.confidence * 100).toFixed(0)}%
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(signal.createdAt), "MMM d")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Terminal Tabs */}
            <Card data-testid="terminal-tabs">
              <Tabs defaultValue="scanner" className="w-full">
                <CardHeader className="pb-0">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="scanner" className="text-xs">
                      <ScanLine className="h-3 w-3 mr-2" />
                      Scanner
                    </TabsTrigger>
                    <TabsTrigger value="positions" className="text-xs">
                      <Briefcase className="h-3 w-3 mr-2" />
                      Positions
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="text-xs">
                      <ClipboardList className="h-3 w-3 mr-2" />
                      Orders
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="scanner" className="m-0 pt-4">
                    <div className="text-center py-6">
                      <LineChart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Market scanner ready</p>
                      <p className="text-xs text-muted-foreground">Real-time scanning for opportunities</p>
                      <Link href="/app/screener">
                        <Button size="sm" variant="outline" className="mt-4">
                          Open Screener
                        </Button>
                      </Link>
                    </div>
                  </TabsContent>
                  <TabsContent value="positions" className="m-0 pt-4">
                    <div className="text-center py-6">
                      <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No open positions</p>
                      <p className="text-xs text-muted-foreground">Track your active trades here</p>
                    </div>
                  </TabsContent>
                  <TabsContent value="orders" className="m-0 pt-4">
                    <div className="text-center py-6">
                      <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No pending orders</p>
                      <p className="text-xs text-muted-foreground">Order history will appear here</p>
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Recent Activity */}
            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  System events and signal history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-activity-empty">
                    No recent activity recorded.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`activity-row-${activity.id}`}>
                        <span className="text-sm text-foreground">{activity.description}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(activity.timestamp), "MMM d, h:mm a")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* SIDEBAR */}
          <aside className="col-span-12 lg:col-span-4 space-y-6" data-testid="dashboard-rail">
            {/* Iron Strike Coach Panel */}
            <Card data-testid="iron-strike-coach">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Iron Strike Coach
                  <Badge variant="secondary" className="text-xs ml-auto">AI</Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Ask about strategy, signals, or market conditions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coachResponse && (
                  <div className="p-3 bg-muted rounded-lg text-sm text-foreground">
                    {coachResponse}
                  </div>
                )}
                <form onSubmit={handleCoachSubmit} className="flex gap-2">
                  <Input
                    value={coachMessage}
                    onChange={(e) => setCoachMessage(e.target.value)}
                    placeholder="Ask about strategy..."
                    className="text-sm"
                    data-testid="input-coach-message"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    disabled={coachMutation.isPending || !coachMessage.trim()}
                    data-testid="button-coach-send"
                  >
                    {coachMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  System Health
                </CardTitle>
                <CardDescription className="text-xs">
                  Service status and connectivity.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center gap-2 text-sm">
                  <span className="text-muted-foreground" data-testid="text-market-data-label">Market Data</span>
                  <Badge variant="secondary" className="text-[10px] text-green-500" data-testid="badge-market-data-status">
                    Live
                  </Badge>
                </div>
                <div className="flex justify-between items-center gap-2 text-sm">
                  <span className="text-muted-foreground" data-testid="text-ai-engine-label">AI Engine</span>
                  <Badge variant="secondary" className="text-[10px] text-green-500" data-testid="badge-ai-status">
                    Ready
                  </Badge>
                </div>
                <div className="flex justify-between items-center gap-2 text-sm">
                  <span className="text-muted-foreground" data-testid="text-alerts-label">Alert System</span>
                  <Badge variant="secondary" className="text-[10px] text-green-500" data-testid="badge-alerts-status">
                    Operational
                  </Badge>
                </div>
                <div className="flex justify-between items-center gap-2 text-sm">
                  <span className="text-muted-foreground" data-testid="text-database-label">Database</span>
                  <Badge variant="secondary" className="text-[10px] text-green-500" data-testid="badge-database-status">
                    Connected
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Risk Status */}
            <Card data-testid="card-risk-summary">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risk Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Current exposure and limits.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsLoading ? (
                  <>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Open Positions</span>
                      <span className="font-mono text-foreground" data-testid="text-open-positions">{stats?.openPositions ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Daily Risk Used</span>
                      <span className="font-mono text-foreground" data-testid="text-daily-risk">{stats?.dailyRiskUsed ?? 0}%</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Available Capital</span>
                      <span className="font-mono text-foreground" data-testid="text-available-capital">
                        {stats?.availableCapital != null ? `$${stats.availableCapital.toLocaleString()}` : "--"}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
