import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SelectSignalHistory } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { History as HistoryIcon, Calendar, DollarSign, Target, AlertTriangle, Bot, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const safeParseFloat = (value: string | number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
};

export default function History() {
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const { data: history, isLoading, error, refetch } = useQuery<SelectSignalHistory[]>({
    queryKey: ["/api/history"],
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

  const getActionConfig = (action: string) => {
    const configs: Record<string, { variant: "default" | "destructive" | "secondary"; label: string }> = {
      BUY_CALL: { variant: "default", label: "BUY CALL" },
      BUY_PUT: { variant: "destructive", label: "BUY PUT" },
      SELL_CALL: { variant: "secondary", label: "SELL CALL" },
      SELL_PUT: { variant: "secondary", label: "SELL PUT" },
      HOLD: { variant: "secondary", label: "HOLD" },
    };
    return configs[action] || { variant: "secondary", label: action };
  };

  const formatExpiry = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return format(date, "MMM d, yy");
  };

  return (
    <div className="min-h-screen bg-background" data-testid="history-page">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-muted rounded-lg">
            <HistoryIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Signal Log</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">// HISTORICAL_SIGNAL_LOG</p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <section className="col-span-12 lg:col-span-8 space-y-4">
            {error ? (
              <QueryError 
                error={error as Error}
                title="Failed to load signal history"
                onRetry={() => refetch()}
              />
            ) : isLoading ? (
              <div className="space-y-4" data-testid="loading-state">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <Card data-testid="empty-state">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <HistoryIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">No Signal History</h3>
                  <p className="text-muted-foreground font-mono text-sm">Generate signals to populate the archive.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {history.map((signal: SelectSignalHistory) => {
                  const actionConfig = getActionConfig(signal.action);
                  return (
                    <Card key={signal.id} className="hover-elevate" data-testid={`history-card-${signal.id}`}>
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-[150px]">
                            <div className="p-3 bg-muted rounded-lg">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <span className="text-xl font-mono font-bold text-foreground">{signal.symbol}</span>
                              <Badge variant={actionConfig.variant} className="ml-2 text-[10px] uppercase tracking-wider font-bold">
                                {actionConfig.label}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Strike</span>
                              <span className="font-mono text-foreground font-bold">${safeParseFloat(signal.strikePrice).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Premium</span>
                              <span className="font-mono text-green-500 font-bold">${safeParseFloat(signal.premium).toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Expiry</span>
                              <span className="font-mono text-foreground">{formatExpiry(signal.expirationDate)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Confidence</span>
                              <span className="font-mono text-primary font-bold">{safeParseFloat(signal.confidence).toFixed(0)}%</span>
                            </div>
                          </div>

                          <div className="text-right min-w-[100px]">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-1">Generated</span>
                            <span className="font-mono text-muted-foreground text-sm">
                              {signal.generatedAt ? format(new Date(signal.generatedAt), "MMM d, HH:mm") : "N/A"}
                            </span>
                          </div>
                        </div>

                        {signal.reasoning && (
                          <div className="mt-4 p-3 bg-muted rounded text-sm text-muted-foreground font-mono" data-testid={`reasoning-${signal.id}`}>
                            <span className="text-muted-foreground">// AI Reasoning: </span>{signal.reasoning}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            {/* Iron Strike Coach */}
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
                  <Input
                    placeholder="Ask about past signals..."
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

            {/* Quick Stats */}
            <Card>
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">
                  Signal Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Signals</p>
                  <p className="text-2xl font-mono font-bold text-foreground">{history?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Confidence</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {history && history.length > 0 
                      ? `${(history.reduce((acc, s) => acc + safeParseFloat(s.confidence), 0) / history.length).toFixed(0)}%`
                      : "--"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
