import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SignInButton } from "@clerk/clerk-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataDelayIndicator } from "@/components/DataDelayIndicator";
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Search, Loader2, LogIn, Bot, Send, RefreshCw, Activity, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

interface WatchlistItem {
  id: number;
  symbol: string;
  addedAt: string;
  currentPrice?: number;
  change?: number;
  changePercent?: number;
}

export default function Watchlist() {
  const [newSymbol, setNewSymbol] = useState("");
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: watchlist = [], isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
    enabled: isAuthenticated,
  });

  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await apiRequest("POST", "/api/watchlist", { symbol: symbol.toUpperCase() });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setNewSymbol("");
      toast({ title: "Symbol added to watchlist" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add symbol", description: error.message, variant: "destructive" });
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({ title: "Symbol removed from watchlist" });
    }
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim()) {
      addMutation.mutate(newSymbol.trim());
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans" data-testid="watchlist-page">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Star className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Watchlist</h1>
              <p className="text-muted-foreground">Track your favorite stocks and options</p>
            </div>
          </div>
        {isAuthenticated && (
          <div className="flex items-center gap-3 flex-wrap">
            <DataDelayIndicator 
              onRefresh={handleRefresh}
              isRefreshing={isLoading}
              compact
            />
            <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Add symbol..."
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                className="pl-9 w-40 uppercase font-mono"
                data-testid="input-add-symbol"
              />
            </div>
            <Button 
              type="submit" 
              disabled={addMutation.isPending || !newSymbol.trim()}
              data-testid="button-add-symbol"
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="ml-1">Add</span>
            </Button>
            </form>
          </div>
        )}
      </div>

      {authLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !isAuthenticated ? (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Sign in to access your watchlist</h3>
            <p className="text-muted-foreground mb-4">Create a personal watchlist to track your favorite stocks and options</p>
            <SignInButton mode="redirect" forceRedirectUrl="/app/watchlist">
              <Button data-testid="button-login-watchlist">
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </SignInButton>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : watchlist.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Star className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No stocks in watchlist</h3>
            <p className="text-muted-foreground mb-4">Add symbols to track their prices and get quick access to signals</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"].map(symbol => (
                <Button
                  key={symbol}
                  variant="outline"
                  size="sm"
                  onClick={() => addMutation.mutate(symbol)}
                  disabled={addMutation.isPending}
                  data-testid={`button-quick-add-${symbol}`}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {symbol}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item) => {
            const isPositive = (item.changePercent || 0) >= 0;
            return (
              <Card key={item.id} className="hover-elevate" data-testid={`watchlist-item-${item.symbol}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">{item.symbol}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMutation.mutate(item.id)}
                      className="text-muted-foreground hover:text-red-400"
                      data-testid={`button-remove-${item.symbol}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-bold font-mono">
                        ${item.currentPrice?.toFixed(2) || "—"}
                      </div>
                      <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span className="font-mono">
                          {isPositive ? "+" : ""}{item.changePercent?.toFixed(2) || 0}%
                        </span>
                      </div>
                    </div>
                    <Badge variant={isPositive ? "default" : "destructive"} className="font-mono">
                      {isPositive ? "+" : ""}{item.change?.toFixed(2) || 0}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {isAuthenticated && <WatchlistCoachPanel />}
      </div>
    </div>
  );
}

function WatchlistCoachPanel() {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [insight, setInsight] = useState("Ready to help with your watchlist analysis...");

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/chat', {
        message: `Role: You are "Iron Strike Coach", an advanced AI trading mentor.
Task: Provide a brief insight about managing a stock watchlist.
Context: User is on the Watchlist page tracking stocks.

Output: Provide 2-3 sentences of actionable advice about watchlist management.
Tone: Professional, concise, objective. No financial advice.`
      });
      return response.json();
    },
    onSuccess: (res) => {
      const response = res.response || res.message || "Analysis complete.";
      setInsight(typeof response === 'string' ? response : JSON.stringify(response));
    },
    onError: () => {
      setInsight("Unable to connect to Iron Strike Coach.");
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest('POST', '/api/chat', {
        message: `Role: You are "Iron Strike Coach", a trading mentor.
Context: User is on the Watchlist page tracking stocks.
User Question: "${userMessage}"

Instructions:
- Answer directly and briefly.
- Use bullet points if listing concepts.
- Maintain a helpful, professional "Coach" persona.`
      });
      return response.json();
    },
    onSuccess: (res) => {
      const response = res.response || res.message || "Analysis unavailable.";
      const text = typeof response === 'string' ? response : JSON.stringify(response);
      setChatHistory(prev => [...prev, { role: 'ai', text }]);
    },
    onError: () => {
      setChatHistory(prev => [...prev, { role: 'ai', text: "Unable to process your request." }]);
    }
  });

  const handleAskAI = (textOverride?: string) => {
    const userMsg = textOverride || chatInput;
    if (!userMsg.trim()) return;
    
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput("");
    chatMutation.mutate(userMsg);
  };

  const quickPrompts = [
    { label: "Stock Analysis", query: "How do I evaluate a stock for my watchlist?" },
    { label: "Entry Points", query: "What are good entry signals to watch for?" },
    { label: "Diversification", query: "How should I diversify my watchlist?" },
  ];

  return (
    <Card className="border-border" data-testid="panel-iron-strike-coach">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent rounded-lg">
            <Bot className="w-5 h-5 text-background" />
          </div>
          <div>
            <CardTitle className="text-base">Iron Strike Coach</CardTitle>
            <CardDescription className="text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              AI Watchlist Mentor
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto"
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
            data-testid="button-refresh-coach"
          >
            <RefreshCw className={`w-4 h-4 ${analysisMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-muted rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <Activity className="w-3 h-3" /> Watchlist Insight
          </div>
          <p className="text-sm text-foreground">{insight}</p>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-2 rounded-lg text-sm ${
                msg.role === 'user' 
                  ? 'bg-accent text-background' 
                  : 'bg-muted text-foreground border border-border'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted px-3 py-2 rounded-lg border border-border flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((p, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => handleAskAI(p.query)}
              className="whitespace-nowrap text-xs"
              data-testid={`quick-prompt-${i}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
            placeholder="Ask Coach..."
            className="flex-1"
            data-testid="input-coach-chat"
          />
          <Button 
            onClick={() => handleAskAI()}
            disabled={!chatInput.trim() || chatMutation.isPending}
            size="icon"
            data-testid="button-send-coach"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
