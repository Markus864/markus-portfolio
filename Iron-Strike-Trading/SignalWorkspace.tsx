import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function SignalWorkspace() {
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

  const signal = {
    symbol: "SPY",
    direction: "LONG",
    strategy: "Breakout",
    timeframe: "1D",
    triggerPrice: 472.5,
    lastPrice: 471.9,
    confidence: 68,
    status: "ALIGNED",
    rationale: [
      "Higher low established",
      "Volume expansion above 20-day average",
      "Market breadth supportive",
    ],
    risks: [
      "Macro event within 48 hours",
      "Elevated implied volatility",
    ],
    updatedAt: "2 minutes ago",
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans" data-testid="workspace-page">
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-8" data-testid="workspace-container">
          <section className="col-span-12 lg:col-span-8 space-y-6" data-testid="workspace-main">
            <header>
              <h1 className="text-xl font-semibold" data-testid="text-workspace-title">
                {signal.symbol} — {signal.direction}
              </h1>
              <p className="text-sm text-muted-foreground" data-testid="text-workspace-subtitle">
                {signal.strategy} · {signal.timeframe}
              </p>
            </header>

            <Card data-testid="card-signal-summary">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-summary-header">
                  Signal Summary
                </h2>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Trigger</span>
                  <div className="font-mono text-foreground" data-testid="text-trigger-price">
                    ${signal.triggerPrice}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Price</span>
                  <div className="font-mono text-foreground" data-testid="text-last-price">
                    ${signal.lastPrice}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence</span>
                  <div className="font-mono text-foreground" data-testid="text-confidence">
                    {signal.confidence}%
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div>
                    <Badge
                      variant={
                        signal.status === "ALIGNED"
                          ? "default"
                          : "secondary"
                      }
                      data-testid="badge-signal-status"
                    >
                      {signal.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-rationale">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-rationale-header">
                  Rationale
                </h2>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {signal.rationale.map((r, i) => (
                  <div key={i} className="text-muted-foreground" data-testid={`text-rationale-${i}`}>
                    • {r}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-risks">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-risks-header">
                  Risk Factors
                </h2>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {signal.risks.map((r, i) => (
                  <div key={i} className="text-muted-foreground" data-testid={`text-risk-${i}`}>
                    • {r}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-coach-command">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-cyan-500" />
                  <h2 className="text-sm font-medium uppercase tracking-wide">Coach Command</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCoachSubmit} className="flex gap-2">
                  <Input
                    value={coachMessage}
                    onChange={(e) => setCoachMessage(e.target.value)}
                    placeholder="Ask about this signal setup..."
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
          </section>

          <aside className="col-span-12 lg:col-span-4 space-y-6" data-testid="workspace-rail">
            <Card data-testid="card-ai-assessment">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-ai-header">
                  AI Assessment
                </h2>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground" data-testid="text-ai-assessment">
                This signal aligns with your defined parameters.
                Review risk exposure before proceeding.
              </CardContent>
            </Card>

            <Separator />

            <Card data-testid="card-actions">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-actions-header">
                  Actions
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="secondary" data-testid="button-proceed-checkpoint">
                  Proceed to Checkpoint
                </Button>
                <Button className="w-full" variant="ghost" data-testid="button-dismiss-signal">
                  Dismiss Signal
                </Button>
                <Button className="w-full" variant="ghost" data-testid="button-snooze">
                  Snooze
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-iron-strike-coach">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-muted rounded-lg">
                    <Bot className="h-5 w-5 text-cyan-500" />
                  </div>
                  <h2 className="text-sm font-medium uppercase tracking-wide">Iron Strike Coach</h2>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Get real-time AI coaching on your signal decisions, risk management, and trade execution.
                </p>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Quick Tips:</span>
                  <ul className="mt-1 space-y-1">
                    <li>• Review confidence breakdown before entry</li>
                    <li>• Set stop-loss aligned with risk tolerance</li>
                    <li>• Monitor macro catalysts</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground" data-testid="text-last-updated">
              Last updated {signal.updatedAt}
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
