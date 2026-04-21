import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Settings2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, PlayCircle, Calendar, Brain, BarChart3, ArrowUpRight, ArrowDownRight, Sparkles, Lock, Search, Bot, Send, RefreshCw, Activity, Vault } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PremiumBadge } from "@/components/FeatureGate";
import { useAuth } from "@/hooks/useAuth";
import { isDeveloper } from "@/lib/authUtils";
import type { 
  SelectTradingStrategy, 
  Strategy, 
  StrategyCondition, 
  ConditionGroup,
  IndicatorType,
  ComparisonOperator,
  OptionAction,
  AdaptiveLearning
} from "@shared/schema";

interface AdaptiveMetricWithGrade extends AdaptiveLearning {
  grade: "A" | "B" | "C" | "D" | "F";
  gradeColor: string;
  gradeDescription: string;
}

type AccountSettingsResponse = {
  role: "free" | "pro" | "premium" | string;
};

function AdaptivePerformanceCard() {
  const [symbolInput, setSymbolInput] = useState("");
  const [querySymbol, setQuerySymbol] = useState<string | null>(null);
  const { user } = useAuth();
  
  const { data: accountSettings } = useQuery<AccountSettingsResponse>({
    queryKey: ["/api/account/settings"],
    enabled: !isDeveloper(user?.id),
  });
  
  const userRole = isDeveloper(user?.id) ? "premium" : (accountSettings?.role || "free");
  const isPro = userRole === "pro";
  const isPremiumOrDev = userRole === "premium" || isDeveloper(user?.id);
  
  const queryKey = querySymbol 
    ? ["/api/adaptive/summary", { symbol: querySymbol }]
    : ["/api/adaptive/summary"];
    
  const { data: adaptiveSummary, isLoading: adaptiveLoading, error, refetch } = useQuery<AdaptiveMetricWithGrade[] | { error: string }>({
    queryKey,
    enabled: isPremiumOrDev || (isPro && !!querySymbol),
  });

  const isError = error || (adaptiveSummary && "error" in adaptiveSummary);
  const errorMessage = error?.message || (adaptiveSummary && "error" in adaptiveSummary ? adaptiveSummary.error : null);
  
  const handleSymbolSearch = () => {
    if (symbolInput.trim()) {
      setQuerySymbol(symbolInput.trim().toUpperCase());
    }
  };

  // Show locked state for free users
  if (userRole === "free") {
    return (
      <Card className="border-purple-500/30 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-lg">Adaptive Performance</CardTitle>
              <PremiumBadge />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">Upgrade to Premium to access adaptive performance metrics.</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Show symbol input for Pro users
  if (isPro && !querySymbol) {
    return (
      <Card className="border-blue-500/30 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-lg">Adaptive Performance</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">Pro</Badge>
          </div>
          <CardDescription>
            Enter a symbol to view its performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter symbol (e.g., AAPL)"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSymbolSearch()}
              className="max-w-xs font-mono"
              data-testid="input-adaptive-symbol"
            />
            <Button onClick={handleSymbolSearch} size="sm" data-testid="button-search-adaptive">
              Search
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Pro users can look up metrics for individual symbols. Upgrade to Premium for full access to all symbols.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isError && !isPro) {
    return (
      <Card className="border-purple-500/30 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-lg">Adaptive Performance</CardTitle>
              <PremiumBadge />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">{errorMessage || "Upgrade to Premium to access adaptive performance metrics."}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (adaptiveLoading) {
    return (
      <Card className="border-purple-500/30 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg">Adaptive Performance</CardTitle>
            <PremiumBadge />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = Array.isArray(adaptiveSummary) ? adaptiveSummary : [];

  if (metrics.length === 0) {
    return (
      <Card className="border-purple-500/30 bg-card/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-lg">Adaptive Performance</CardTitle>
            <PremiumBadge />
          </div>
          <CardDescription>
            AI-powered performance tracking based on your signal history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No signal outcome data available yet. Generate some signals and record their outcomes to see adaptive metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "DECLINING":
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return "text-green-500";
      case "DECLINING":
        return "text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "B":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "C":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "D":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "F":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const borderColor = isPro ? "border-blue-500/30" : "border-purple-500/30";
  const iconColor = isPro ? "text-blue-400" : "text-purple-400";
  
  return (
    <Card className={`${borderColor} bg-card/50`} data-testid="card-adaptive-performance">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className={`h-5 w-5 ${iconColor}`} />
            <CardTitle className="text-lg">Adaptive Performance (Beta)</CardTitle>
            {isPro ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/30">Pro</Badge>
            ) : (
              <PremiumBadge />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPro && querySymbol && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setQuerySymbol(null); setSymbolInput(""); }}
                data-testid="button-clear-symbol"
              >
                Search Another
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {isPro && querySymbol ? `Viewing: ${querySymbol}` : `${metrics.length} symbols tracked`}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {isPro ? `Performance metrics for ${querySymbol}` : "Real-time learning metrics from your signal history"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 font-medium text-muted-foreground">Symbol</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Grade</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Win Rate</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Total</th>
                <th className="text-center py-2 px-2 font-medium text-muted-foreground">Trend</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(0, 10).map((m) => (
                <tr key={m.symbol} className="border-b border-border/30 hover:bg-muted/20" data-testid={`row-adaptive-${m.symbol}`}>
                  <td className="py-2 px-2">
                    <span className="font-mono font-medium text-foreground">{m.symbol}</span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge variant="outline" className={`text-xs ${getGradeColor(m.grade)}`}>
                      {m.grade}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className="font-mono">{(m.successRate * 100).toFixed(1)}%</span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <span className="font-mono text-muted-foreground">{m.totalSignals}</span>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {getTrendIcon(m.recentTrend || "STABLE")}
                      <span className={`text-xs ${getTrendColor(m.recentTrend || "STABLE")}`}>
                        {(m.recentTrend || "STABLE").toLowerCase()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {metrics.length > 10 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Showing top 10 of {metrics.length} tracked symbols
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const INDICATOR_OPTIONS: { value: IndicatorType; label: string; requiresPeriod: boolean }[] = [
  { value: "PRICE", label: "Current Price", requiresPeriod: false },
  { value: "SMA", label: "Simple Moving Average (SMA)", requiresPeriod: true },
  { value: "EMA", label: "Exponential Moving Average (EMA)", requiresPeriod: true },
  { value: "RSI", label: "Relative Strength Index (RSI)", requiresPeriod: true },
  { value: "MACD", label: "MACD Line", requiresPeriod: false },
  { value: "MACD_SIGNAL", label: "MACD Signal Line", requiresPeriod: false },
  { value: "MACD_HISTOGRAM", label: "MACD Histogram", requiresPeriod: false },
];

const OPERATOR_OPTIONS: { value: ComparisonOperator; label: string }[] = [
  { value: "GREATER_THAN", label: "Greater than (>)" },
  { value: "LESS_THAN", label: "Less than (<)" },
  { value: "CROSSES_ABOVE", label: "Crosses above" },
  { value: "CROSSES_BELOW", label: "Crosses below" },
  { value: "EQUALS", label: "Equals (=)" },
];

function ConditionBuilder({ 
  condition, 
  onChange, 
  onRemove 
}: { 
  condition: StrategyCondition; 
  onChange: (c: StrategyCondition) => void; 
  onRemove: () => void;
}) {
  const indicatorOption = INDICATOR_OPTIONS.find(o => o.value === condition.indicator);
  const requiresPeriod = indicatorOption?.requiresPeriod ?? false;
  
  const compareToType = condition.compareTo.type;
  
  return (
    <div className="flex flex-wrap items-end gap-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex-1 min-w-[150px] space-y-2">
        <Label className="text-xs uppercase tracking-wide">Indicator</Label>
        <Select 
          value={condition.indicator} 
          onValueChange={(v) => onChange({ ...condition, indicator: v as IndicatorType })}
        >
          <SelectTrigger data-testid="select-indicator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INDICATOR_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {requiresPeriod && (
        <div className="w-24 space-y-2">
          <Label className="text-xs uppercase tracking-wide">Period</Label>
          <Input 
            type="number" 
            min={1} 
            max={200}
            value={condition.period || 14}
            onChange={(e) => onChange({ ...condition, period: parseInt(e.target.value) || 14 })}
            data-testid="input-period"
          />
        </div>
      )}
      
      <div className="flex-1 min-w-[140px] space-y-2">
        <Label className="text-xs uppercase tracking-wide">Operator</Label>
        <Select 
          value={condition.operator} 
          onValueChange={(v) => onChange({ ...condition, operator: v as ComparisonOperator })}
        >
          <SelectTrigger data-testid="select-operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATOR_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="w-28 space-y-2">
        <Label className="text-xs uppercase tracking-wide">Compare To</Label>
        <Select 
          value={compareToType} 
          onValueChange={(v) => {
            if (v === "VALUE") {
              onChange({ ...condition, compareTo: { type: "VALUE", value: 0 } });
            } else {
              onChange({ ...condition, compareTo: { type: "INDICATOR", indicator: "SMA", period: 20 } });
            }
          }}
        >
          <SelectTrigger data-testid="select-compare-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="VALUE">Fixed Value</SelectItem>
            <SelectItem value="INDICATOR">Indicator</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {compareToType === "VALUE" && (
        <div className="w-24 space-y-2">
          <Label className="text-xs uppercase tracking-wide">Value</Label>
          <Input 
            type="number" 
            step="0.01"
            value={condition.compareTo.type === "VALUE" ? condition.compareTo.value : 0}
            onChange={(e) => onChange({ 
              ...condition, 
              compareTo: { type: "VALUE", value: parseFloat(e.target.value) || 0 } 
            })}
            data-testid="input-compare-value"
          />
        </div>
      )}
      
      {compareToType === "INDICATOR" && (
        <>
          <div className="flex-1 min-w-[150px] space-y-2">
            <Label className="text-xs uppercase tracking-wide">Target Indicator</Label>
            <Select 
              value={condition.compareTo.type === "INDICATOR" ? condition.compareTo.indicator : "SMA"} 
              onValueChange={(v) => onChange({ 
                ...condition, 
                compareTo: { 
                  type: "INDICATOR", 
                  indicator: v as IndicatorType,
                  period: condition.compareTo.type === "INDICATOR" ? condition.compareTo.period : 20
                } 
              })}
            >
              <SelectTrigger data-testid="select-compare-indicator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDICATOR_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {condition.compareTo.type === "INDICATOR" && 
           INDICATOR_OPTIONS.find(o => o.value === (condition.compareTo as { type: "INDICATOR"; indicator: IndicatorType; period?: number }).indicator)?.requiresPeriod && (
            <div className="w-24 space-y-2">
              <Label className="text-xs uppercase tracking-wide">Period</Label>
              <Input 
                type="number" 
                min={1} 
                max={200}
                value={condition.compareTo.period || 20}
                onChange={(e) => onChange({ 
                  ...condition, 
                  compareTo: { 
                    ...condition.compareTo,
                    type: "INDICATOR",
                    period: parseInt(e.target.value) || 20 
                  } as StrategyCondition["compareTo"]
                })}
                data-testid="input-compare-period"
              />
            </div>
          )}
        </>
      )}
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onRemove}
        className="text-destructive hover:text-destructive"
        data-testid="button-remove-condition"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ConditionGroupBuilder({ 
  group, 
  index,
  onChange, 
  onRemove 
}: { 
  group: ConditionGroup; 
  index: number;
  onChange: (g: ConditionGroup) => void; 
  onRemove: () => void;
}) {
  const addCondition = () => {
    const newCondition: StrategyCondition = {
      indicator: "RSI",
      period: 14,
      operator: "LESS_THAN",
      compareTo: { type: "VALUE", value: 30 }
    };
    onChange({ ...group, conditions: [...group.conditions, newCondition] });
  };
  
  const updateCondition = (i: number, condition: StrategyCondition) => {
    const newConditions = [...group.conditions];
    newConditions[i] = condition;
    onChange({ ...group, conditions: newConditions });
  };
  
  const removeCondition = (i: number) => {
    onChange({ ...group, conditions: group.conditions.filter((_, idx) => idx !== i) });
  };
  
  return (
    <Card className="border-2 border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline">Group {index + 1}</Badge>
            <Select 
              value={group.logic} 
              onValueChange={(v) => onChange({ ...group, logic: v as "AND" | "OR" })}
            >
              <SelectTrigger className="w-24" data-testid={`select-logic-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {group.logic === "AND" ? "All conditions must be true" : "Any condition can be true"}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRemove}
            className="text-destructive"
            data-testid={`button-remove-group-${index}`}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove Group
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.conditions.map((condition, i) => (
          <ConditionBuilder
            key={i}
            condition={condition}
            onChange={(c) => updateCondition(i, c)}
            onRemove={() => removeCondition(i)}
          />
        ))}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={addCondition}
          className="w-full"
          data-testid={`button-add-condition-${index}`}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Condition
        </Button>
      </CardContent>
    </Card>
  );
}

function StrategyBuilder({ 
  strategy, 
  onSave, 
  onCancel,
  isLoading 
}: { 
  strategy?: SelectTradingStrategy;
  onSave: (s: Strategy) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(strategy?.name || "");
  const [description, setDescription] = useState(strategy?.description || "");
  const [action, setAction] = useState<OptionAction>(
    (strategy?.action as OptionAction) || "BUY_CALL"
  );
  const [priority, setPriority] = useState(strategy?.priority || 50);
  const [enabled, setEnabled] = useState(strategy?.enabled === 1 || strategy?.enabled === undefined);
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>(() => {
    if (strategy?.conditionGroups) {
      try {
        return JSON.parse(strategy.conditionGroups);
      } catch {
        return [{ logic: "AND", conditions: [] }];
      }
    }
    return [{ 
      logic: "AND" as const, 
      conditions: [{
        indicator: "RSI" as const,
        period: 14,
        operator: "LESS_THAN" as const,
        compareTo: { type: "VALUE" as const, value: 30 }
      }] 
    }];
  });
  
  const addConditionGroup = () => {
    setConditionGroups([...conditionGroups, { 
      logic: "AND", 
      conditions: [{
        indicator: "PRICE",
        operator: "GREATER_THAN",
        compareTo: { type: "INDICATOR", indicator: "SMA", period: 20 }
      }] 
    }]);
  };
  
  const updateConditionGroup = (i: number, group: ConditionGroup) => {
    const newGroups = [...conditionGroups];
    newGroups[i] = group;
    setConditionGroups(newGroups);
  };
  
  const removeConditionGroup = (i: number) => {
    setConditionGroups(conditionGroups.filter((_, idx) => idx !== i));
  };
  
  const handleSubmit = () => {
    if (!name.trim()) return;
    if (conditionGroups.length === 0) return;
    if (conditionGroups.some(g => g.conditions.length === 0)) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      action,
      conditionGroups,
      enabled,
      priority
    });
  };
  
  const isValid = name.trim() && conditionGroups.length > 0 && conditionGroups.every(g => g.conditions.length > 0);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="strategy-name">Strategy Name</Label>
          <Input 
            id="strategy-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., RSI Oversold Buy"
            data-testid="input-strategy-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as OptionAction)}>
              <SelectTrigger data-testid="select-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY_CALL">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" /> Buy Call
                  </span>
                </SelectItem>
                <SelectItem value="BUY_PUT">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" /> Buy Put
                  </span>
                </SelectItem>
                <SelectItem value="SELL_CALL">
                  <span className="flex items-center gap-2">
                    <ArrowDownRight className="h-4 w-4 text-orange-500" /> Sell Call
                  </span>
                </SelectItem>
                <SelectItem value="SELL_PUT">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-blue-500" /> Sell Put
                  </span>
                </SelectItem>
                <SelectItem value="HOLD">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" /> Hold
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority (1-100)</Label>
            <Input 
              type="number" 
              min={1} 
              max={100}
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 50)}
              data-testid="input-priority"
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="strategy-description">Description (optional)</Label>
        <Textarea 
          id="strategy-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe when this strategy triggers..."
          rows={2}
          data-testid="input-description"
        />
      </div>
      
      <div className="flex items-center gap-3">
        <Switch 
          checked={enabled} 
          onCheckedChange={setEnabled}
          data-testid="switch-enabled"
        />
        <Label>Strategy Enabled</Label>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Condition Groups</h3>
          <span className="text-sm text-muted-foreground">Groups are connected by AND</span>
        </div>
        
        {conditionGroups.map((group, i) => (
          <ConditionGroupBuilder
            key={i}
            group={group}
            index={i}
            onChange={(g) => updateConditionGroup(i, g)}
            onRemove={() => removeConditionGroup(i)}
          />
        ))}
        
        <Button 
          variant="outline" 
          onClick={addConditionGroup}
          className="w-full"
          data-testid="button-add-group"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Condition Group
        </Button>
      </div>
      
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!isValid || isLoading}
          data-testid="button-save-strategy"
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {strategy ? "Update Strategy" : "Create Strategy"}
        </Button>
      </div>
    </div>
  );
}

interface BacktestResult {
  strategyId: number;
  strategyName: string;
  symbol: string;
  signals: Array<{
    date: string;
    action: "BUY" | "SELL";
    price: number;
  }>;
  totalSignals: number;
  period: string;
}

interface AdaptiveEngineSummary {
  symbol: string;
  totalSignals: number;
  successRate: number;
  recentTrend?: "IMPROVING" | "STABLE" | "DECLINING";
  grade: "A" | "B" | "C" | "D" | "F";
  gradeColor: string;
  gradeDescription: string;
}

interface AdaptiveApiResponse {
  symbol: string;
  metrics: AdaptiveEngineSummary;
}

function MLBacktestPanel() {
  const [symbol, setSymbol] = useState("IWM");
  const { user } = useAuth();
  
  const { data: accountSettings } = useQuery<AccountSettingsResponse>({
    queryKey: ["/api/account/settings"],
    enabled: !isDeveloper(user?.id),
  });
  
  const userRole = isDeveloper(user?.id) ? "premium" : (accountSettings?.role || "free");
  const isPremiumOrDev = userRole === "premium" || isDeveloper(user?.id);
  
  const { data: adaptiveData, isLoading: adaptiveLoading, error: adaptiveError } = useQuery<AdaptiveApiResponse | AdaptiveEngineSummary[] | { error: string }>({
    queryKey: ["/api/adaptive/summary", symbol],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/adaptive/summary?symbol=${symbol.toUpperCase()}`);
      return response.json();
    },
    enabled: !!symbol.trim() && (userRole === "pro" || isPremiumOrDev),
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "DECLINING":
        return <TrendingDown className="h-4 w-4 text-red-400" />;
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return "text-green-500";
      case "DECLINING":
        return "text-red-400";
      default:
        return "text-muted-foreground";
    }
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "bg-green-500/20 text-green-500 border-green-500/30";
      case "B":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "C":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "D":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "F":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const isError = adaptiveError || (adaptiveData && "error" in adaptiveData);
  
  // Handle API response structure: { symbol, metrics: {...} } for per-symbol queries
  // or array of metrics for full list queries
  const extractMetrics = (): AdaptiveEngineSummary | null => {
    if (!adaptiveData || "error" in adaptiveData) return null;
    if (Array.isArray(adaptiveData)) return adaptiveData[0] || null;
    // Per-symbol query returns { symbol, metrics: {...} }
    if ("metrics" in adaptiveData && adaptiveData.metrics) {
      return adaptiveData.metrics;
    }
    return null;
  };
  const metrics = extractMetrics();

  // Show locked state for free users
  if (userRole === "free") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Adaptive Engine (Beta)
              </CardTitle>
              <CardDescription>
                Iron Strike&apos;s global AI model learns from all signals and outcomes. It updates automatically in the background; manual training is not required.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span className="text-sm">Upgrade to Pro or Premium to access adaptive metrics.</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-2 opacity-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Symbol Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Lock className="h-6 w-6 mr-2" />
                Upgrade required
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Adaptive Engine (Beta)
            </CardTitle>
            <CardDescription>
              Iron Strike&apos;s global AI model learns from all signals and outcomes. It updates automatically in the background; manual training is not required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <div className="flex gap-2">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="IWM"
                  className="font-mono flex-1"
                  data-testid="input-adaptive-symbol-tab"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      queryClient.invalidateQueries({ queryKey: ["/api/adaptive/summary", symbol] });
                    }
                  }}
                />
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/adaptive/summary", symbol] })}
                  disabled={!symbol.trim() || adaptiveLoading}
                  data-testid="button-adaptive-lookup"
                >
                  {adaptiveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Enter a symbol and click lookup to view its adaptive performance metrics. The engine automatically tracks:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Total signals generated</li>
                <li>Success rate (win %)</li>
                <li>Confidence grade (A-F)</li>
                <li>Recent trend direction</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Symbol Performance
              {symbol && (
                <Badge variant="outline" className="ml-2 font-mono">
                  {symbol}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Real-time learning metrics from your signal history
            </CardDescription>
          </CardHeader>
          <CardContent>
            {adaptiveLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {adaptiveError?.message || (adaptiveData && "error" in adaptiveData ? adaptiveData.error : "No data available for this symbol")}
                </p>
              </div>
            ) : metrics ? (
              metrics.totalSignals === 0 ? (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    No signals generated yet for <span className="font-mono font-semibold text-foreground">{symbol}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Generate some signals on the Dashboard, then check back to see adaptive metrics.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Total Signals</p>
                      <p className="text-2xl font-mono font-bold">{metrics.totalSignals ?? 0}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
                      <p className="text-2xl font-mono font-bold">{typeof metrics.successRate === 'number' ? (metrics.successRate * 100).toFixed(1) : '0.0'}%</p>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Grade</p>
                      <Badge variant="outline" className={`text-lg px-3 py-1 ${getGradeColor(metrics.grade)}`}>
                        {metrics.grade}
                      </Badge>
                    </div>
                    <div className="text-center p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Trend</p>
                      <div className="flex items-center justify-center gap-1">
                        {getTrendIcon(metrics.recentTrend || "STABLE")}
                        <span className={`text-sm ${getTrendColor(metrics.recentTrend || "STABLE")}`}>
                          {(metrics.recentTrend || "STABLE").toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{metrics.gradeDescription}</span>
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-8">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No signal data available for {symbol || "this symbol"}. Generate some signals to see adaptive metrics.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BacktestDialog({ strategy }: { strategy: SelectTradingStrategy }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState("AAPL");
  const [period, setPeriod] = useState("3mo");
  const [result, setResult] = useState<BacktestResult | null>(null);
  
  const backtestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/strategies/${strategy.id}/backtest`, { 
        symbol: symbol.toUpperCase(), 
        period 
      });
      return response.json();
    },
    onSuccess: (data: BacktestResult) => {
      setResult(data);
    },
    onError: (error: Error) => {
      toast({ title: "Backtest failed", description: error.message, variant: "destructive" });
    }
  });
  
  const handleRun = () => {
    if (!symbol.trim()) return;
    backtestMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-backtest-${strategy.id}`}>
          <PlayCircle className="h-4 w-4 mr-1" />
          Backtest
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Backtest: {strategy.name}</DialogTitle>
          <DialogDescription>
            Run this strategy against historical data to see when it would have triggered signals.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="backtest-symbol">Symbol</Label>
              <Input 
                id="backtest-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="AAPL"
                data-testid="input-backtest-symbol"
              />
            </div>
            <div className="w-36 space-y-2">
              <Label>Time Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="select-backtest-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1mo">1 Month</SelectItem>
                  <SelectItem value="3mo">3 Months</SelectItem>
                  <SelectItem value="6mo">6 Months</SelectItem>
                  <SelectItem value="1y">1 Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleRun} 
                disabled={!symbol.trim() || backtestMutation.isPending}
                data-testid="button-run-backtest"
              >
                {backtestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                Run
              </Button>
            </div>
          </div>
          
          {result && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Results for {result.symbol}</CardTitle>
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {result.period}
                  </Badge>
                </div>
                <CardDescription>
                  Found {result.totalSignals} {result.totalSignals === 1 ? "signal" : "signals"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.signals.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    No signals generated during this period. The strategy conditions were not met.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.signals.map((signal, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Badge variant={signal.action === "BUY" ? "default" : "destructive"}>
                            {signal.action}
                          </Badge>
                          <span className="text-sm font-mono">${signal.price.toFixed(2)}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{signal.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StrategyCard({ strategy, onEdit, onDelete }: { 
  strategy: SelectTradingStrategy; 
  onEdit: () => void;
  onDelete: () => void;
}) {
  const conditionGroups: ConditionGroup[] = (() => {
    try {
      return JSON.parse(strategy.conditionGroups);
    } catch {
      return [];
    }
  })();
  
  const totalConditions = conditionGroups.reduce((sum, g) => sum + g.conditions.length, 0);
  
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{strategy.name}</CardTitle>
              <Badge variant={strategy.action === "BUY" ? "default" : "destructive"}>
                {strategy.action === "BUY" ? (
                  <><TrendingUp className="h-3 w-3 mr-1" /> BUY</>
                ) : (
                  <><TrendingDown className="h-3 w-3 mr-1" /> SELL</>
                )}
              </Badge>
              {strategy.enabled ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mr-1" /> Disabled
                </Badge>
              )}
            </div>
            {strategy.description && (
              <CardDescription className="mt-1">{strategy.description}</CardDescription>
            )}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-${strategy.id}`}>
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
              data-testid={`button-delete-${strategy.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Priority: {strategy.priority}</span>
            <span>{conditionGroups.length} group(s)</span>
            <span>{totalConditions} condition(s)</span>
          </div>
          <BacktestDialog strategy={strategy} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Strategies() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<SelectTradingStrategy | undefined>();
  
  const { data: strategies = [], isLoading } = useQuery<SelectTradingStrategy[]>({
    queryKey: ["/api/strategies"],
  });
  
  const createMutation = useMutation({
    mutationFn: async (strategy: Strategy) => {
      return apiRequest("POST", "/api/strategies", strategy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsDialogOpen(false);
      setEditingStrategy(undefined);
      toast({ title: "Strategy created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create strategy", description: error.message, variant: "destructive" });
    }
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ id, strategy }: { id: number; strategy: Partial<Strategy> }) => {
      return apiRequest("PATCH", `/api/strategies/${id}`, strategy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsDialogOpen(false);
      setEditingStrategy(undefined);
      toast({ title: "Strategy updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update strategy", description: error.message, variant: "destructive" });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/strategies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete strategy", description: error.message, variant: "destructive" });
    }
  });
  
  const handleSave = (strategy: Strategy) => {
    if (editingStrategy) {
      updateMutation.mutate({ id: editingStrategy.id, strategy });
    } else {
      createMutation.mutate(strategy);
    }
  };
  
  const handleEdit = (strategy: SelectTradingStrategy) => {
    setEditingStrategy(strategy);
    setIsDialogOpen(true);
  };
  
  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this strategy?")) {
      deleteMutation.mutate(id);
    }
  };
  
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingStrategy(undefined);
  };
  
  return (
    <div className="min-h-screen bg-background text-foreground font-sans" data-testid="strategies-page">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-muted border border-border rounded-lg">
            <Vault className="h-6 w-6 text-accent" />
          </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-page-title">Strategy Vault</h1>
          <p className="text-muted-foreground">
            Create custom rule-based strategies or use ML-powered predictions
          </p>
        </div>
      </div>

      <AdaptivePerformanceCard />
      
      <Tabs defaultValue="rule-based" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="rule-based" data-testid="tab-rule-based">
            <Settings2 className="h-4 w-4 mr-2" />
            Rule-Based
          </TabsTrigger>
          <TabsTrigger value="ml-backtest" data-testid="tab-ml-backtest">
            <Brain className="h-4 w-4 mr-2" />
            Adaptive Engine
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="rule-based" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingStrategy(undefined)} data-testid="button-new-strategy">
                  <Plus className="h-4 w-4 mr-2" />
                  New Strategy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingStrategy ? "Edit Strategy" : "Create New Strategy"}</DialogTitle>
                  <DialogDescription>
                    Define conditions using technical indicators to trigger buy or sell signals.
                  </DialogDescription>
                </DialogHeader>
                <StrategyBuilder
                  strategy={editingStrategy}
                  onSave={handleSave}
                  onCancel={handleDialogClose}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : strategies.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <Settings2 className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No strategies yet</h3>
                  <p className="text-muted-foreground">Create your first trading strategy to get started</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strategy
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {strategies.map((strategy) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  onEdit={() => handleEdit(strategy)}
                  onDelete={() => handleDelete(strategy.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="ml-backtest">
          <MLBacktestPanel />
        </TabsContent>
      </Tabs>
      
      <IronStrikeCoachPanel context="strategy" />
      </div>
    </div>
  );
}

function IronStrikeCoachPanel({ context }: { context: string }) {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [insight, setInsight] = useState("Ready to help with your trading strategies...");

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/chat', {
        message: `Role: You are "Iron Strike Coach", an advanced AI trading mentor.
Task: Provide a brief insight about building effective trading strategies.
Context: User is on the Strategy Vault page.

Output: Provide 2-3 sentences of actionable advice about strategy development.
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
Context: User is on the Strategy Vault page building trading strategies.
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
    { label: "Strategy Tips", query: "What makes a good trading strategy?" },
    { label: "Risk Management", query: "How should I set stop losses?" },
    { label: "Backtesting", query: "How do I interpret backtest results?" },
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
              AI Strategy Mentor
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
            <Activity className="w-3 h-3" /> Strategy Insight
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
