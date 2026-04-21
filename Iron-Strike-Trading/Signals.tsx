import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Loader2, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Signals() {
  const signals = [] as any[];
  const [statusFilter, setStatusFilter] = useState<"all" | "ALIGNED" | "PENDING">("all");
  
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

  const filteredSignals = statusFilter === "all" 
    ? signals 
    : signals.filter(s => s.status === statusFilter);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative" data-testid="signals-page">
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8" data-testid="signals-container">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-signals-title">Signals</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-signals-subtitle">
              Operational signal feed. Review before action.
            </p>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <Card data-testid="card-filter-bar">
              <CardContent className="flex flex-wrap gap-3 py-4 items-center">
                <Input placeholder="Symbol (e.g. SPY)" className="w-40" data-testid="input-filter-symbol" />
                <Input placeholder="Strategy" className="w-48" data-testid="input-filter-strategy" />
                <Input placeholder="Timeframe" className="w-40" data-testid="input-filter-timeframe" />
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Button 
                    variant={statusFilter === "all" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    data-testid="button-filter-all"
                  >
                    All
                  </Button>
                  <Button 
                    variant={statusFilter === "ALIGNED" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setStatusFilter("ALIGNED")}
                    data-testid="button-filter-aligned"
                  >
                    <Badge variant="default" className="mr-1 px-1.5 py-0">ALIGNED</Badge>
                  </Button>
                  <Button 
                    variant={statusFilter === "PENDING" ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setStatusFilter("PENDING")}
                    data-testid="button-filter-pending"
                  >
                    <Badge variant="secondary" className="mr-1 px-1.5 py-0">PENDING</Badge>
                  </Button>
                </div>
                <Button variant="secondary" data-testid="button-apply-filters">Apply Filters</Button>
              </CardContent>
            </Card>

            <Card data-testid="card-signals-table">
              <CardHeader>
                <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-active-signals-header">
                  Active Signals
                </h2>
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-t border-border">
                  <Table data-testid="table-signals">
                    <TableHeader>
                      <TableRow className="bg-accent/40">
                        <TableHead className="w-[120px]">Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Trigger</TableHead>
                        <TableHead className="text-right">Last</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Updated</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredSignals.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center text-sm text-muted-foreground py-12"
                            data-testid="text-signals-empty"
                          >
                            No active signals.
                          </TableCell>
                        </TableRow>
                      )}

                      {filteredSignals.map((s) => (
                        <TableRow
                          key={s.id}
                          className="hover:bg-accent/30 cursor-pointer"
                          data-testid={`row-signal-${s.id}`}
                        >
                          <TableCell className="font-mono font-medium" data-testid={`text-symbol-${s.id}`}>
                            {s.symbol}
                          </TableCell>
                          <TableCell data-testid={`text-direction-${s.id}`}>{s.direction}</TableCell>
                          <TableCell data-testid={`text-strategy-${s.id}`}>{s.strategy}</TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-trigger-${s.id}`}>
                            {s.triggerPrice}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-last-${s.id}`}>
                            {s.lastPrice ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono" data-testid={`text-confidence-${s.id}`}>
                            {s.confidence}%
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.status === "ALIGNED"
                                  ? "default"
                                  : "secondary"
                              }
                              data-testid={`badge-status-${s.id}`}
                            >
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground" data-testid={`text-updated-${s.id}`}>
                            {s.updatedAt}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
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
          </div>
        </div>
      </div>
    </div>
  );
}
