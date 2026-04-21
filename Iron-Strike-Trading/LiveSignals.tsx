import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DataDelayIndicator } from "@/components/DataDelayIndicator";
import { QueryError } from "@/components/QueryError";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, TrendingUp, TrendingDown, Activity, Search, X, RefreshCw, Bot, Send, Loader2, BarChart3, Percent } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface LiveSignal {
  id: string;
  ticker: string;
  optionType: "CALL" | "PUT";
  optionSide: "LONG" | "SHORT";
  strike: number;
  expiry: string;
  entry: number;
  stop: number;
  target: number;
  currentPrice: number;
  confidence: number;
  updatedAt: string;
}

export default function LiveSignals() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [searchInput, setSearchInput] = useState("");
  const [searchTicker, setSearchTicker] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<"gainers" | "losers">("gainers");
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const queryParams = searchTicker 
    ? `/api/live-signals?search=${searchTicker}` 
    : `/api/live-signals?mode=${displayMode}`;

  const { data: signals, isLoading, refetch, isFetching, error } = useQuery<LiveSignal[]>({
    queryKey: ["/api/live-signals", searchTicker, displayMode],
    queryFn: async () => {
      const response = await fetch(queryParams);
      if (!response.ok) throw new Error("Failed to fetch signals");
      return response.json();
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10000,
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

  useEffect(() => {
    if (!isFetching) {
      setLastRefresh(new Date());
    }
  }, [isFetching]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSearchTicker(searchInput.trim().toUpperCase());
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearchTicker(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getActionBadge = (optionType: string, optionSide: string) => {
    const action = `${optionSide} ${optionType}`;
    const isBullish = (optionSide === "LONG" && optionType === "CALL") || (optionSide === "SHORT" && optionType === "PUT");
    
    return (
      <Badge
        variant="secondary"
        className={isBullish ? "text-green-500" : "text-red-400"}
        data-testid={`badge-action-${action.replace(" ", "-").toLowerCase()}`}
      >
        {isBullish ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {action}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    let textClass = "text-muted-foreground";
    
    if (percent >= 80) {
      textClass = "text-green-500";
    } else if (percent >= 60) {
      textClass = "text-amber-400";
    } else {
      textClass = "text-red-400";
    }

    return (
      <Badge variant="secondary" className={textClass} data-testid={`badge-confidence-${percent}`}>
        {percent}%
      </Badge>
    );
  };

  const calculatePnL = (signal: LiveSignal) => {
    const pnl = ((signal.currentPrice - signal.entry) / signal.entry) * 100;
    return pnl;
  };

  const avgConfidence = signals && signals.length > 0
    ? signals.reduce((acc, s) => acc + s.confidence, 0) / signals.length
    : 0;

  const bullishCount = signals?.filter(s => 
    (s.optionSide === "LONG" && s.optionType === "CALL") || 
    (s.optionSide === "SHORT" && s.optionType === "PUT")
  ).length ?? 0;

  const bullishRatio = signals && signals.length > 0 
    ? (bullishCount / signals.length * 100).toFixed(0) 
    : "0";

  return (
    <div className="min-h-screen bg-background" data-testid="live-signals-page">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="heading-live-signals">
                Live Options Signals
              </h1>
              <p className="text-muted-foreground">
                {searchTicker ? `Searching: ${searchTicker}` : `Top 5 ${displayMode === "gainers" ? "Gainers" : "Losers"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <DataDelayIndicator 
              lastUpdated={lastRefresh}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
              showRefreshButton={false}
              compact
            />

            <Select
              value={refreshInterval.toString()}
              onValueChange={(value) => setRefreshInterval(parseInt(value))}
            >
              <SelectTrigger className="w-32" data-testid="select-refresh-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10000">10 sec</SelectItem>
                <SelectItem value="30000">30 sec</SelectItem>
                <SelectItem value="60000">1 min</SelectItem>
                <SelectItem value="300000">5 min</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              data-testid="button-auto-refresh"
            >
              <Activity className="h-4 w-4 mr-2" />
              {autoRefresh ? "Auto-Refresh On" : "Auto-Refresh Off"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-manual-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <section className="col-span-12 lg:col-span-9 space-y-4">
            {/* Search/Filter Bar */}
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search ticker (e.g., AAPL, TSLA)..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                        className="pl-10"
                        data-testid="input-search-ticker"
                      />
                      {searchTicker && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={clearSearch}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          data-testid="button-clear-search"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Button type="submit" data-testid="button-search">
                      Search
                    </Button>
                  </form>

                  {!searchTicker && (
                    <div className="flex gap-2">
                      <Button
                        variant={displayMode === "gainers" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDisplayMode("gainers")}
                        data-testid="button-gainers"
                      >
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Gainers
                      </Button>
                      <Button
                        variant={displayMode === "losers" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setDisplayMode("losers")}
                        data-testid="button-losers"
                      >
                        <TrendingDown className="h-4 w-4 mr-1" />
                        Losers
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Signals Table */}
            <Card>
              <CardHeader className="py-3 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Signal Feed
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {error ? (
                  <QueryError error={error} />
                ) : isLoading ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : signals && signals.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Strike/Exp</TableHead>
                        <TableHead>Entry</TableHead>
                        <TableHead>Current</TableHead>
                        <TableHead>P&L</TableHead>
                        <TableHead>Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signals.map((signal) => {
                        const pnl = calculatePnL(signal);
                        return (
                          <TableRow key={signal.id} data-testid={`signal-row-${signal.id}`}>
                            <TableCell className="font-mono font-bold text-foreground">
                              {signal.ticker}
                            </TableCell>
                            <TableCell>{getActionBadge(signal.optionType, signal.optionSide)}</TableCell>
                            <TableCell className="font-mono text-sm">
                              ${signal.strike} / {format(new Date(signal.expiry), "MM/dd")}
                            </TableCell>
                            <TableCell className="font-mono">{formatCurrency(signal.entry)}</TableCell>
                            <TableCell className="font-mono">{formatCurrency(signal.currentPrice)}</TableCell>
                            <TableCell className={`font-mono font-bold ${pnl >= 0 ? "text-green-500" : "text-red-400"}`}>
                              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
                            </TableCell>
                            <TableCell>{getConfidenceBadge(signal.confidence)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No signals found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            {/* Stats */}
            <Card>
              <CardHeader className="py-3 border-b border-border">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Signal Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Confidence</p>
                  <p className="text-2xl font-mono font-bold text-foreground" data-testid="text-avg-confidence">
                    {(avgConfidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Bullish Ratio</p>
                  <p className="text-2xl font-mono font-bold text-green-500" data-testid="text-bullish-ratio">
                    {bullishRatio}%
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Iron Strike Coach */}
            <Card data-testid="card-coach">
              <CardHeader className="py-3 border-b border-border">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Iron Strike Coach
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {coachResponse && (
                  <div className="p-3 bg-muted rounded-lg text-sm text-foreground" data-testid="text-coach-response">
                    {coachResponse}
                  </div>
                )}
                <form onSubmit={handleCoachSubmit} className="flex gap-2">
                  <Input
                    placeholder="Ask the coach..."
                    value={coachMessage}
                    onChange={(e) => setCoachMessage(e.target.value)}
                    className="flex-1 text-sm"
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
          </aside>
        </div>
      </div>
    </div>
  );
}
