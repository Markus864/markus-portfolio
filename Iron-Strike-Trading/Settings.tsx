import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, Shield, AlertTriangle, Settings2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
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

  return (
    <div className="min-h-screen bg-background" data-testid="settings-page">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-border pb-6">
          <div className="p-3 bg-muted rounded-lg">
            <Settings2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-settings-title">
              Settings
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              // SYSTEM_CONFIGURATION
            </p>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6" data-testid="settings-container">
          {/* MAIN SETTINGS */}
          <section className="col-span-12 lg:col-span-8 space-y-6" data-testid="settings-main">
            {/* RISK CONTROLS */}
            <Card data-testid="card-risk-controls">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-widest font-bold">
                  <Shield className="h-4 w-4 text-primary" />
                  Risk Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold block mb-2">
                      Max Daily Loss ($)
                    </label>
                    <Input type="number" placeholder="1000" data-testid="input-max-daily-loss" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold block mb-2">
                      Max Risk Per Trade (%)
                    </label>
                    <Input type="number" placeholder="2" data-testid="input-max-risk-trade" />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground font-medium">Hard Stop Enforcement</p>
                    <p className="text-xs text-muted-foreground">Automatically block trades exceeding risk limits</p>
                  </div>
                  <Switch data-testid="switch-hard-stop" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground font-medium">Deviation Alerts</p>
                    <p className="text-xs text-muted-foreground">Get notified when rules are violated</p>
                  </div>
                  <Switch data-testid="switch-deviation-alerts" />
                </div>
              </CardContent>
            </Card>

            {/* NOTIFICATIONS */}
            <Card data-testid="card-notifications">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Email alerts</span>
                  <Switch data-testid="switch-email-alerts" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Discord alerts</span>
                  <Switch data-testid="switch-discord-alerts" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Telegram alerts</span>
                  <Switch data-testid="switch-telegram-alerts" />
                </div>
              </CardContent>
            </Card>

            {/* DATA PROVIDERS */}
            <Card data-testid="card-data-providers">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-widest font-bold">
                  Data Providers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Market data</span>
                  <Badge variant="default" data-testid="text-market-data-status">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Broker integration</span>
                  <Badge variant="secondary" data-testid="text-broker-status">Not connected</Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* SIDE RAIL */}
          <aside className="col-span-12 lg:col-span-4 space-y-6" data-testid="settings-rail">
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
                    placeholder="Ask about settings..."
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

            {/* System Status */}
            <Card data-testid="card-system-status">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm text-foreground">Configuration changes are logged</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-sm text-foreground">Rule enforcement is active</p>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" data-testid="button-save-settings">
              Save Changes
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
