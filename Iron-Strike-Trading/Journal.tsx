import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, CheckCircle2, XCircle, TrendingUp, Bot, Send, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Journal() {
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

  const metrics = {
    adherenceRate: 82,
    deviationRate: 18,
    expectancy: 0.64,
    lastReview: "Today",
  };

  const entries = [
    {
      id: 1,
      symbol: "SPY",
      outcome: "ALIGNED",
      note: "Followed entry rules. No adjustment required.",
      timestamp: "Today · 09:41",
    },
    {
      id: 2,
      symbol: "QQQ",
      outcome: "DEVIATION",
      note: "Entered early before confirmation. Emotional entry.",
      timestamp: "Yesterday · 14:22",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="journal-page">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-muted rounded-lg">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-journal-title">
              Trading Journal
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              // LOG_BEHAVIOR :: REVIEW_DECISIONS
            </p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6" data-testid="journal-container">
          {/* Main Content */}
          <section className="col-span-12 lg:col-span-8 space-y-6" data-testid="journal-main">
            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">
                    Adherence
                  </span>
                  <div className="text-2xl font-mono font-bold text-green-500" data-testid="text-adherence-rate">
                    {metrics.adherenceRate}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">
                    Deviation
                  </span>
                  <div className="text-2xl font-mono font-bold text-red-500" data-testid="text-deviation-rate">
                    {metrics.deviationRate}%
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold block mb-2">
                    Expectancy
                  </span>
                  <div className="text-2xl font-mono font-bold text-primary" data-testid="text-expectancy">
                    {metrics.expectancy}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Decision Log */}
            <Card data-testid="card-recent-decisions">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Recent Decision Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {entries.map((e, idx) => (
                  <div 
                    key={e.id} 
                    className={`p-4 hover:bg-muted/50 transition-colors ${idx !== entries.length - 1 ? 'border-b border-border' : ''}`} 
                    data-testid={`decision-row-${e.id}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-lg text-foreground">{e.symbol}</span>
                        <span className="text-xs font-mono text-muted-foreground">{e.timestamp}</span>
                      </div>
                      <Badge
                        variant={e.outcome === "ALIGNED" ? "default" : "destructive"}
                        className="text-[10px] uppercase tracking-wider font-bold"
                      >
                        {e.outcome === "ALIGNED" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        {e.outcome}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono pl-2 border-l-2 border-border">
                      "{e.note}"
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* Sidebar */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            {/* Review Status */}
            <Card>
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Review Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Last review: <span className="font-mono text-foreground">{metrics.lastReview}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                  Consistent review improves decision quality. Do not skip this step.
                </p>
              </CardContent>
            </Card>

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
