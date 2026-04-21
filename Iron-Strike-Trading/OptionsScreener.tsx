import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Filter,
  Search,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Zap,
  Clock,
  Activity,
  BarChart3,
  Signal,
  Radio,
  Bot,
  Send,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface LiveOptionResult {
  id: string;
  symbol: string;
  optionSymbol: string;
  optionType: string;
  action: string;
  strikePrice: number;
  currentPrice: number;
  premium: number;
  bid: number;
  ask: number;
  bidAskSpread: number;
  spreadPercent: number;
  expiration: string;
  daysToExpiry: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
  iv: number | null;
  delta: number | null;
  theta: number | null;
  gamma: number | null;
  vega: number | null;
  volume: number;
  openInterest: number;
  fetchedAt: string;
  isLive: boolean;
}

interface ScreenerResponse {
  results: LiveOptionResult[];
  query: string;
  parsedFilters: Record<string, unknown>;
  totalResults: number;
  scannedSymbols: string[];
  totalContracts: number;
  matchingContracts: number;
  lastUpdated: string;
  dataAge: number;
  cacheHit: boolean;
  dataSource: string;
}

interface ScannerStatus {
  cachedSymbols: number;
  totalContracts: number;
  lastScan: string | null;
  isScanning: boolean;
  errors: string[];
  supportedSymbols: string[];
  cacheExpiry: number;
}

const exampleQueries = [
  "High IV options on tech stocks",
  "Weekly calls with high delta",
  "0DTE SPY options",
  "Premium under $3 with high volume",
  "OTM puts on QQQ",
  "ATM calls with tight spread",
];

export default function OptionsScreener() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  const { data: statusData } = useQuery<ScannerStatus>({
    queryKey: ["/api/screener/status"],
    refetchInterval: 10000,
  });

  const { data: screenerData, isLoading, isFetching, refetch } = useQuery<ScreenerResponse>({
    queryKey: ["/api/screener", searchQuery],
    queryFn: async () => {
      const response = await fetch(`/api/screener?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!searchQuery,
    staleTime: 30000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/screener/refresh', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/screener/status"] });
    }
  });

  const handleSearch = () => {
    if (query.trim()) {
      setSearchQuery(query.trim());
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    setSearchQuery(example);
  };

  const formatDataAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-3 bg-muted border border-border rounded-lg">
            <Filter className="h-6 w-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Live Options Screener
            </h1>
            <p className="text-muted-foreground">
              Scan real-time market data with natural language
            </p>
          </div>
          <div className="flex items-center gap-2">
            {statusData?.isScanning ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Scanning...
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Radio className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || statusData?.isScanning}
              data-testid="button-refresh-scanner"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {statusData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Signal className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Symbols Cached</span>
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">{statusData.cachedSymbols}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-xs text-muted-foreground">Total Contracts</span>
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">{statusData.totalContracts.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Last Scan</span>
                </div>
                <div className="text-sm font-medium font-mono text-foreground mt-1">
                  {statusData.lastScan ? new Date(statusData.lastScan).toLocaleTimeString() : 'Never'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Cache TTL</span>
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">{statusData.cacheExpiry}s</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Describe the options setup you're looking for..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                    data-testid="input-screener-query"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={isFetching || !query.trim()}
                  data-testid="button-search-screener"
                >
                  {isFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Scan
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Try:</span>
                {exampleQueries.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(example)}
                    className="text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-1 rounded transition-colors"
                    data-testid={`example-query-${i}`}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

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
              Use natural language to find options. Ask about IV, delta, premium, volume, and more.
            </p>
            <form onSubmit={handleCoachSubmit} className="flex gap-2">
              <Input
                value={coachMessage}
                onChange={(e) => setCoachMessage(e.target.value)}
                placeholder="Ask the coach about options strategies..."
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

        {isFetching && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isFetching && screenerData && screenerData.results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {screenerData.matchingContracts.toLocaleString()} matches from {screenerData.totalContracts.toLocaleString()} contracts
                </h2>
                <Badge variant="secondary">
                  {screenerData.scannedSymbols.length} symbols
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Data: {formatDataAge(screenerData.dataAge)}
                {screenerData.cacheHit && (
                  <Badge variant="secondary" className="text-blue-400 text-xs">Cached</Badge>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {screenerData.results.map((result, i) => {
                const isCall = result.optionType.toUpperCase() === 'CALL';
                return (
                  <Card 
                    key={result.id} 
                    className="hover-elevate"
                    data-testid={`screener-result-${i}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-muted">
                            {isCall ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-foreground font-bold">{result.symbol}</span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${isCall ? 'text-green-500' : 'text-red-400'}`}
                              >
                                {result.optionType}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
                                  result.moneyness === 'ITM' ? 'text-amber-400' : 
                                  result.moneyness === 'ATM' ? 'text-blue-400' : 
                                  'text-muted-foreground'
                                }`}
                              >
                                {result.moneyness}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              ${result.currentPrice.toFixed(2)} underlying
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">{result.daysToExpiry}d to exp</div>
                          <div className="text-xs text-muted-foreground">{result.expiration}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Strike</div>
                          <div className="text-foreground font-mono text-xs">${result.strikePrice}</div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Mid</div>
                          <div className="text-foreground font-mono text-xs font-bold">${result.premium.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Bid/Ask</div>
                          <div className="text-foreground font-mono text-xs">${result.bid.toFixed(2)}/${result.ask.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Spread</div>
                          <div className={`font-mono text-xs ${result.spreadPercent < 10 ? 'text-green-500' : result.spreadPercent < 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {result.spreadPercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">IV</div>
                          <div className="text-foreground font-mono text-xs">
                            {result.iv != null ? `${(result.iv * 100).toFixed(0)}%` : 'N/A'}
                          </div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Delta</div>
                          <div className="text-foreground font-mono text-xs">
                            {result.delta != null ? result.delta.toFixed(2) : 'N/A'}
                          </div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">Vol</div>
                          <div className="text-foreground font-mono text-xs">{result.volume.toLocaleString()}</div>
                        </div>
                        <div className="text-center p-1.5 bg-muted/30 rounded">
                          <div className="text-[10px] text-muted-foreground">OI</div>
                          <div className="text-foreground font-mono text-xs">{result.openInterest.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                        <span className="font-mono truncate max-w-[180px]">{result.optionSymbol}</span>
                        <span className="flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" />
                          Live
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {!isFetching && screenerData && screenerData.results.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No matching options found for your criteria. Try adjusting your search or refresh the scanner.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Searched {screenerData.totalContracts.toLocaleString()} contracts across {screenerData.scannedSymbols.length} symbols
              </p>
            </CardContent>
          </Card>
        )}

        {!screenerData && !isFetching && (
          <Card>
            <CardContent className="p-8 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Real-Time Options Discovery
              </h3>
              <p className="text-muted-foreground max-w-lg mx-auto mb-4">
                Scan live market data across {statusData?.supportedSymbols?.length || 30}+ symbols. 
                Use natural language to find options by IV, delta, premium, volume, and more.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {statusData?.supportedSymbols?.slice(0, 10).map((sym) => (
                  <Badge key={sym} variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    {sym}
                  </Badge>
                ))}
                {statusData?.supportedSymbols && statusData.supportedSymbols.length > 10 && (
                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">
                    +{statusData.supportedSymbols.length - 10} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
