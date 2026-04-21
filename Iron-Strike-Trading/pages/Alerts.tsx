import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { createAlertRequestSchema } from "@shared/schema";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Bell,
  Plus,
  PauseCircle,
  PlayCircle,
  Trash2,
  Edit,
  Activity,
  Filter,
  Mail,
  Send,
  MessageCircle,
  Loader2,
} from "lucide-react";

type AlertStatus = "ACTIVE" | "TRIGGERED" | "PAUSED" | string;
type AlertCondition = "ABOVE" | "BELOW" | string;

type Alert = {
  id: number;
  name?: string | null;
  symbol: string;
  targetPrice: number | string;
  condition: AlertCondition;
  status: AlertStatus;
  createdAt?: string;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  notifyDiscord?: boolean;
};

type FilterTab = "ALL" | "ACTIVE" | "PAUSED" | "TRIGGERED";

const alertFormSchema = createAlertRequestSchema.extend({
  targetPrice: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().positive("Target price must be a positive number")
  ),
});

type AlertFormValues = z.infer<typeof alertFormSchema>;

export default function Alerts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [filter, setFilter] = useState<FilterTab>("ALL");

  const form = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      name: "",
      symbol: "",
      targetPrice: 0,
      condition: "ABOVE",
      notifyEmail: true,
      notifyTelegram: false,
      notifyDiscord: false,
    },
  });

  const alertsQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/alerts");
      if (!res.ok) throw new Error("Failed to load alerts");
      return (await res.json()) as Alert[];
    },
  });

  useEffect(() => {
    if (alertsQuery.isError) {
      toast({
        title: "Failed to load alerts",
        description: "Please refresh the page or try again later.",
        variant: "destructive",
      });
    }
  }, [alertsQuery.isError, toast]);

  const alerts = alertsQuery.data ?? [];

  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => a.status === "ACTIVE").length;
    const paused = alerts.filter((a) => a.status === "PAUSED").length;
    const triggered = alerts.filter((a) => a.status === "TRIGGERED").length;
    return { total, active, paused, triggered };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case "ACTIVE":
        return alerts.filter((a) => a.status === "ACTIVE");
      case "PAUSED":
        return alerts.filter((a) => a.status === "PAUSED");
      case "TRIGGERED":
        return alerts.filter((a) => a.status === "TRIGGERED");
      default:
        return alerts;
    }
  }, [alerts, filter]);

  function openCreateDialog() {
    setEditingAlert(null);
    form.reset({
      name: "",
      symbol: "",
      targetPrice: 0,
      condition: "ABOVE",
      notifyEmail: true,
      notifyTelegram: false,
      notifyDiscord: false,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(alert: Alert) {
    setEditingAlert(alert);
    const price = typeof alert.targetPrice === "string" 
      ? parseFloat(alert.targetPrice) 
      : alert.targetPrice;
    form.reset({
      name: alert.name ?? "",
      symbol: alert.symbol ?? "",
      targetPrice: price || 0,
      condition: alert.condition === "BELOW" ? "BELOW" : "ABOVE",
      notifyEmail: Boolean(alert.notifyEmail),
      notifyTelegram: Boolean(alert.notifyTelegram),
      notifyDiscord: Boolean(alert.notifyDiscord),
    });
    setIsDialogOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async (data: AlertFormValues) => {
      const res = await apiRequest("POST", "/api/alerts", {
        name: data.name?.trim() || undefined,
        symbol: data.symbol.trim().toUpperCase(),
        targetPrice: data.targetPrice,
        condition: data.condition,
        notifyEmail: data.notifyEmail,
        notifyTelegram: data.notifyTelegram,
        notifyDiscord: data.notifyDiscord,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to create alert" }));
        throw new Error(err.message || "Failed to create alert");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Alert created",
        description: "Your alert is now active.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({
        title: "Error creating alert",
        description: err?.message ?? "Please check your input and try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: AlertFormValues) => {
      if (!editingAlert) return;
      const res = await apiRequest(
        "PATCH",
        `/api/alerts/${editingAlert.id}`,
        {
          name: data.name?.trim() || null,
          symbol: data.symbol.trim().toUpperCase(),
          targetPrice: data.targetPrice,
          condition: data.condition,
          notifyEmail: data.notifyEmail,
          notifyTelegram: data.notifyTelegram,
          notifyDiscord: data.notifyDiscord,
        },
      );
      if (!res.ok) throw new Error("Failed to update alert");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Alert updated",
        description: "Your alert changes have been saved.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({
        title: "Error updating alert",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/alerts/${id}`);
      if (!res.ok) throw new Error("Failed to delete alert");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Alert deleted",
        description: "The alert has been removed.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error deleting alert",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (alert: Alert) => {
      const res = await apiRequest(
        "POST",
        `/api/alerts/${alert.id}/toggle`,
        {},
      );
      if (!res.ok) throw new Error("Failed to update alert status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast({
        title: "Alert status updated",
        description: "The alert status has been changed.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error updating alert",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function onSubmit(data: AlertFormValues) {
    if (editingAlert) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="min-h-screen bg-background" data-testid="alerts-page">
      <div className="max-w-6xl mx-auto px-4 lg:px-0 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <Bell className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Price Alerts</span>
                <Badge variant="secondary" className="text-[10px] text-primary">Live</Badge>
              </div>
              <h1 className="text-2xl font-semibold text-foreground" data-testid="text-alerts-title">
                Stay ahead of your levels.
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => alertsQuery.refetch()}
              disabled={alertsQuery.isRefetching}
              data-testid="button-refresh-alerts"
            >
              {alertsQuery.isRefetching ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={openCreateDialog}
              data-testid="button-create-alert"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Alert
            </Button>
          </div>
        </header>

        {/* Overview stats */}
        <section className="grid gap-4 grid-cols-2 sm:grid-cols-4" data-testid="section-alert-stats">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                Total Alerts
              </div>
              <p className="text-2xl font-semibold font-mono text-foreground" data-testid="text-total-alerts">
                {stats.total}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                Active
              </div>
              <p className="text-2xl font-semibold font-mono text-green-500" data-testid="text-active-alerts">
                {stats.active}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                Paused
              </div>
              <p className="text-2xl font-semibold font-mono text-amber-400" data-testid="text-paused-alerts">
                {stats.paused}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
                Triggered
              </div>
              <p className="text-2xl font-semibold font-mono text-blue-400" data-testid="text-triggered-alerts">
                {stats.triggered}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Filter + list */}
        <section className="space-y-4" data-testid="section-alerts-list">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono uppercase tracking-wider">
              <Filter className="h-3.5 w-3.5" />
              <span>Filter by status</span>
            </div>
            <div className="flex flex-wrap gap-2" data-testid="filter-tabs">
              {(["ALL", "ACTIVE", "PAUSED", "TRIGGERED"] as FilterTab[]).map(
                (tab) => (
                  <Button
                    key={tab}
                    variant={filter === tab ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilter(tab)}
                    data-testid={`button-filter-${tab.toLowerCase()}`}
                  >
                    {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </Button>
                ),
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Your alerts</CardTitle>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {filteredAlerts.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {alertsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="loading-alerts">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading alerts…
                </div>
              ) : filteredAlerts.length === 0 ? (
                <div className="text-center py-6">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground" data-testid="text-no-alerts">
                    No alerts found for this filter.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create your first alert to start monitoring key levels.
                  </p>
                </div>
              ) : (
                <div className="space-y-2" data-testid="alerts-list">
                  {filteredAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className="space-y-1">
                        {alert.name && (
                          <div className="text-xs text-muted-foreground" data-testid={`text-name-${alert.id}`}>
                            {alert.name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold font-mono text-foreground" data-testid={`text-symbol-${alert.id}`}>
                            {alert.symbol.toUpperCase()}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                            data-testid={`badge-condition-${alert.id}`}
                          >
                            {alert.condition === "ABOVE" ? "Above" : "Below"}{" "}
                            ${alert.targetPrice}
                          </Badge>
                          <StatusBadge status={alert.status} alertId={alert.id} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Channels:</span>
                          <ChannelPill
                            icon={Mail}
                            label="Email"
                            enabled={Boolean(alert.notifyEmail)}
                            testId={`channel-email-${alert.id}`}
                          />
                          <ChannelPill
                            icon={Send}
                            label="Telegram"
                            enabled={Boolean(alert.notifyTelegram)}
                            testId={`channel-telegram-${alert.id}`}
                          />
                          <ChannelPill
                            icon={MessageCircle}
                            label="Discord"
                            enabled={Boolean(alert.notifyDiscord)}
                            testId={`channel-discord-${alert.id}`}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMutation.mutate(alert)}
                          disabled={toggleMutation.isPending}
                          data-testid={`button-toggle-${alert.id}`}
                        >
                          {toggleMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : alert.status === "PAUSED" ? (
                            <>
                              <PlayCircle className="h-3.5 w-3.5 mr-1 text-green-500" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="h-3.5 w-3.5 mr-1 text-amber-400" />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(alert)}
                          data-testid={`button-edit-${alert.id}`}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(alert.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${alert.id}`}
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            form.reset();
            setEditingAlert(null);
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-alert-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {editingAlert ? "Edit alert" : "Create new alert"}
            </DialogTitle>
            <DialogDescription>
              Choose a symbol, condition, target price, and how you would like
              to be notified.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alert Name (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. SPY Breakout Watch"
                        {...field}
                        className="bg-background"
                        data-testid="input-alert-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. SPY"
                        {...field}
                        className="bg-background uppercase"
                        data-testid="input-alert-symbol"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background" data-testid="select-condition">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ABOVE" data-testid="option-above">Price moves above</SelectItem>
                          <SelectItem value="BELOW" data-testid="option-below">Price moves below</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target price</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 500"
                          {...field}
                          className="bg-background"
                          data-testid="input-target-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <FormLabel>Notify me via</FormLabel>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <FormField
                    control={form.control}
                    name="notifyEmail"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-notify-email"
                          />
                        </FormControl>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </span>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notifyTelegram"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-notify-telegram"
                          />
                        </FormControl>
                        <span className="flex items-center gap-1">
                          <Send className="h-3.5 w-3.5 text-sky-300" />
                          Telegram
                        </span>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notifyDiscord"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-notify-discord"
                          />
                        </FormControl>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5 text-indigo-300" />
                          Discord
                        </span>
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Make sure your Telegram and Discord connections are properly set
                  up so alerts can be delivered.
                </p>
              </div>

              <DialogFooter className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    form.reset();
                    setEditingAlert(null);
                  }}
                  data-testid="button-cancel-alert"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-submit-alert"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      {editingAlert ? "Saving…" : "Creating…"}
                    </>
                  ) : (
                    editingAlert ? "Save changes" : "Create alert"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, alertId }: { status: AlertStatus; alertId: number }) {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return (
      <Badge 
        variant="secondary"
        className="text-[10px] bg-green-500/10 border-green-500/30 text-green-500"
        data-testid={`badge-status-${alertId}`}
      >
        Active
      </Badge>
    );
  }
  if (normalized === "PAUSED") {
    return (
      <Badge 
        variant="secondary"
        className="text-[10px] bg-amber-400/10 border-amber-400/30 text-amber-400"
        data-testid={`badge-status-${alertId}`}
      >
        Paused
      </Badge>
    );
  }
  if (normalized === "TRIGGERED") {
    return (
      <Badge 
        variant="secondary"
        className="text-[10px] bg-blue-400/10 border-blue-400/30 text-blue-400"
        data-testid={`badge-status-${alertId}`}
      >
        Triggered
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]" data-testid={`badge-status-${alertId}`}>
      {status}
    </Badge>
  );
}

function ChannelPill({
  icon: Icon,
  label,
  enabled,
  testId,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  enabled: boolean;
  testId: string;
}) {
  if (!enabled) {
    return (
      <span 
        className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
        data-testid={testId}
      >
        <Icon className="h-3 w-3 opacity-50" />
        {label}
      </span>
    );
  }
  return (
    <span 
      className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-500"
      data-testid={testId}
    >
      <Icon className="h-3 w-3 text-green-500" />
      {label}
    </span>
  );
}
