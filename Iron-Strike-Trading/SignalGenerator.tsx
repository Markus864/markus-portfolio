import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { TradingSignal } from "@shared/schema";
import { ControlPanel, SignalParams } from "@/components/ControlPanel";
import { SignalCard } from "@/components/SignalCard";
import { SignalTable } from "@/components/SignalTable";
import { DataDelayIndicator } from "@/components/DataDelayIndicator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { LayoutGrid, List, TrendingUp, AlertCircle, Sparkles, Lock, Crown, Bot, Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isDeveloper } from "@/lib/authUtils";
import { Link } from "wouter";

const STORAGE_KEY = "ironstrike_signal_generator_state";

type AccountSettings = {
  role: "free" | "pro" | "premium";
};

interface StoredState {
  signals: TradingSignal[];
  lastUpdated: string | null;
  viewMode: "cards" | "table";
  currentAccountSize: number;
}

function loadStoredState(): Partial<StoredState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load stored signal generator state:", e);
  }
  return {};
}

export default function SignalGenerator() {
  const storedState = loadStoredState();
  const [signals, setSignals] = useState<TradingSignal[]>(storedState.signals ?? []);
  const [viewMode, setViewMode] = useState<"cards" | "table">(storedState.viewMode ?? "cards");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    storedState.lastUpdated ? new Date(storedState.lastUpdated) : null
  );
  const [debug, setDebug] = useState(false);
  const [currentAccountSize, setCurrentAccountSize] = useState(storedState.currentAccountSize ?? 5000);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const showDevTools = isDeveloper(user?.id);
  
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
  
  useEffect(() => {
    const stateToStore: StoredState = {
      signals,
      lastUpdated: lastUpdated?.toISOString() ?? null,
      viewMode,
      currentAccountSize,
    };
    try {
      if (signals.length > 0 || lastUpdated !== null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
      }
    } catch (e) {
      console.warn("Failed to persist signal generator state:", e);
    }
  }, [signals, lastUpdated, viewMode, currentAccountSize]);
  
  const { data: accountSettings } = useQuery<AccountSettings>({
    queryKey: ["/api/account/settings"],
    enabled: isAuthenticated && !isDeveloper(user?.id),
  });
  
  const userRole = isDeveloper(user?.id) ? "premium" : (accountSettings?.role ?? "free");
  const isFreeUser = userRole === "free";

  const generateSignalsMutation = useMutation({
    mutationFn: async (payload: SignalParams) => {
      const response = await apiRequest(
        "POST",
        "/api/signals",
        payload
      );
      const data = await response.json() as TradingSignal[];
      return data;
    },
    onSuccess: (data) => {
      setSignals(data);
      setLastUpdated(new Date());
      toast({
        title: "Options Signals Generated",
        description: `Successfully generated ${data.length} options signal${data.length !== 1 ? "s" : ""} with AI`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error Generating Signals",
        description: error.message || "Failed to generate trading signals",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = (params: SignalParams) => {
    setCurrentAccountSize(params.accountSize);
    generateSignalsMutation.mutate(params);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      <main className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-muted border border-border rounded-lg">
            <Sparkles className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-signal-generator-title">Signal Generator</h1>
            <p className="text-muted-foreground">Generate AI-powered options trading signals</p>
          </div>
        </div>
        
        {isFreeUser && (
          <Alert className="border-border bg-muted" data-testid="alert-free-tier">
            <Lock className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-muted-foreground flex items-center justify-between flex-wrap gap-2">
              <span>
                <strong className="text-foreground">Free Plan:</strong> Signal generation is limited to <span className="font-semibold text-foreground">SPY only</span>. 
                Upgrade to Pro or Premium to analyze any symbol.
              </span>
              <Link href="/pricing">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Crown className="h-3.5 w-3.5" />
                  Upgrade
                </Button>
              </Link>
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid lg:grid-cols-[380px_1fr] gap-8">
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
            <ControlPanel
              onGenerate={handleGenerate}
              isLoading={generateSignalsMutation.isPending}
            />
            
            <Card data-testid="card-coach">
              <CardHeader className="border-b border-border py-3">
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
                  <Input placeholder="Ask the coach..." value={coachMessage} onChange={(e) => setCoachMessage(e.target.value)} className="flex-1 text-sm" data-testid="input-coach-message" />
                  <Button type="submit" size="icon" disabled={coachMutation.isPending || !coachMessage.trim()} data-testid="button-coach-send">
                    {coachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-6" data-testid="signals-container">
            {!generateSignalsMutation.isPending && signals.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Options Trading Signals</h2>
                    <p className="text-sm text-muted-foreground">
                      {signals.length} options signal{signals.length !== 1 ? "s" : ""}{" "}
                      generated
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {showDevTools && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor="debug" className="text-[0.7rem] text-muted-foreground">
                          Developer debug view
                        </Label>
                        <Switch 
                          id="debug" 
                          checked={debug} 
                          onCheckedChange={setDebug}
                          data-testid="switch-debug"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={viewMode === "cards" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("cards")}
                        className="gap-2"
                        data-testid="button-view-cards"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        Cards
                      </Button>
                      <Button
                        variant={viewMode === "table" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("table")}
                        className="gap-2"
                        data-testid="button-view-table"
                      >
                        <List className="h-4 w-4" />
                        Table
                      </Button>
                    </div>
                  </div>
                </div>

                {lastUpdated && (
                  <DataDelayIndicator lastUpdated={lastUpdated} />
                )}
              </div>
            )}

            {generateSignalsMutation.isPending && (
              <LoadingState />
            )}

            {generateSignalsMutation.isError && (
              <ErrorState
                error={generateSignalsMutation.error}
                onRetry={() => {}}
              />
            )}

            {!generateSignalsMutation.isPending && signals.length === 0 && !generateSignalsMutation.isError && (
              <EmptyState />
            )}

            {!generateSignalsMutation.isPending && signals.length > 0 && (
              <>
                {viewMode === "cards" ? (
                  <div className="grid gap-6 md:grid-cols-2">
                    {signals.map((signal, index) => (
                      <SignalCard 
                        key={`${signal.symbol}-${index}`} 
                        signal={signal} 
                        index={index}
                        accountSize={currentAccountSize}
                      />
                    ))}
                  </div>
                ) : (
                  <SignalTable signals={signals} />
                )}

                {showDevTools && debug && (
                  <div className="mt-4 rounded-xl border border-border bg-card p-3" data-testid="debug-panel">
                    <p className="text-[0.7rem] uppercase tracking-[0.16em] text-muted-foreground mb-2">
                      Raw AI response (developer)
                    </p>
                    <pre className="max-h-80 overflow-auto text-[0.7rem] text-foreground whitespace-pre-wrap">
                      {JSON.stringify(signals, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" data-testid="loading-state">
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
                <div className="flex gap-4">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
        <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
        <span className="ml-2 text-sm">AI is analyzing market data...</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="overflow-visible border-border" data-testid="empty-state">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <TrendingUp className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold mb-2">Ready for Options Analysis</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          Configure your trading parameters and click "Generate AI Signals" to
          receive intelligent options trading recommendations with CALL/PUT
          strategies, strike prices, and premium analysis.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span>AI-powered options analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>Contract sizing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-4" />
            <span>Greeks & Premium risk</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <Card className="overflow-visible border-destructive/50" data-testid="error-state">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-xl font-bold mb-2">Analysis Failed</h3>
        <p className="text-muted-foreground max-w-md mb-6">
          {error.message || "Failed to generate trading signals. Please try again."}
        </p>
        <Button onClick={onRetry} variant="outline" data-testid="button-retry">
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
