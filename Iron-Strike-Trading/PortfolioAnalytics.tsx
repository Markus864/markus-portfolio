import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { 
  Briefcase, TrendingUp, TrendingDown, DollarSign, Percent, 
  Clock, PlusCircle, BookOpen, MessageSquare, Trash2, Loader2,
  Target, AlertTriangle, Award, Activity, CheckCircle, XCircle,
  BarChart3, PieChartIcon, Plus, Filter, Calendar, Tag, Edit, Eye, Download,
  Lock, Crown, Zap, Sparkles, Camera, Upload, Image
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUserTier } from "@/hooks/use-user-tier";
import { FeatureGate, UpgradeBanner } from "@/components/UpgradeBanner";
import { AICoachingPanel } from "@/components/AICoachingPanel";
import type { SelectTradeExecution, SelectTradeJournalEntry, PortfolioSummary, PerformanceMetrics } from "@shared/schema";

const CHART_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#8b5cf6"];

function StatCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend,
  className = ""
}: { 
  title: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${trendColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold font-mono ${trendColor}`}>{value}</div>
        {subValue && (
          <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
        )}
      </CardContent>
    </Card>
  );
}

function JournalEntryDialog({ trade }: { trade: SelectTradeExecution }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [entryType, setEntryType] = useState("pre-trade");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  
  const { data: entries = [], isLoading: entriesLoading } = useQuery<SelectTradeJournalEntry[]>({
    queryKey: ["/api/journal/trade", trade.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/trade/${trade.id}`);
      return res.json();
    },
    enabled: isOpen
  });
  
  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/journal", {
        tradeId: trade.id,
        entryType,
        content,
        tags: tags.length > 0 ? tags : undefined,
        mood: mood || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/trade", trade.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      setContent("");
      setMood("");
      setTags([]);
      toast({ title: "Journal entry added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add entry", description: error.message, variant: "destructive" });
    }
  });
  
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/journal/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/trade", trade.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      toast({ title: "Entry deleted" });
    }
  });
  
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };
  
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-journal-${trade.id}`}>
          <BookOpen className="h-4 w-4 mr-1" />
          Journal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Trade Journal: {trade.symbol}
          </DialogTitle>
          <DialogDescription>
            Record your thoughts, lessons learned, and track your trading psychology.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="entries" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entries" data-testid="tab-journal-entries">
              Entries ({entries.length})
            </TabsTrigger>
            <TabsTrigger value="new" data-testid="tab-journal-new">
              Add Entry
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="entries" className="space-y-3">
            <ScrollArea className="h-80">
              {entriesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No journal entries yet</p>
                  <p className="text-sm">Switch to "Add Entry" to record your thoughts</p>
                </div>
              ) : (
                <div className="space-y-3 pr-4">
                  {entries.map((entry) => {
                    const entryTags = entry.tags ? JSON.parse(entry.tags) : [];
                    return (
                      <Card key={entry.id} className="hover-elevate">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.entryType}</Badge>
                              {entry.mood && (
                                <Badge variant="secondary">{entry.mood}</Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(entry.id)}
                              data-testid={`button-delete-entry-${entry.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
                          {entryTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {entryTags.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  #{tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                        <CardFooter className="pt-0">
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="new" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entry Type</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger data-testid="select-entry-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pre-trade">Pre-Trade Analysis</SelectItem>
                    <SelectItem value="during">During Trade</SelectItem>
                    <SelectItem value="post-trade">Post-Trade Review</SelectItem>
                    <SelectItem value="lesson">Lesson Learned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Mood/Mindset</Label>
                <Select value={mood} onValueChange={setMood}>
                  <SelectTrigger data-testid="select-mood">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="nervous">Nervous</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="regretful">Regretful</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Write your thoughts, analysis, or lessons learned..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-32"
                data-testid="textarea-content"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  data-testid="input-tag"
                />
                <Button variant="outline" onClick={addTag} type="button">
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      #{tag} <span className="ml-1 text-destructive">x</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <Button 
              onClick={() => createMutation.mutate()} 
              disabled={!content.trim() || createMutation.isPending}
              className="w-full"
              data-testid="button-save-entry"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-2" />
              )}
              Save Entry
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CloseTradeDialog({ trade, onClose }: { trade: SelectTradeExecution; onClose: () => void }) {
  const { toast } = useToast();
  const [entryPremium, setEntryPremium] = useState(trade.entryPremium);
  const [exitPremium, setExitPremium] = useState("");
  const [notes, setNotes] = useState("");
  
  const closeTradeMutation = useMutation({
    mutationFn: async ({ id, exitPremium, entryPremium, notes }: { id: number; exitPremium: number; entryPremium?: number; notes?: string }) => {
      const response = await apiRequest("POST", `/api/trades/${id}/close`, { exitPremium, entryPremium, notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/closed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      onClose();
      toast({
        title: "Trade Closed",
        description: "Trade has been closed and performance metrics updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Close Trade",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleCloseTrade = () => {
    if (exitPremium === "") return;
    const entryPremiumChanged = entryPremium !== trade.entryPremium;
    closeTradeMutation.mutate({
      id: trade.id,
      exitPremium: parseFloat(exitPremium),
      entryPremium: entryPremiumChanged ? parseFloat(entryPremium) : undefined,
      notes: notes || undefined,
    });
  };
  
  const entryPremiumNum = parseFloat(entryPremium) || 0;
  const exitPremiumNum = parseFloat(exitPremium) || 0;
  
  // Use absolute values for correct calculations regardless of sign
  const absEntry = Math.abs(entryPremiumNum);
  const absExit = Math.abs(exitPremiumNum);
  const totalCostNum = absEntry * trade.contracts * trade.contractMultiplier;
  
  // Calculate P&L based on option side (LONG vs SHORT)
  const isLong = trade.optionSide === "LONG";
  const estimatedPnL = exitPremium !== "" 
    ? (isLong ? (absExit - absEntry) : (absEntry - absExit)) * trade.contracts * trade.contractMultiplier 
    : 0;
  // Calculate percentage based on initial investment
  const estimatedPnLPercent = exitPremium !== "" && absEntry > 0
    ? (estimatedPnL / (absEntry * trade.contracts * trade.contractMultiplier)) * 100
    : (estimatedPnL !== 0 ? Infinity : 0);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono font-bold">
          {trade.symbol}
        </Badge>
        <Badge variant={trade.action.includes("BUY") ? "default" : "destructive"}>
          {trade.action}
        </Badge>
        {trade.optionType && (
          <Badge variant="secondary">{trade.optionType}</Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Contracts</p>
          <p className="font-mono font-medium">{trade.contracts}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Strike Price</p>
          <p className="font-mono font-medium">${trade.strikePrice ? parseFloat(trade.strikePrice).toFixed(2) : "N/A"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Position</p>
          <p className="font-mono font-medium">{trade.optionSide || "LONG"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Cost</p>
          <p className="font-mono font-medium">${totalCostNum.toFixed(2)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Entry Premium</label>
          <Input
            type="number"
            step="0.01"
            placeholder="Entry premium..."
            value={entryPremium}
            onChange={(e) => setEntryPremium(e.target.value)}
            data-testid="input-entry-premium"
          />
          <p className="text-xs text-muted-foreground">Edit if AI parser made a mistake</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Exit Premium</label>
          <Input
            type="number"
            step="0.01"
            placeholder="Exit premium..."
            value={exitPremium}
            onChange={(e) => setExitPremium(e.target.value)}
            data-testid="input-exit-premium"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Input
          placeholder="Add notes about this trade..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="input-trade-notes"
        />
      </div>
      {exitPremium !== "" && (
        <div className="p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Estimated P&L</p>
          <p className={`text-xl font-bold font-mono ${estimatedPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
            {estimatedPnL >= 0 ? "+" : ""}${estimatedPnL.toFixed(2)} ({Number.isFinite(estimatedPnLPercent) ? `${estimatedPnLPercent.toFixed(2)}%` : "N/A"})
          </p>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleCloseTrade} 
          disabled={exitPremium === "" || closeTradeMutation.isPending}
          data-testid="button-confirm-close"
        >
          {closeTradeMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Close Trade
        </Button>
      </DialogFooter>
    </div>
  );
}

function TradeCard({ trade, showCloseButton = false }: { trade: SelectTradeExecution; showCloseButton?: boolean }) {
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const pnl = trade.profitLoss ? parseFloat(trade.profitLoss) : 0;
  const pnlPercent = trade.profitLossPercent ? parseFloat(trade.profitLossPercent) : 0;
  const isWinner = pnl > 0;
  const isOpen = trade.status === "open";
  
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/trades/${trade.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance/metrics"] });
      toast({ title: "Trade deleted successfully" });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete trade", description: error.message, variant: "destructive" });
    }
  });
  
  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-bold font-mono">{trade.symbol}</span>
            <Badge variant={trade.action.includes("BUY") ? "default" : "destructive"}>
              {trade.action}
            </Badge>
            {trade.optionType && (
              <Badge variant="secondary">{trade.optionType}</Badge>
            )}
            <Badge variant={isOpen ? "outline" : isWinner ? "default" : "destructive"}>
              {isOpen ? (
                <><Clock className="h-3 w-3 mr-1" /> Open</>
              ) : isWinner ? (
                <><TrendingUp className="h-3 w-3 mr-1" /> Profit</>
              ) : (
                <><TrendingDown className="h-3 w-3 mr-1" /> Loss</>
              )}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <JournalDetailSheet trade={trade}>
              <Button variant="ghost" size="icon" data-testid={`button-journal-${trade.id}`}>
                <Edit className="h-4 w-4" />
              </Button>
            </JournalDetailSheet>
            <JournalEntryDialog trade={trade} />
            {showCloseButton && isOpen && (
              <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid={`button-close-trade-${trade.id}`}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close Trade</DialogTitle>
                    <DialogDescription>
                      Enter the exit premium to close this trade and calculate your P&L.
                    </DialogDescription>
                  </DialogHeader>
                  <CloseTradeDialog trade={trade} onClose={() => setCloseDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" data-testid={`button-delete-trade-${trade.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Trade</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this trade? This action cannot be undone.
                    All journal entries for this trade will also be deleted.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-confirm-delete-${trade.id}`}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Trade
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <CardDescription>
          {trade.optionType} {trade.optionSide} • Strike: ${trade.strikePrice ? parseFloat(trade.strikePrice).toFixed(2) : "N/A"} • Exp: {trade.expirationDate}
          <br />
          Executed {new Date(trade.executedAt).toLocaleDateString()}
          {trade.closedAt && ` • Closed ${new Date(trade.closedAt).toLocaleDateString()}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isOpen && (
          <div className="text-center py-3 mb-4 rounded-lg bg-muted/50">
            <p className={`text-2xl font-bold font-mono ${isWinner ? "text-green-500" : "text-red-500"}`}>
              {isWinner ? "+" : ""}${pnl.toFixed(2)}
            </p>
            <p className={`text-sm ${isWinner ? "text-green-500" : "text-red-500"}`}>
              {isWinner ? "+" : ""}{pnlPercent.toFixed(2)}%
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Entry Premium</span>
            <p className="font-mono font-medium">${parseFloat(trade.entryPremium).toFixed(2)}</p>
          </div>
          {trade.exitPremium && (
            <div>
              <span className="text-muted-foreground">Exit Premium</span>
              <p className="font-mono font-medium">${parseFloat(trade.exitPremium).toFixed(2)}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Contracts</span>
            <p className="font-mono font-medium">{trade.contracts}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Total Cost</span>
            <p className="font-mono font-medium">${parseFloat(trade.totalCost).toFixed(2)}</p>
          </div>
          {isOpen && (
            <>
              <div>
                <span className="text-muted-foreground">Stop Loss</span>
                <p className="font-mono font-medium text-red-500">{trade.stopLossPremiumPercent}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Target</span>
                <p className="font-mono font-medium text-green-500">{trade.targetPremiumPercent}%</p>
              </div>
            </>
          )}
        </div>
        {trade.notes && (
          <p className="text-sm text-muted-foreground mt-3 border-t pt-3 italic">"{trade.notes}"</p>
        )}
      </CardContent>
    </Card>
  );
}

const STRATEGY_OPTIONS = [
  { value: "momentum", label: "Momentum" },
  { value: "swing", label: "Swing Trade" },
  { value: "scalp", label: "Scalp" },
  { value: "breakout", label: "Breakout" },
  { value: "reversal", label: "Reversal" },
  { value: "earnings", label: "Earnings Play" },
  { value: "theta", label: "Theta Decay" },
  { value: "delta", label: "Delta Play" },
  { value: "other", label: "Other" },
];

const EMOTION_OPTIONS = [
  { value: "confident", label: "Confident", color: "text-green-500" },
  { value: "neutral", label: "Neutral", color: "text-muted-foreground" },
  { value: "anxious", label: "Anxious", color: "text-yellow-500" },
  { value: "fearful", label: "Fearful", color: "text-orange-500" },
  { value: "greedy", label: "Greedy", color: "text-red-500" },
  { value: "revenge", label: "Revenge Trading", color: "text-red-600" },
  { value: "fomo", label: "FOMO", color: "text-purple-500" },
];

const SESSION_OPTIONS = [
  { value: "premarket", label: "Pre-Market" },
  { value: "us_open", label: "Morning Session" },
  { value: "midday", label: "Midday" },
  { value: "power_hour", label: "Power Hour" },
  { value: "afterhours", label: "After Hours" },
];

interface AIInsightsData {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  behaviorPatterns: string[];
  overallGrade: string;
  gradeColor: string;
}

function AIInsightsPanel({ 
  trades, 
  tier, 
  winRate, 
  profitFactor, 
  totalPnL 
}: { 
  trades: SelectTradeExecution[]; 
  tier: string; 
  winRate: number; 
  profitFactor: number; 
  totalPnL: number;
}) {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const isPremium = tier === "premium";
  
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/portfolio-insights", {
        trades: trades.slice(0, 20).map(t => ({
          symbol: t.symbol,
          action: t.action,
          pnl: parseFloat(t.profitLoss || "0"),
          pnlPercent: parseFloat(t.profitLossPercent || "0"),
          strategyTag: t.strategyTag,
          emotionalState: t.emotionalState,
          sessionTag: t.sessionTag,
          whatWentWell: t.whatWentWell,
          whatWentWrong: t.whatWentWrong,
          lessonLearned: t.lessonLearned,
        })),
        winRate,
        profitFactor,
        totalPnL,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setInsights(data);
    },
  });

  const gradeColorClasses: Record<string, string> = {
    emerald: "bg-muted text-green-500 border-border",
    blue: "bg-muted text-blue-500 border-border",
    yellow: "bg-muted text-amber-400 border-border",
    orange: "bg-muted text-orange-500 border-border",
    red: "bg-muted text-red-400 border-border",
    gray: "bg-muted text-muted-foreground border-border",
  };

  if (!isPremium) {
    return (
      <Card className="border-dashed border-amber-500/30" data-testid="panel-ai-insights-locked">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                AI Trading Insights
                <Badge variant="outline" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">AI-powered analysis of your trading patterns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-center">
            <Crown className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Unlock AI-powered portfolio insights, behavior analysis, and personalized coaching recommendations.
            </p>
            <p className="text-xs text-amber-400">Upgrade to Premium ($99/mo) for full AI coaching access</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trades.length < 5) {
    return (
      <Card data-testid="panel-ai-insights">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trading Insights</CardTitle>
              <CardDescription className="text-xs">AI-powered analysis of your trading patterns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Complete at least 5 trades to unlock AI-powered insights and recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!insights && !generateMutation.isPending) {
    return (
      <Card data-testid="panel-ai-insights">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trading Insights</CardTitle>
              <CardDescription className="text-xs">AI-powered analysis of your trading patterns</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => generateMutation.mutate()}
            className="w-full gap-2"
            data-testid="button-generate-insights"
          >
            <Sparkles className="h-4 w-4" />
            Generate Portfolio Insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (generateMutation.isPending) {
    return (
      <Card data-testid="panel-ai-insights">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-foreground animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trading Insights</CardTitle>
              <CardDescription className="text-xs">Analyzing your trading patterns...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (generateMutation.isError) {
    return (
      <Card data-testid="panel-ai-insights">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trading Insights</CardTitle>
              <CardDescription className="text-xs text-red-500">Failed to generate insights</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => generateMutation.mutate()}
            variant="outline"
            className="w-full gap-2"
          >
            <Activity className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <Card data-testid="panel-ai-insights">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trading Insights</CardTitle>
              <CardDescription className="text-xs">Based on your last {Math.min(trades.length, 20)} trades</CardDescription>
            </div>
          </div>
          <Badge
            className={`text-lg font-bold ${gradeColorClasses[insights.gradeColor] || gradeColorClasses.gray}`}
            data-testid="badge-portfolio-grade"
          >
            {insights.overallGrade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground" data-testid="text-insights-summary">{insights.summary}</p>

        <div className="grid md:grid-cols-2 gap-4">
          {insights.strengths.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-500">
                <TrendingUp className="h-4 w-4" />
                <span>Strengths</span>
              </div>
              <ul className="space-y-1">
                {insights.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-green-500 mt-1">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.weaknesses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-500">
                <TrendingDown className="h-4 w-4" />
                <span>Areas to Improve</span>
              </div>
              <ul className="space-y-1">
                {insights.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-red-500 mt-1">-</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {insights.behaviorPatterns.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-blue-500" />
              <span>Behavior Patterns</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {insights.behaviorPatterns.map((pattern, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {pattern}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {insights.recommendations.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-foreground" />
              <span>Recommendations</span>
            </div>
            <ul className="space-y-1">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-foreground mt-1">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={() => generateMutation.mutate()}
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          data-testid="button-regenerate-insights"
        >
          <Activity className="h-4 w-4" />
          Refresh Insights
        </Button>
      </CardContent>
    </Card>
  );
}

function ManualTradeForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();
  const { tier } = useUserTier();
  const hasProAccess = tier === "pro" || tier === "premium";
  const [isOpen, setIsOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState("BUY_CALL");
  const [assetType, setAssetType] = useState("option");
  const [optionType, setOptionType] = useState("CALL");
  const [optionSide, setOptionSide] = useState("LONG");
  const [strikePrice, setStrikePrice] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [entryPremium, setEntryPremium] = useState("");
  const [contracts, setContracts] = useState("1");
  const [strategyTag, setStrategyTag] = useState("");
  const [sessionTag, setSessionTag] = useState("");
  const [emotionalState, setEmotionalState] = useState("");
  const [notes, setNotes] = useState("");
  const [plannedStopPrice, setPlannedStopPrice] = useState("");
  const [plannedTakeProfitPrice, setPlannedTakeProfitPrice] = useState("");
  const [plannedRiskPerTrade, setPlannedRiskPerTrade] = useState("");
  const [whatWentWell, setWhatWentWell] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [lessonLearned, setLessonLearned] = useState("");
  
  const createTradeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/trades/manual", {
        symbol: symbol.toUpperCase(),
        action,
        assetType,
        optionType: assetType === "option" ? optionType : undefined,
        optionSide: assetType === "option" ? optionSide : undefined,
        strikePrice: strikePrice ? parseFloat(strikePrice) : undefined,
        expirationDate: expirationDate || undefined,
        entryPremium: parseFloat(entryPremium),
        contracts: parseInt(contracts),
        strategyTag: hasProAccess && strategyTag ? strategyTag : undefined,
        sessionTag: sessionTag || undefined,
        emotionalState: hasProAccess && emotionalState ? emotionalState : undefined,
        notes: notes || undefined,
        plannedStopPrice: plannedStopPrice ? parseFloat(plannedStopPrice) : undefined,
        plannedTakeProfitPrice: plannedTakeProfitPrice ? parseFloat(plannedTakeProfitPrice) : undefined,
        plannedRiskPerTrade: plannedRiskPerTrade ? parseFloat(plannedRiskPerTrade) : undefined,
        whatWentWell: hasProAccess && whatWentWell ? whatWentWell : undefined,
        whatWentWrong: hasProAccess && whatWentWrong ? whatWentWrong : undefined,
        lessonLearned: hasProAccess && lessonLearned ? lessonLearned : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      toast({ title: "Trade logged successfully" });
      setIsOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to log trade", description: error.message, variant: "destructive" });
    }
  });
  
  const resetForm = () => {
    setSymbol("");
    setAction("BUY_CALL");
    setAssetType("option");
    setOptionType("CALL");
    setOptionSide("LONG");
    setStrikePrice("");
    setExpirationDate("");
    setEntryPremium("");
    setContracts("1");
    setStrategyTag("");
    setSessionTag("");
    setEmotionalState("");
    setNotes("");
    setPlannedStopPrice("");
    setPlannedTakeProfitPrice("");
    setPlannedRiskPerTrade("");
    setWhatWentWell("");
    setWhatWentWrong("");
    setLessonLearned("");
  };
  
  const isValid = symbol && entryPremium && parseFloat(entryPremium) > 0 && parseInt(contracts) > 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-log-trade">
          <Plus className="h-4 w-4 mr-2" />
          Log Trade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-foreground" />
            Log Manual Trade
          </DialogTitle>
          <DialogDescription>
            Record a trade from another broker for journaling and analytics.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol *</Label>
              <Input
                placeholder="AAPL, SPY, etc."
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                data-testid="input-manual-symbol"
              />
            </div>
            <div className="space-y-2">
              <Label>Asset Type</Label>
              <Select value={assetType} onValueChange={setAssetType}>
                <SelectTrigger data-testid="select-asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option">Option</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                  <SelectItem value="forex">Forex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="select-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY_CALL">Buy Call</SelectItem>
                  <SelectItem value="BUY_PUT">Buy Put</SelectItem>
                  <SelectItem value="SELL_CALL">Sell Call</SelectItem>
                  <SelectItem value="SELL_PUT">Sell Put</SelectItem>
                  <SelectItem value="BUY">Buy (Long)</SelectItem>
                  <SelectItem value="SELL">Sell (Short)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contracts/Shares *</Label>
              <Input
                type="number"
                min="1"
                value={contracts}
                onChange={(e) => setContracts(e.target.value)}
                data-testid="input-contracts"
              />
            </div>
          </div>
          
          {assetType === "option" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Option Type</Label>
                <Select value={optionType} onValueChange={setOptionType}>
                  <SelectTrigger data-testid="select-option-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALL">Call</SelectItem>
                    <SelectItem value="PUT">Put</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Strike Price</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="150.00"
                  value={strikePrice}
                  onChange={(e) => setStrikePrice(e.target.value)}
                  data-testid="input-strike"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiration</Label>
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  data-testid="input-expiration"
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entry Price *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.50"
                value={entryPremium}
                onChange={(e) => setEntryPremium(e.target.value)}
                data-testid="input-entry-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Planned Risk ($)</Label>
              <Input
                type="number"
                step="1"
                placeholder="100"
                value={plannedRiskPerTrade}
                onChange={(e) => setPlannedRiskPerTrade(e.target.value)}
                data-testid="input-planned-risk"
              />
              <p className="text-xs text-muted-foreground">Used for R-multiple tracking</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Stop Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="1.50"
                value={plannedStopPrice}
                onChange={(e) => setPlannedStopPrice(e.target.value)}
                data-testid="input-stop-price"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Price</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="4.00"
                value={plannedTakeProfitPrice}
                onChange={(e) => setPlannedTakeProfitPrice(e.target.value)}
                data-testid="input-target-price"
              />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Journal Fields
              {!hasProAccess && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              )}
            </h4>
            
            {!hasProAccess && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-200 flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Upgrade to Pro ($49/mo) to unlock strategy tagging and psychology journaling.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Strategy
                  {!hasProAccess && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Select value={strategyTag} onValueChange={setStrategyTag} disabled={!hasProAccess}>
                  <SelectTrigger data-testid="select-strategy" className={!hasProAccess ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={sessionTag} onValueChange={setSessionTag}>
                  <SelectTrigger data-testid="select-session">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Emotional State
                  {!hasProAccess && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Select value={emotionalState} onValueChange={setEmotionalState} disabled={!hasProAccess}>
                  <SelectTrigger data-testid="select-emotion" className={!hasProAccess ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOTION_OPTIONS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        <span className={e.color}>{e.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Trade thesis, observations, setup notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-notes"
            />
          </div>
          
          {hasProAccess && (
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-foreground" />
                Trade Reflection (Pro)
              </h4>
              <div className="space-y-2">
                <Label>What Went Well</Label>
                <Textarea
                  placeholder="Describe what you did right in this trade..."
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="input-what-went-well"
                />
              </div>
              <div className="space-y-2">
                <Label>What Went Wrong</Label>
                <Textarea
                  placeholder="Areas for improvement..."
                  value={whatWentWrong}
                  onChange={(e) => setWhatWentWrong(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="input-what-went-wrong"
                />
              </div>
              <div className="space-y-2">
                <Label>Lesson Learned</Label>
                <Textarea
                  placeholder="Key takeaway from this trade..."
                  value={lessonLearned}
                  onChange={(e) => setLessonLearned(e.target.value)}
                  className="min-h-[60px]"
                  data-testid="input-lesson-learned"
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
            Cancel
          </Button>
          <Button 
            onClick={() => createTradeMutation.mutate()} 
            disabled={!isValid || createTradeMutation.isPending}
            data-testid="button-submit-trade"
          >
            {createTradeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Log Trade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScreenshotUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [symbol, setSymbol] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const { tier, hasTierAccess, isDeveloper } = useUserTier();
  const hasProAccess = hasTierAccess("pro") || isDeveloper;
  
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");
      
      const formData = new FormData();
      formData.append("image", file);
      if (symbol) formData.append("symbol", symbol);
      if (notes) formData.append("notes", notes);
      
      const response = await fetch("/api/trades/parse-screenshot", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/open"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trades/closed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ 
        title: "Trade imported successfully",
        description: `${data.trade.symbol} ${data.trade.action} - ${data.parsed.contracts} contracts @ $${data.parsed.entryPrice}`,
      });
      setIsOpen(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to parse screenshot", description: error.message, variant: "destructive" });
    }
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreviewUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };
  
  const resetForm = () => {
    setFile(null);
    setPreviewUrl(null);
    setSymbol("");
    setNotes("");
  };
  
  if (!hasProAccess) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" data-testid="button-screenshot-upload-locked">
            <Camera className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Screenshot</span>
            <Lock className="h-3 w-3 ml-2" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-foreground" />
              AI Screenshot Import
            </DialogTitle>
            <DialogDescription>
              Automatically parse trade screenshots with AI
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-muted rounded-full">
                  <Sparkles className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Pro Feature</p>
                  <p className="text-sm text-muted-foreground">Upgrade to unlock AI screenshot parsing</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Auto-detect symbol, strike, expiration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Extract entry/exit prices and P&L
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  One-click trade logging
                </li>
                <li className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  Premium: AI trade coaching feedback
                </li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro - $49/mo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-screenshot-upload">
          <Camera className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Screenshot</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-foreground" />
            AI Screenshot Import
            {tier === "premium" && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Upload a screenshot from your broker and AI will automatically extract trade details.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              previewUrl ? "border-primary/50 bg-muted" : "border-border hover:border-primary/30"
            }`}
            onClick={() => document.getElementById("screenshot-input")?.click()}
          >
            {previewUrl ? (
              <div className="space-y-3">
                <img 
                  src={previewUrl} 
                  alt="Trade screenshot preview" 
                  className="max-h-48 mx-auto rounded-lg shadow-lg"
                />
                <p className="text-sm text-green-500 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {file?.name}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click or drag to upload screenshot
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 10MB
                </p>
              </div>
            )}
            <input 
              type="file" 
              id="screenshot-input"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-screenshot-file"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Symbol (optional)</Label>
              <Input 
                placeholder="e.g., AAPL, SPY"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                data-testid="input-screenshot-symbol"
              />
              <p className="text-xs text-muted-foreground">Helps AI if unclear from image</p>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input 
                placeholder="Any context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-screenshot-notes"
              />
            </div>
          </div>
          
          {tier === "premium" && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <p className="text-sm text-amber-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Premium: You'll receive AI trade coaching feedback after import
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
            Cancel
          </Button>
          <Button 
            onClick={() => uploadMutation.mutate()} 
            disabled={!file || uploadMutation.isPending}
            data-testid="button-parse-screenshot"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Parse & Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JournalDetailSheet({ trade, children }: { trade: SelectTradeExecution; children: React.ReactNode }) {
  const { toast } = useToast();
  const { tier } = useUserTier();
  const hasProAccess = tier === "pro" || tier === "premium";
  const [strategyTag, setStrategyTag] = useState(trade.strategyTag || "");
  const [sessionTag, setSessionTag] = useState(trade.sessionTag || "");
  const [emotionalState, setEmotionalState] = useState(trade.emotionalState || "");
  const [whatWentWell, setWhatWentWell] = useState(trade.whatWentWell || "");
  const [whatWentWrong, setWhatWentWrong] = useState(trade.whatWentWrong || "");
  const [lessonLearned, setLessonLearned] = useState(trade.lessonLearned || "");
  const [notes, setNotes] = useState(trade.notes || "");
  
  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/trades/${trade.id}`, {
        strategyTag: hasProAccess ? (strategyTag || undefined) : undefined,
        sessionTag: sessionTag || undefined,
        emotionalState: hasProAccess ? (emotionalState || undefined) : undefined,
        whatWentWell: hasProAccess ? (whatWentWell || undefined) : undefined,
        whatWentWrong: hasProAccess ? (whatWentWrong || undefined) : undefined,
        lessonLearned: hasProAccess ? (lessonLearned || undefined) : undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trades"] });
      toast({ title: "Journal updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  });
  
  const pnl = parseFloat(trade.profitLoss || "0");
  const pnlPercent = parseFloat(trade.profitLossPercent || "0");
  const isWinner = pnl > 0;
  const isClosed = trade.closedAt !== null;
  const rMultiple = trade.plannedRiskPerTrade && parseFloat(trade.plannedRiskPerTrade) > 0 
    ? pnl / parseFloat(trade.plannedRiskPerTrade) 
    : null;
  
  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono font-bold">{trade.symbol}</Badge>
            <Badge variant={trade.action.includes("BUY") ? "default" : "destructive"}>
              {trade.action}
            </Badge>
            {isClosed && (
              <Badge variant={isWinner ? "default" : "destructive"} className={isWinner ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
                {isWinner ? "+" : ""}${pnl.toFixed(2)}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Trade details and journal entry
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-6 py-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Entry</span>
              <p className="font-mono font-medium">${parseFloat(trade.entryPremium).toFixed(2)}</p>
            </div>
            {trade.exitPremium && (
              <div>
                <span className="text-muted-foreground">Exit</span>
                <p className="font-mono font-medium">${parseFloat(trade.exitPremium).toFixed(2)}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Contracts</span>
              <p className="font-mono font-medium">{trade.contracts}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Cost</span>
              <p className="font-mono font-medium">${parseFloat(trade.totalCost).toFixed(2)}</p>
            </div>
            {isClosed && (
              <>
                <div>
                  <span className="text-muted-foreground">P&L %</span>
                  <p className={`font-mono font-medium ${isWinner ? "text-green-500" : "text-red-500"}`}>
                    {isWinner ? "+" : ""}{pnlPercent.toFixed(2)}%
                  </p>
                </div>
                {rMultiple !== null && (
                  <div>
                    <span className="text-muted-foreground">R-Multiple</span>
                    <p className={`font-mono font-medium ${rMultiple >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {rMultiple >= 0 ? "+" : ""}{rMultiple.toFixed(2)}R
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          
          <div className="border-t pt-4 space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Journal Entry
              {!hasProAccess && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              )}
            </h4>
            
            {!hasProAccess && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-sm text-amber-200 flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Upgrade to Pro ($49/mo) for strategy tagging and trade psychology journaling.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Strategy
                  {!hasProAccess && <Lock className="h-3 w-3 text-muted-foreground" />}
                </Label>
                <Select value={strategyTag} onValueChange={setStrategyTag} disabled={!hasProAccess}>
                  <SelectTrigger className={!hasProAccess ? "opacity-50" : ""}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STRATEGY_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={sessionTag} onValueChange={setSessionTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Emotional State
                {!hasProAccess && <Lock className="h-3 w-3 text-muted-foreground" />}
              </Label>
              <Select value={emotionalState} onValueChange={setEmotionalState} disabled={!hasProAccess}>
                <SelectTrigger className={!hasProAccess ? "opacity-50" : ""}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {EMOTION_OPTIONS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      <span className={e.color}>{e.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {hasProAccess ? (
              <>
                <div className="space-y-2">
                  <Label className="text-green-500">What Went Well</Label>
                  <Textarea
                    placeholder="What worked in this trade..."
                    value={whatWentWell}
                    onChange={(e) => setWhatWentWell(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-red-500">What Went Wrong</Label>
                  <Textarea
                    placeholder="Areas for improvement..."
                    value={whatWentWrong}
                    onChange={(e) => setWhatWentWrong(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-yellow-500">Lesson Learned</Label>
                  <Textarea
                    placeholder="Key takeaway from this trade..."
                    value={lessonLearned}
                    onChange={(e) => setLessonLearned(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2 opacity-50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  Trade reflection fields require Pro subscription
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
          </div>
        </div>
        
        <SheetFooter>
          <Button 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Save Journal
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function PortfolioAnalytics() {
  const { toast } = useToast();
  const { tier, hasTierAccess, hasFeature, isDeveloper } = useUserTier();
  
  const canAccessProAnalytics = hasTierAccess("pro");
  const canAccessPremiumAnalytics = hasTierAccess("premium");
  const canAccessStrategyTags = hasFeature("journal_strategy_tags") || hasTierAccess("pro");
  const canAccessEmotionalState = hasFeature("journal_emotional_state") || hasTierAccess("pro");
  const canAccessRMultiple = hasFeature("journal_r_multiple") || hasTierAccess("pro");
  const canAccessAICoaching = hasFeature("ai_coaching") || hasTierAccess("premium");
  
  const { data: metrics, isLoading: metricsLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/performance"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"]
  });
  
  const { data: trades = [], isLoading: tradesLoading } = useQuery<SelectTradeExecution[]>({
    queryKey: ["/api/trades"]
  });
  
  const openTrades = trades.filter(t => t.status === "open");
  const closedTrades = trades.filter(t => t.closedAt !== null);
  
  const isLoading = metricsLoading || summaryLoading || tradesLoading;

  const winRateData = [
    { name: "Wins", value: metrics?.winningTrades || 0 },
    { name: "Losses", value: metrics?.losingTrades || 0 },
  ];

  const performanceData = closedTrades.map((t) => ({
    symbol: t.symbol,
    profitLoss: parseFloat(t.profitLoss || "0"),
    profitLossPercent: parseFloat(t.profitLossPercent || "0"),
    date: t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "",
    strategy: t.strategyTag || "untagged",
    rMultiple: t.plannedRiskPerTrade && parseFloat(t.plannedRiskPerTrade) > 0 
      ? parseFloat(t.profitLoss || "0") / parseFloat(t.plannedRiskPerTrade)
      : null,
  }));

  // Calculate P&L by symbol (aggregated)
  const pnlBySymbol = closedTrades.reduce((acc: Record<string, { symbol: string; total: number; count: number; wins: number }>, t) => {
    const pnl = parseFloat(t.profitLoss || "0");
    if (!acc[t.symbol]) {
      acc[t.symbol] = { symbol: t.symbol, total: 0, count: 0, wins: 0 };
    }
    acc[t.symbol].total += pnl;
    acc[t.symbol].count += 1;
    if (pnl > 0) acc[t.symbol].wins += 1;
    return acc;
  }, {});
  const pnlBySymbolData = Object.values(pnlBySymbol).sort((a, b) => b.total - a.total).slice(0, 10);

  // Calculate win-rate by strategy
  const strategyStats = closedTrades.reduce((acc: Record<string, { name: string; wins: number; total: number; pnl: number }>, t) => {
    const strategy = t.strategyTag || "untagged";
    const pnl = parseFloat(t.profitLoss || "0");
    if (!acc[strategy]) {
      acc[strategy] = { name: strategy, wins: 0, total: 0, pnl: 0 };
    }
    acc[strategy].total += 1;
    acc[strategy].pnl += pnl;
    if (pnl > 0) acc[strategy].wins += 1;
    return acc;
  }, {});
  const strategyData = Object.values(strategyStats).map(s => ({
    name: STRATEGY_OPTIONS.find(opt => opt.value === s.name)?.label || s.name,
    winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
    trades: s.total,
    pnl: s.pnl,
  })).sort((a, b) => b.trades - a.trades);

  // Calculate average R-multiple for trades with risk defined
  const tradesWithR = performanceData.filter(t => t.rMultiple !== null);
  const avgRMultiple = tradesWithR.length > 0 
    ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / tradesWithR.length 
    : 0;

  // Monthly P&L breakdown
  const monthlyPnL = closedTrades.reduce((acc: Record<string, number>, t) => {
    if (!t.closedAt) return acc;
    const month = new Date(t.closedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    acc[month] = (acc[month] || 0) + parseFloat(t.profitLoss || "0");
    return acc;
  }, {});
  const monthlyData = Object.entries(monthlyPnL).map(([month, pnl]) => ({ month, pnl }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans relative" data-testid="portfolio-loading">
        <div className="relative z-10 max-w-7xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative" data-testid="portfolio-analytics-page">
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Briefcase className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Portfolio & Analytics</h1>
              <p className="text-muted-foreground">Track positions, P&L, performance metrics, and trading journal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ManualTradeForm />
            <ScreenshotUpload />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total P&L"
            value={`${(metrics?.totalProfitLoss || 0) >= 0 ? "+" : ""}$${(metrics?.totalProfitLoss || 0).toFixed(2)}`}
            subValue={`${(summary?.totalPnLPercent || 0).toFixed(2)}% return`}
            icon={DollarSign}
            trend={(metrics?.totalProfitLoss || 0) >= 0 ? "up" : "down"}
          />
          <StatCard
            title="Win Rate"
            value={`${(metrics?.winRate || 0).toFixed(1)}%`}
            subValue={`${metrics?.winningTrades || 0}W / ${metrics?.losingTrades || 0}L`}
            icon={Target}
            trend={(metrics?.winRate || 0) >= 50 ? "up" : "down"}
          />
          <StatCard
            title="Total Trades"
            value={`${metrics?.totalTrades || 0}`}
            subValue={`${metrics?.openTrades || 0} open, ${metrics?.closedTrades || 0} closed`}
            icon={Activity}
            trend="neutral"
          />
          <StatCard
            title="Profit Factor"
            value={`${(metrics?.profitFactor || 0).toFixed(2)}`}
            subValue={`$${(metrics?.expectancy || 0).toFixed(2)} expectancy`}
            icon={Percent}
            trend={(metrics?.profitFactor || 1) >= 1 ? "up" : "down"}
          />
        </div>

        {metrics?.bestTrade && metrics?.worstTrade && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Award className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Best Trade</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{metrics.bestTrade.symbol}</Badge>
                      <span className="text-xl font-bold text-green-500">
                        +{metrics.bestTrade.profitLossPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Worst Trade</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{metrics.worstTrade.symbol}</Badge>
                      <span className="text-xl font-bold text-red-500">
                        {metrics.worstTrade.profitLossPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="positions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:grid-cols-none sm:flex">
            <TabsTrigger value="positions" data-testid="tab-positions" className="gap-1">
              <Briefcase className="h-4 w-4 hidden sm:block" />
              Positions ({openTrades.length})
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" className="gap-1">
              <Clock className="h-4 w-4 hidden sm:block" />
              History ({closedTrades.length})
            </TabsTrigger>
            <TabsTrigger value="charts" data-testid="tab-charts" className="gap-1">
              <BarChart3 className="h-4 w-4 hidden sm:block" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance" className="gap-1">
              <PieChartIcon className="h-4 w-4 hidden sm:block" />
              Breakdown
            </TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-4">
            {openTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No open positions</p>
                  <p className="text-sm">Execute trades from the Signal Generator to see them here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {openTrades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} showCloseButton={true} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {closedTrades.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No closed trades yet</p>
                  <p className="text-sm">Close open positions to track your performance</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {closedTrades.map((trade) => (
                  <TradeCard key={trade.id} trade={trade} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>P&L by Trade</CardTitle>
                  <CardDescription>Profit/Loss for each closed trade</CardDescription>
                </CardHeader>
                <CardContent>
                  {performanceData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No closed trades to display
                    </div>
                  ) : (
                    <div className="h-[250px]" data-testid="chart-pnl-by-trade">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="symbol" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                          <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            itemStyle={{ color: "hsl(var(--foreground))" }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                          />
                          <Bar
                            dataKey="profitLoss"
                            fill="#22c55e"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <FeatureGate
                hasAccess={canAccessProAnalytics}
                feature="Equity Curve"
                requiredTier="pro"
                description="Track your portfolio growth over time with cumulative P&L charts"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Cumulative P&L</CardTitle>
                    <CardDescription>Performance over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {performanceData.length === 0 ? (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No closed trades to display
                      </div>
                    ) : (
                      <div className="h-[250px]" data-testid="chart-cumulative-pnl">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={performanceData.reduce((acc: any[], curr, i) => {
                            const prev = acc[i - 1]?.cumulative || 0;
                            acc.push({ ...curr, cumulative: prev + curr.profitLoss });
                            return acc;
                          }, [])}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="symbol" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(value: number) => [`$${value.toFixed(2)}`, "Cumulative P&L"]}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="cumulative" 
                              stroke="#10b981" 
                              fill="#10b98133" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </FeatureGate>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Win/Loss Distribution</CardTitle>
                  <CardDescription>Breakdown of winning vs losing trades</CardDescription>
                </CardHeader>
                <CardContent>
                  {(metrics?.closedTrades || 0) === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No closed trades to display
                    </div>
                  ) : (
                    <div className="h-[250px]" data-testid="chart-win-loss">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={winRateData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {winRateData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "var(--radius)",
                            }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            itemStyle={{ color: "hsl(var(--foreground))" }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Trade Metrics</CardTitle>
                  <CardDescription>Key performance indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Win</span>
                    <span className="font-mono font-medium text-green-500">
                      +${(metrics?.averageProfit || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Average Loss</span>
                    <span className="font-mono font-medium text-red-500">
                      -${Math.abs(metrics?.averageLoss || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Risk/Reward Ratio</span>
                    <span className="font-mono font-medium">
                      {metrics?.averageLoss ? ((metrics?.averageProfit || 0) / Math.abs(metrics.averageLoss)).toFixed(2) : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Hold Period</span>
                    <span className="font-mono font-medium">
                      {(summary?.avgHoldingPeriod || 0).toFixed(1)} days
                    </span>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Win Rate</span>
                      <span className="text-sm font-mono">{(metrics?.winRate || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics?.winRate || 0} className="h-2" />
                  </div>
                  
                  {tradesWithR.length > 0 && (
                    <div className="pt-4 border-t">
                      {canAccessRMultiple ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Avg R-Multiple</span>
                            <span className={`font-mono font-medium ${avgRMultiple >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {avgRMultiple >= 0 ? "+" : ""}{avgRMultiple.toFixed(2)}R
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Based on {tradesWithR.length} trades with defined risk
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Avg R-Multiple</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500">Pro</Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <FeatureGate
              hasAccess={canAccessProAnalytics}
              feature="Advanced Analytics"
              requiredTier="pro"
              description="Unlock P&L by Symbol, Win Rate by Strategy, Monthly P&L, and more advanced charts"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>P&L by Symbol</CardTitle>
                    <CardDescription>Total profit/loss aggregated by symbol</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pnlBySymbolData.length === 0 ? (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No data available
                      </div>
                    ) : (
                      <div className="h-[250px]" data-testid="chart-pnl-by-symbol">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pnlBySymbolData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                            <YAxis dataKey="symbol" type="category" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={50} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(value: number) => [`$${value.toFixed(2)}`, "Total P&L"]}
                            />
                            <Bar 
                              dataKey="total" 
                              radius={[0, 4, 4, 0]}
                              fill="#3b82f6"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Win Rate by Strategy</CardTitle>
                    <CardDescription>Performance breakdown by trading strategy</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {strategyData.length === 0 ? (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        No strategy data available
                      </div>
                    ) : (
                      <div className="h-[250px]" data-testid="chart-winrate-by-strategy">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={strategyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                              labelStyle={{ color: "hsl(var(--foreground))" }}
                              itemStyle={{ color: "hsl(var(--foreground))" }}
                              formatter={(value: number, name: string) => {
                                if (name === "winRate") return [`${value.toFixed(1)}%`, "Win Rate"];
                                return [value, name];
                              }}
                            />
                            <Bar 
                              dataKey="winRate" 
                              fill="#22c55e" 
                              radius={[4, 4, 0, 0]}
                              name="winRate"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </FeatureGate>

            {canAccessProAnalytics && monthlyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Monthly P&L</CardTitle>
                  <CardDescription>Profit and loss by month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]" data-testid="chart-monthly-pnl">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, "P&L"]}
                        />
                        <Bar
                          dataKey="pnl"
                          radius={[4, 4, 0, 0]}
                        >
                          {monthlyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <FeatureGate
              hasAccess={canAccessProAnalytics}
              feature="Strategy Performance"
              requiredTier="pro"
              description="View detailed breakdown of trading strategy performance"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Strategy Performance Summary</CardTitle>
                  <CardDescription>Detailed breakdown of each trading strategy</CardDescription>
                </CardHeader>
                <CardContent>
                  {strategyData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No strategy data available. Tag your trades with strategies to see performance breakdown.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Strategy</TableHead>
                            <TableHead className="text-right">Trades</TableHead>
                            <TableHead className="text-right">Win Rate</TableHead>
                            <TableHead className="text-right">Total P&L</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {strategyData.map((s) => (
                            <TableRow key={s.name}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell className="text-right font-mono">{s.trades}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={s.winRate >= 50 ? "default" : "destructive"} className={s.winRate >= 50 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
                                  {s.winRate.toFixed(1)}%
                                </Badge>
                              </TableCell>
                              <TableCell className={`text-right font-mono ${s.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                                {s.pnl >= 0 ? "+" : ""}${s.pnl.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FeatureGate>

            <AIInsightsPanel
              trades={closedTrades}
              tier={tier}
              winRate={metrics?.winRate ?? 0}
              profitFactor={metrics?.profitFactor ?? 0}
              totalPnL={metrics?.totalProfitLoss ?? 0}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
