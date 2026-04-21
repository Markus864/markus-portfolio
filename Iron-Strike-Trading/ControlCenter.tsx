import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Compass,
  Bell,
  Mail,
  Send,
  MessageCircle,
  Settings,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Zap,
  TrendingUp,
  Shield,
  Bot,
  Activity,
} from "lucide-react";

type Role = "free" | "pro" | "premium" | string;

interface AccountSettingsResponse {
  email?: string;
  defaultNotifyEmail?: boolean;
  defaultNotifyTelegram?: boolean;
  defaultNotifyDiscord?: boolean;
  role?: Role;
}

interface Alert {
  id: number;
  status: string;
}

export default function ControlCenter() {
  const [, navigate] = useLocation();
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const accountQuery = useQuery({
    queryKey: ["control-center-account"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/settings");
      if (!res.ok) throw new Error("Failed to load account settings");
      return (await res.json()) as AccountSettingsResponse;
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["control-center-alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts");
      if (!res.ok) throw new Error("Failed to load alerts");
      return (await res.json()) as Alert[];
    },
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

  const account = accountQuery.data;
  const alerts = alertsQuery.data ?? [];

  const role: Role = account?.role ?? "free";
  const activeCount = alerts.filter((a) => (a.status ?? "").toUpperCase() === "ACTIVE").length;
  const triggeredCount = alerts.filter((a) => (a.status ?? "").toUpperCase() === "TRIGGERED").length;
  const pausedCount = alerts.filter((a) => (a.status ?? "").toUpperCase() === "PAUSED").length;

  const lastCheckedTime = useMemo(() => new Date().toLocaleTimeString(), []);

  const hasEmail = account?.defaultNotifyEmail ?? true;
  const hasTelegram = account?.defaultNotifyTelegram ?? false;
  const hasDiscord = account?.defaultNotifyDiscord ?? false;

  function getPlanLabel(role: Role) {
    switch (role) {
      case "pro": return "Pro Plan";
      case "premium": return "Premium Plan";
      default: return "Free Plan";
    }
  }

  function getPlanDescription(role: Role) {
    switch (role) {
      case "pro": return "You have access to advanced signal tools, options screener, and enhanced alert limits.";
      case "premium": return "You have full access to all Iron Strike features, priority alerts, and premium tooling.";
      default: return "You are on the Free plan. Upgrade to unlock more powerful tools and alerts.";
    }
  }

  const isLoading = accountQuery.isLoading || alertsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="control-center-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-mono">Initializing control center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="control-center-page">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-muted rounded-lg">
                <Compass className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-control-center-title">Mission Control</h1>
                <p className="text-sm text-muted-foreground font-mono mt-1">// SYSTEM_STATUS</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Badge 
              variant={role === "premium" ? "default" : role === "pro" ? "secondary" : "outline"} 
              className="text-xs uppercase tracking-widest px-3 py-1 font-bold" 
              data-testid="badge-plan"
            >
              {getPlanLabel(role)}
            </Badge>
            {role === "free" && (
              <Button size="sm" onClick={() => navigate("/pricing")} data-testid="button-upgrade">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Upgrade
              </Button>
            )}
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Content */}
          <section className="col-span-12 lg:col-span-8 space-y-6">
            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-3" data-testid="section-overview-cards">
              <Card>
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest font-bold">
                    <Bell className="h-4 w-4 text-primary" />
                    Alerts Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-foreground" data-testid="text-active-alerts">{activeCount}</span>
                    <span className="text-sm text-muted-foreground">active</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span data-testid="text-triggered-alerts">{triggeredCount} triggered</span>
                    <span data-testid="text-paused-alerts">{pausedCount} paused</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/app/alerts")} data-testid="button-manage-alerts">
                    Manage <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest font-bold">
                    <Send className="h-4 w-4 text-primary" />
                    Channels
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={hasEmail ? "default" : "secondary"}>
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </Badge>
                    <Badge variant={hasTelegram ? "default" : "secondary"}>
                      <Send className="h-3 w-3 mr-1" />
                      Telegram
                    </Badge>
                    <Badge variant={hasDiscord ? "default" : "secondary"}>
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Discord
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/app/settings")} data-testid="button-configure-channels">
                    Configure <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest font-bold">
                    <Shield className="h-4 w-4 text-primary" />
                    Identity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm text-foreground font-mono truncate" data-testid="text-email">
                    {account?.email || "Not configured"}
                  </p>
                  <p className="text-xs text-muted-foreground">{getPlanDescription(role)}</p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("/app/settings")} data-testid="button-settings">
                    Settings <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* System Health */}
            <Card>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest font-bold">
                  <Activity className="h-4 w-4 text-primary" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">API Status</p>
                    <p className="text-sm font-mono text-foreground">Online</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Data Feed</p>
                    <p className="text-sm font-mono text-foreground">Active</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="w-3 h-3 rounded-full bg-green-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">AI Engine</p>
                    <p className="text-sm font-mono text-foreground">Ready</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Last Check</p>
                    <p className="text-sm font-mono text-foreground">{lastCheckedTime}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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

            {/* Quick Actions */}
            <Card>
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/generator")}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Generate Signal
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/alerts")}>
                  <Bell className="h-4 w-4 mr-2" />
                  Create Alert
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate("/app/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
