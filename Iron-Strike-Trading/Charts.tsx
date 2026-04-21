import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from 'wouter';
import { useToast } from "@/hooks/use-toast";
import { useUserTier } from "@/hooks/use-user-tier";
import { 
  TVChart, 
  ChartToolbar, 
  DrawingsDrawer, 
  IndicatorsDrawer,
  loadDrawings,
  saveDrawings,
  loadChartPreferences,
  saveChartPreferences,
  type Drawing,
  type TVChartApi,
  type CoachMarker,
  type CoachingResponse,
  type TradeGrade,
  type RiskBox,
  type MistakeMapItem,
  type DrillScenario,
  applyCoachMarkers,
  clearCoachMarkers,
} from "@/components/charts";
import type { DrawingTool } from "@/components/charts";
import { 
  Search, 
  Bell, 
  Settings, 
  Maximize2, 
  TrendingUp, 
  Activity,
  Sparkles,
  Send,
  Bot,
  Cpu,
  RefreshCw,
  Trash2,
  Pencil,
  BarChart3,
  X,
  RotateCcw,
  MousePointer2,
  Square,
  Type,
  Minus,
  ChevronDown,
  MessageSquare,
  Award,
  Target,
  AlertTriangle,
  Play,
  Eye,
  Lock,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type CoachToggles = {
  coachNotes: boolean;
  tradeGrade: boolean;
  riskBox: boolean;
  mistakeMap: boolean;
  drillMode: boolean;
  ghostTrade: boolean;
};

type CoachTab = 'coachNotes' | 'tradeGrade' | 'riskBox' | 'mistakeMap' | 'drillMode';

// Tier detection is done inside component via useUserTier hook

interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandleData {
  i: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  aiSignal: 'bullish' | 'bearish' | null;
}

const OHLCStatusBar = ({ data, symbol }: { data: ChartDataPoint[] | undefined; symbol: string }) => {
  if (!data || data.length === 0) return null;
  
  const latest = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : latest;
  const change = latest.close - prev.close;
  const changePercent = (change / prev.close) * 100;
  const isPositive = change >= 0;
  
  return (
    <div className="h-8 bg-[#0B0F14] border-b border-[rgba(255,255,255,0.08)] flex items-center px-3 gap-3 sm:gap-6 text-xs font-mono select-none overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[#6B7280] uppercase">O</span>
        <span className="text-[#E6EAF0]">{latest.open.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[#6B7280] uppercase">H</span>
        <span className="text-green-400">{latest.high.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[#6B7280] uppercase">L</span>
        <span className="text-red-400">{latest.low.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[#6B7280] uppercase">C</span>
        <span className={isPositive ? 'text-green-400' : 'text-red-400'}>{latest.close.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-[rgba(255,255,255,0.08)] shrink-0 hidden sm:block" />
      <div className={`flex items-center gap-1 shrink-0 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        <span>{isPositive ? '+' : ''}{change.toFixed(2)}</span>
        <span>({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)</span>
      </div>
      <div className="h-4 w-px bg-[rgba(255,255,255,0.08)] shrink-0 hidden sm:block" />
      <div className="flex items-center gap-1 shrink-0 hidden sm:flex">
        <span className="text-[#6B7280] uppercase">Vol</span>
        <span className="text-[#9AA4B2]">{(latest.volume / 1000000).toFixed(2)}M</span>
      </div>
    </div>
  );
};

const Header = ({ 
  symbol, 
  onSymbolChange, 
  timeframe, 
  onTimeframeChange,
  onOpenAlerts,
  onOpenSettings,
  onOpenIndicators,
  onOpenDrawings,
  indicators
}: { 
  symbol: string; 
  onSymbolChange: (s: string) => void;
  timeframe: string;
  onTimeframeChange: (t: string) => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onOpenIndicators: () => void;
  onOpenDrawings: () => void;
  indicators: { volume: boolean; sma: boolean; ema: boolean; rsi: boolean; macd: boolean };
}) => {
  const [inputValue, setInputValue] = useState(symbol);
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSymbolChange(inputValue.trim().toUpperCase());
    }
    setIsEditing(false);
  };

  const timeframes = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '6M', value: '6mo' },
    { label: '1Y', value: '1y' },
  ];

  return (
    <header className="bg-[#0F141B] border-b border-[rgba(255,255,255,0.08)] select-none">
      <div className="flex items-center px-3 py-2 gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center text-[#22D3EE] font-bold text-base lg:text-lg tracking-wider shrink-0">
            <Activity className="w-5 h-5 lg:w-6 lg:h-6 mr-1.5" />
            <span className="hidden sm:inline">IRON STRIKE</span>
          </div>
          <div className="h-5 w-px bg-[rgba(255,255,255,0.08)] shrink-0 hidden sm:block" />
          
          {isEditing ? (
            <div className="flex items-center bg-[#141A22] px-2 py-1 rounded border border-[rgba(255,255,255,0.08)]">
              <Search className="w-4 h-4 mr-1.5 text-[#9AA4B2] shrink-0" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase())}
                onBlur={handleSubmit}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="bg-transparent text-[#E6EAF0] font-semibold text-sm w-16 outline-none"
                autoFocus
                data-testid="input-symbol"
              />
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex items-center bg-[#141A22] px-2 py-1 rounded text-[#9AA4B2] hover:text-[#E6EAF0] cursor-pointer transition-colors border border-transparent hover:border-[rgba(255,255,255,0.08)] shrink-0"
              data-testid="symbol-display"
            >
              <Search className="w-4 h-4 mr-1.5 text-[#9AA4B2]" />
              <span className="font-semibold text-sm text-[#E6EAF0]">{symbol}</span>
            </button>
          )}

          <div className="flex gap-0.5 overflow-x-auto scrollbar-hide shrink-0">
            {timeframes.map((tf) => (
              <button 
                key={tf.value} 
                type="button"
                onClick={() => onTimeframeChange(tf.value)}
                className={`px-1.5 lg:px-2 py-1 text-xs lg:text-sm font-medium rounded transition-colors whitespace-nowrap ${
                  timeframe === tf.value 
                    ? 'text-[#22D3EE] bg-[#22D3EE]/10' 
                    : 'text-[#9AA4B2] hover:bg-[#141A22]'
                }`}
                data-testid={`timeframe-${tf.value}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
          
          <div className="hidden lg:flex gap-1.5 ml-1">
            {indicators.volume && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-[#22D3EE]/10 text-[#22D3EE] rounded">Vol</span>
            )}
            {indicators.sma && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 rounded">SMA</span>
            )}
            {indicators.ema && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 rounded">EMA</span>
            )}
            {indicators.rsi && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 rounded">RSI</span>
            )}
            {indicators.macd && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-400 rounded">MACD</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-[#9AA4B2] shrink-0">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onOpenIndicators}
            title="Indicators"
            data-testid="button-indicators"
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onOpenDrawings}
            title="Drawing Tools"
            className="hidden sm:inline-flex"
            data-testid="button-drawings"
          >
            <Pencil className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onOpenSettings}
            title="Chart Settings"
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onOpenAlerts}
            title="Price Alerts"
            className="hidden sm:inline-flex"
            data-testid="button-alerts"
          >
            <Bell className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

const DrawingToolbar = ({ 
  activeTool, 
  onToolChange,
  onClearDrawings,
  drawingCount,
  isFullscreen,
  onToggleFullscreen,
  onResetView
}: { 
  activeTool: DrawingTool; 
  onToolChange: (t: DrawingTool) => void;
  onClearDrawings: () => void;
  drawingCount: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResetView: () => void;
}) => {
  const drawingTools: { icon: any; id: DrawingTool; label: string }[] = [
    { icon: MousePointer2, id: 'none', label: 'Select' },
    { icon: TrendingUp, id: 'trendline', label: 'Trendline' },
    { icon: Minus, id: 'hline', label: 'Horizontal Line' },
    { icon: Activity, id: 'ray', label: 'Ray' },
    { icon: BarChart3, id: 'fib', label: 'Fibonacci' },
  ];

  return (
    <aside className="hidden sm:flex w-12 bg-[#0F141B] border-r border-[rgba(255,255,255,0.08)] flex-col items-center py-3 gap-1">
      {drawingTools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Button 
            key={tool.id}
            variant="ghost"
            size="icon"
            onClick={() => onToolChange(activeTool === tool.id ? 'none' : tool.id)}
            title={tool.label}
            className={activeTool === tool.id ? 'text-[#22D3EE] bg-[#22D3EE]/10' : 'text-[#9AA4B2]'}
            data-testid={`tool-${tool.id}`}
          >
            <Icon className="w-5 h-5" />
          </Button>
        );
      })}
      
      <div className="h-px w-6 bg-[rgba(255,255,255,0.08)] my-1" />
      
      <Button 
        variant="ghost"
        size="icon"
        onClick={onResetView}
        title="Reset View"
        className="text-[#9AA4B2]"
        data-testid="tool-reset-view"
      >
        <RotateCcw className="w-5 h-5" />
      </Button>
      
      <Button 
        variant="ghost"
        size="icon"
        onClick={onToggleFullscreen}
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        className={isFullscreen ? 'text-[#22D3EE] bg-[#22D3EE]/10' : 'text-[#9AA4B2]'}
        data-testid="tool-fullscreen"
      >
        <Maximize2 className="w-5 h-5" />
      </Button>
      
      <div className="flex-1" />
      {drawingCount > 0 && (
        <Button 
          variant="ghost"
          size="icon"
          onClick={onClearDrawings}
          title="Clear all drawings"
          className="text-destructive hover:bg-destructive/10"
          data-testid="button-clear-drawings"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      )}
    </aside>
  );
};

const CoachModeBar = ({ 
  activeTab,
  onTabChange,
  onGenerateCoaching,
  isGenerating,
  hasCoachingData,
  isPro,
  isElite,
}: { 
  activeTab: CoachTab | null;
  onTabChange: (key: CoachTab) => void;
  onGenerateCoaching: () => void;
  isGenerating: boolean;
  hasCoachingData: boolean;
  isPro: boolean;
  isElite: boolean;
}) => {
  const { toast } = useToast();
  
  const features = [
    { key: 'coachNotes' as const, label: 'Coach Notes', icon: MessageSquare, tier: 'pro' },
    { key: 'tradeGrade' as const, label: 'Trade Grade', icon: Award, tier: 'pro' },
    { key: 'riskBox' as const, label: 'Risk Box', icon: Target, tier: 'pro' },
    { key: 'mistakeMap' as const, label: 'Mistake Map', icon: AlertTriangle, tier: 'elite' },
    { key: 'drillMode' as const, label: 'Drill Mode', icon: Play, tier: 'elite' },
  ];

  const handleTabClick = (key: CoachTab, tier: string) => {
    if (tier === 'pro' && !isPro) {
      toast({ title: `Upgrade to Pro to unlock ${key.replace(/([A-Z])/g, ' $1').trim()}`, variant: 'destructive' });
      return;
    }
    if (tier === 'elite' && !isElite) {
      toast({ title: `Upgrade to Elite to unlock ${key.replace(/([A-Z])/g, ' $1').trim()}`, variant: 'destructive' });
      return;
    }
    onTabChange(key);
  };

  return (
    <div className="h-10 bg-[#0F141B] border-b border-[rgba(255,255,255,0.08)] flex items-center px-3 gap-2 overflow-x-auto scrollbar-hide">
      {features.map((f) => {
        const Icon = f.icon;
        const isLocked = (f.tier === 'pro' && !isPro) || (f.tier === 'elite' && !isElite);
        const isActive = activeTab === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => handleTabClick(f.key, f.tier)}
            disabled={isLocked}
            aria-disabled={isLocked}
            aria-pressed={isActive && !isLocked}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] font-medium transition-all whitespace-nowrap ${
              isActive && !isLocked
                ? 'bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30'
                : isLocked
                ? 'bg-[#141A22] text-[#6B7280] border border-[rgba(255,255,255,0.05)] cursor-not-allowed opacity-60'
                : 'bg-[#141A22] text-[#9AA4B2] border border-[rgba(255,255,255,0.08)] hover:border-[#22D3EE]/30'
            }`}
            data-testid={`toggle-${f.key}`}
          >
            <Icon className="w-3 h-3" />
            {f.label}
            {isLocked && <Lock className="w-2.5 h-2.5 ml-0.5" />}
          </button>
        );
      })}
      
      <div className="flex-1" />
      
      <button
        type="button"
        onClick={onGenerateCoaching}
        disabled={isGenerating || !activeTab}
        title={!activeTab ? 'Select a coaching feature first' : undefined}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22D3EE] text-[#0B0F14] rounded text-xs font-semibold hover:bg-[#22D3EE]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        data-testid="button-generate-coaching"
      >
        {isGenerating ? (
          <>
            <Cpu className="w-3.5 h-3.5 animate-spin" />
            Analyzing...
          </>
        ) : hasCoachingData ? (
          <>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Generate
          </>
        )}
      </button>
    </div>
  );
};

const CoachInsightsDrawer = ({ 
  markers, 
  onJumpToMarker,
  grade,
  mistakeMap,
  drillScenarios,
  showMistakeMap,
  showDrillMode,
}: { 
  markers: CoachMarker[]; 
  onJumpToMarker: (time: number) => void;
  grade?: TradeGrade;
  mistakeMap?: MistakeMapItem[];
  drillScenarios?: DrillScenario[];
  showMistakeMap?: boolean;
  showDrillMode?: boolean;
}) => {
  const hasContent = markers.length > 0 || grade || 
    (showMistakeMap && mistakeMap && mistakeMap.length > 0) ||
    (showDrillMode && drillScenarios && drillScenarios.length > 0);
  
  if (!hasContent) return null;

  const severityColors = {
    good: 'text-green-400 bg-green-400/10',
    warn: 'text-amber-400 bg-amber-400/10',
    risk: 'text-red-400 bg-red-400/10',
  };
  
  const mistakeSeverityColors = {
    minor: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    major: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

  return (
    <div className="p-3 border-b border-[rgba(255,255,255,0.08)] bg-[#0B0F14] max-h-[50vh] overflow-y-auto">
      <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
        <Eye className="w-3 h-3 mr-1.5" /> AI Insights
      </h3>
      
      {grade && (
        <div className="bg-[#141A22] rounded p-2 mb-2 border border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-lg ${
              grade.gradeLetter === 'A' ? 'bg-green-500/20 text-green-400' :
              grade.gradeLetter === 'B' ? 'bg-[#22D3EE]/20 text-[#22D3EE]' :
              grade.gradeLetter === 'C' ? 'bg-amber-500/20 text-amber-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {grade.gradeLetter}
            </div>
            <div className="text-[10px] text-[#9AA4B2]">Trade Grade</div>
          </div>
          <div className="space-y-1">
            {grade.rubric.slice(0, 3).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-[#6B7280]">{r.category}</span>
                <span className="text-[#9AA4B2]">{r.score}/{r.maxScore}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {markers.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onJumpToMarker(m.time)}
              className="w-full flex items-center gap-2 p-2 rounded bg-[#141A22] hover:bg-[#0F141B] border border-[rgba(255,255,255,0.08)] transition-colors text-left group"
              data-testid={`insight-${m.id}`}
            >
              <div className={`w-2 h-2 rounded-full ${severityColors[m.severity]}`} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-[#E6EAF0] truncate">{m.title}</div>
                {m.detail && (
                  <div className="text-[9px] text-[#6B7280] truncate">{m.detail}</div>
                )}
              </div>
              <ChevronRight className="w-3 h-3 text-[#6B7280] group-hover:text-[#22D3EE] transition-colors" />
            </button>
          ))}
        </div>
      )}
      
      {showMistakeMap && mistakeMap && mistakeMap.length > 0 && (
        <div className="mb-3">
          <h4 className="text-[#9AA4B2] text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" /> Mistake Map
          </h4>
          <div className="space-y-1.5">
            {mistakeMap.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onJumpToMarker(m.time)}
                className={`w-full p-2 rounded border text-left ${mistakeSeverityColors[m.severity]}`}
                data-testid={`mistake-${m.id}`}
              >
                <div className="text-[10px] font-medium">{m.title}</div>
                <div className="text-[9px] opacity-80">{m.description}</div>
                <div className="text-[9px] mt-1 italic opacity-70">Lesson: {m.lesson}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {showDrillMode && drillScenarios && drillScenarios.length > 0 && (
        <div>
          <h4 className="text-[#9AA4B2] text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center">
            <Play className="w-3 h-3 mr-1" /> Drill Mode
          </h4>
          <div className="space-y-2">
            {drillScenarios.map((d) => (
              <div
                key={d.id}
                className="p-2 rounded bg-[#141A22] border border-[rgba(255,255,255,0.08)]"
                data-testid={`drill-${d.id}`}
              >
                <div className="text-[10px] text-[#22D3EE] font-medium mb-1">{d.title}</div>
                <div className="text-[9px] text-[#9AA4B2] mb-2">{d.description}</div>
                <div className="flex gap-2 text-[9px]">
                  <span className="px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">
                    Entry: ${d.setup.entryPrice.toFixed(2)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">
                    Stop: ${d.setup.stopPrice.toFixed(2)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE]">
                    Target: ${d.setup.targetPrice.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 text-[9px] text-[#6B7280]">
                  Answer: <span className="text-[#E6EAF0]">{d.correctAnswer.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-[9px] text-[#6B7280] mt-1">{d.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const IronStrikeCoachPanel = ({ 
  data, 
  symbol, 
  activeTab,
  markers,
  grade,
  riskBox,
  mistakeMap,
  drillScenarios,
  onJumpToMarker,
  isGenerating,
  onGenerate,
  isMobile = false
}: { 
  data: ChartDataPoint[]; 
  symbol: string;
  activeTab: CoachTab | null;
  markers?: CoachMarker[];
  grade?: TradeGrade;
  riskBox?: { entry: number; stop: number; target: number };
  mistakeMap?: MistakeMapItem[];
  drillScenarios?: DrillScenario[];
  onJumpToMarker?: (time: number) => void;
  isGenerating?: boolean;
  onGenerate?: () => void;
  isMobile?: boolean;
}) => {
  const [insight, setInsight] = useState("Initializing market scan...");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!data || data.length === 0) {
        throw new Error("No chart data available");
      }
      const recentCandles = data.slice(-15);
      const latestPrice = recentCandles[recentCandles.length - 1]?.close || 0;
      const highestHigh = Math.max(...recentCandles.map(d => d.high));
      const lowestLow = Math.min(...recentCandles.map(d => d.low));
      const priceChange = latestPrice - recentCandles[0].close;
      const changePercent = ((priceChange / recentCandles[0].close) * 100).toFixed(2);

      // Simple question - let backend AI Gateway handle structured response
      const response = await apiRequest('POST', '/api/chat', {
        message: `Give a brief market pulse for ${symbol}: current price $${latestPrice.toFixed(2)}, range $${lowestLow.toFixed(2)} to $${highestHigh.toFixed(2)}, change ${priceChange >= 0 ? '+' : ''}${changePercent}%. State the trend (bullish/bearish/neutral), support level, resistance level, and one actionable insight with specific dollar prices.`
      });
      return response.json();
    },
    onSuccess: (res) => {
      // Prefer structured.answer for complete response
      if (res.structured?.answer && typeof res.structured.answer === 'string') {
        setInsight(res.structured.answer);
      } else if (typeof res.response === 'object' && res.response !== null) {
        const formatted = Object.entries(res.response)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
        setInsight(formatted);
      } else {
        setInsight(String(res.response || res.message || "Analysis complete."));
      }
    },
    onError: () => {
      setInsight("Unable to connect to Iron Strike Coach.");
    }
  });

  useEffect(() => {
    if (data.length > 0) {
      analysisMutation.mutate();
    }
  }, [symbol]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      if (!data || data.length === 0) {
        throw new Error("No chart data available");
      }
      const recentCandles = data.slice(-20);
      const latestPrice = recentCandles[recentCandles.length - 1]?.close || 0;
      const highestHigh = Math.max(...recentCandles.map(d => d.high));
      const lowestLow = Math.min(...recentCandles.map(d => d.low));

      // Send simple question with context - let backend handle formatting
      const response = await apiRequest('POST', '/api/chat', {
        message: `${userMessage} For ${symbol} with current price $${latestPrice.toFixed(2)}, recent low $${lowestLow.toFixed(2)}, recent high $${highestHigh.toFixed(2)}. Give specific dollar amounts.`
      });
      return response.json();
    },
    onSuccess: (res) => {
      // Prefer structured.answer for complete response, fallback to response
      let text: string;
      if (res.structured?.answer && typeof res.structured.answer === 'string') {
        text = res.structured.answer;
      } else if (typeof res.response === 'object' && res.response !== null) {
        text = Object.entries(res.response)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n');
      } else {
        text = String(res.response || res.message || "Analysis unavailable.");
      }
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
    { label: "Find Support", query: "What are the support and resistance levels?" },
    { label: "Analyze Trend", query: "Is the trend bullish or bearish and what are the key price targets?" },
    { label: "Check Volatility", query: "What is the current volatility and what entry/exit prices should I consider?" },
  ];

  return (
    <div className={`${isMobile ? 'flex w-full' : 'flex w-80'} bg-[#0F141B] ${!isMobile ? 'border-l border-[rgba(255,255,255,0.08)]' : ''} flex-col h-full`}>
      <div className="flex-shrink-0 bg-gradient-to-r from-[#22D3EE]/10 to-[#0F141B] p-4 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#22D3EE] rounded-lg shadow-lg shadow-[#22D3EE]/20 relative">
            <Bot className="w-6 h-6 text-[#0B0F14]" />
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0F141B]"></div>
          </div>
          <div>
            <h2 className="text-[#E6EAF0] font-bold text-sm tracking-wide">Iron Strike Coach</h2>
            <div className="flex items-center text-[10px] text-[#22D3EE]">
              <Sparkles className="w-3 h-3 mr-1" />
              AI Market Mentor
            </div>
          </div>
        </div>
      </div>

      {/* Tab-specific coaching content */}
      {activeTab && (
        <div className="p-3 border-b border-[rgba(255,255,255,0.08)] bg-[#0B0F14]">
          {isGenerating ? (
            <div className="flex items-center justify-center py-8 text-[#22D3EE]">
              <Cpu className="w-4 h-4 mr-2 animate-spin" />
              <span className="text-xs">Generating coaching insights...</span>
            </div>
          ) : activeTab === 'coachNotes' && markers && markers.length > 0 ? (
            <div>
              <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                <Eye className="w-3 h-3 mr-1.5" /> Coach Notes
              </h3>
              <div className="space-y-1.5">
                {markers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onJumpToMarker?.(m.time)}
                    className="w-full flex items-center gap-2 p-2 rounded bg-[#141A22] hover:bg-[#0F141B] border border-[rgba(255,255,255,0.08)] transition-colors text-left group"
                    data-testid={`insight-${m.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      m.severity === 'good' ? 'bg-green-400' : 
                      m.severity === 'warn' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-[#E6EAF0] truncate">{m.title}</div>
                      {m.detail && (
                        <div className="text-[9px] text-[#6B7280] truncate">{m.detail}</div>
                      )}
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#6B7280] group-hover:text-[#22D3EE] transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : activeTab === 'tradeGrade' && grade ? (
            <div>
              <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                <Award className="w-3 h-3 mr-1.5" /> Trade Grade
              </h3>
              <div className="bg-[#141A22] rounded p-3 border border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-2xl ${
                    grade.gradeLetter === 'A' ? 'bg-green-500/20 text-green-400' :
                    grade.gradeLetter === 'B' ? 'bg-[#22D3EE]/20 text-[#22D3EE]' :
                    grade.gradeLetter === 'C' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {grade.gradeLetter}
                  </div>
                  <div>
                    <div className="text-[#E6EAF0] text-sm font-medium">Overall Grade</div>
                    <div className="text-[10px] text-[#6B7280]">Based on technical analysis</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {grade.rubric.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-[#9AA4B2]">{r.category}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#0B0F14] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#22D3EE] rounded-full"
                            style={{ width: `${(r.score / r.maxScore) * 100}%` }}
                          />
                        </div>
                        <span className="text-[#E6EAF0] w-8 text-right">{r.score}/{r.maxScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'riskBox' && riskBox ? (
            <div>
              <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                <Target className="w-3 h-3 mr-1.5" /> Risk Box
              </h3>
              <div className="bg-[#141A22] rounded p-3 border border-[rgba(255,255,255,0.08)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280] uppercase">Entry</span>
                  <span className="text-sm font-mono text-green-400">${riskBox.entry.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280] uppercase">Stop Loss</span>
                  <span className="text-sm font-mono text-red-400">${riskBox.stop.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7280] uppercase">Target</span>
                  <span className="text-sm font-mono text-[#22D3EE]">${riskBox.target.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-[rgba(255,255,255,0.08)]">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[#6B7280]">Risk/Reward</span>
                    <span className="text-[#22D3EE] font-medium">
                      1:{((riskBox.target - riskBox.entry) / (riskBox.entry - riskBox.stop)).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'mistakeMap' && mistakeMap && mistakeMap.length > 0 ? (
            <div>
              <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1.5" /> Mistake Map
              </h3>
              <div className="space-y-2">
                {mistakeMap.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onJumpToMarker?.(m.time)}
                    className={`w-full p-2 rounded border text-left ${
                      m.severity === 'minor' ? 'text-amber-400 bg-amber-400/10 border-amber-400/30' :
                      m.severity === 'major' ? 'text-orange-400 bg-orange-400/10 border-orange-400/30' :
                      'text-red-400 bg-red-400/10 border-red-400/30'
                    }`}
                    data-testid={`mistake-${m.id}`}
                  >
                    <div className="text-[10px] font-medium">{m.title}</div>
                    <div className="text-[9px] opacity-80">{m.description}</div>
                    <div className="text-[9px] mt-1 italic opacity-70">Lesson: {m.lesson}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : activeTab === 'drillMode' && drillScenarios && drillScenarios.length > 0 ? (
            <div>
              <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider mb-2 flex items-center">
                <Play className="w-3 h-3 mr-1.5" /> Drill Mode
              </h3>
              <div className="space-y-2">
                {drillScenarios.map((d) => (
                  <div
                    key={d.id}
                    className="p-2 rounded bg-[#141A22] border border-[rgba(255,255,255,0.08)]"
                    data-testid={`drill-${d.id}`}
                  >
                    <div className="text-[10px] text-[#22D3EE] font-medium mb-1">{d.title}</div>
                    <div className="text-[9px] text-[#9AA4B2] mb-2">{d.description}</div>
                    <div className="flex flex-wrap gap-2 text-[9px]">
                      <span className="px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">
                        Entry: ${d.setup.entryPrice.toFixed(2)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400">
                        Stop: ${d.setup.stopPrice.toFixed(2)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE]">
                        Target: ${d.setup.targetPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-2 text-[9px] text-[#6B7280]">
                      Answer: <span className="text-[#E6EAF0]">{d.correctAnswer.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="text-[9px] text-[#6B7280] mt-1">{d.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-[#6B7280] text-xs mb-3">
                No data for {activeTab?.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              {onGenerate && (
                <button
                  type="button"
                  onClick={onGenerate}
                  className="px-4 py-2 bg-[#22D3EE] text-[#0B0F14] rounded text-xs font-semibold hover:bg-[#22D3EE]/90"
                  data-testid="button-generate-tab-data"
                >
                  <Sparkles className="w-3 h-3 inline mr-1.5" />
                  Generate Coaching
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[#141A22]/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[#9AA4B2] text-xs font-bold uppercase tracking-wider flex items-center">
            <Activity className="w-3 h-3 mr-1.5" /> Market Pulse
          </h3>
          <button 
            type="button"
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
            className="text-[#9AA4B2] hover:text-[#22D3EE] transition-colors"
            data-testid="button-analyze"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analysisMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="bg-[#0B0F14] p-3 rounded border border-[rgba(255,255,255,0.08)] text-xs text-[#9AA4B2] leading-relaxed shadow-inner min-h-[80px]" data-testid="ai-insight">
          {analysisMutation.isPending ? (
            <span className="flex items-center text-[#22D3EE]">
              <Cpu className="w-3 h-3 mr-2 animate-pulse" /> Processing market data...
            </span>
          ) : (
             <div className="whitespace-pre-line">{insight}</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-[#0B0F14]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
              <Bot className="w-12 h-12 text-[#22D3EE] mb-2" />
              <p className="text-xs text-[#9AA4B2] px-4">
                I'm your Coach. I can analyze trends, find levels, and explain price action.
              </p>
            </div>
          )}
          
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] p-3 rounded-xl text-xs shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-[#22D3EE] text-[#0B0F14] rounded-br-none' 
                  : 'bg-[#141A22] text-[#9AA4B2] rounded-bl-none border border-[rgba(255,255,255,0.08)]'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {chatMutation.isPending && (
            <div className="flex justify-start">
               <div className="bg-[#141A22] px-3 py-2 rounded-xl rounded-bl-none border border-[rgba(255,255,255,0.08)] flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-[#9AA4B2] rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                 <div className="w-1.5 h-1.5 bg-[#9AA4B2] rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                 <div className="w-1.5 h-1.5 bg-[#9AA4B2] rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
               </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-[#141A22] border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
            {quickPrompts.map((p, i) => (
              <button
                type="button"
                key={i}
                onClick={() => handleAskAI(p.query)}
                className="whitespace-nowrap px-2.5 py-1 bg-[#0B0F14] hover:bg-[#0F141B] border border-[rgba(255,255,255,0.08)] rounded-full text-[10px] text-[#22D3EE] transition-colors flex-shrink-0"
                data-testid={`quick-prompt-${i}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              placeholder="Ask Coach..."
              className="w-full bg-[#0B0F14] text-[#E6EAF0] text-xs rounded-lg pl-3 pr-10 py-2.5 border border-[rgba(255,255,255,0.08)] focus:border-[#22D3EE] focus:outline-none placeholder-[#6B7280] transition-all"
              data-testid="input-chat"
            />
            <button 
              type="button"
              onClick={() => handleAskAI()}
              disabled={!chatInput.trim()}
              className="absolute right-1.5 top-1.5 p-1.5 bg-[#22D3EE] hover:bg-[#22D3EE]/80 text-[#0B0F14] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-send-chat"
            >
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsModal = ({ 
  isOpen, 
  onClose,
  chartType,
  onChartTypeChange,
  indicators,
  onIndicatorsChange
}: { 
  isOpen: boolean; 
  onClose: () => void;
  chartType: 'candle' | 'line';
  onChartTypeChange: (type: 'candle' | 'line') => void;
  indicators: { volume: boolean; sma: boolean; smaPeriod: number; ema: boolean; emaPeriod: number; rsi: boolean; macd: boolean };
  onIndicatorsChange: (indicators: { volume: boolean; sma: boolean; smaPeriod: number; ema: boolean; emaPeriod: number; rsi: boolean; macd: boolean }) => void;
}) => {
  const [localChartType, setLocalChartType] = useState(chartType);
  const [localVolume, setLocalVolume] = useState(indicators.volume);
  const [localSMA, setLocalSMA] = useState(indicators.sma);
  const [localEMA, setLocalEMA] = useState(indicators.ema);
  
  useEffect(() => {
    if (isOpen) {
      setLocalChartType(chartType);
      setLocalVolume(indicators.volume);
      setLocalSMA(indicators.sma);
      setLocalEMA(indicators.ema);
    }
  }, [isOpen, chartType, indicators]);
  
  const handleSave = () => {
    onChartTypeChange(localChartType);
    onIndicatorsChange({
      ...indicators,
      volume: localVolume,
      sma: localSMA,
      ema: localEMA,
    });
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-[#0F141B] border border-[rgba(255,255,255,0.08)] rounded-lg w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-[#E6EAF0] font-semibold flex items-center">
            <Settings className="w-5 h-5 mr-2 text-[#22D3EE]" />
            Chart Settings
          </h2>
          <button onClick={onClose} className="text-[#9AA4B2] hover:text-[#E6EAF0]" data-testid="button-close-settings">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[#9AA4B2] text-sm">Chart Style</span>
            <select 
              value={localChartType}
              onChange={(e) => setLocalChartType(e.target.value as 'candle' | 'line')}
              className="bg-[#141A22] text-[#E6EAF0] text-sm px-3 py-1.5 rounded border border-[rgba(255,255,255,0.08)] outline-none"
              data-testid="select-chart-type"
            >
              <option value="candle">Candlestick</option>
              <option value="line">Line</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9AA4B2] text-sm">Volume</span>
            <input 
              type="checkbox" 
              checked={localVolume}
              onChange={(e) => setLocalVolume(e.target.checked)}
              className="w-4 h-4 accent-[#22D3EE]" 
              data-testid="checkbox-volume"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9AA4B2] text-sm">SMA (20)</span>
            <input 
              type="checkbox" 
              checked={localSMA}
              onChange={(e) => setLocalSMA(e.target.checked)}
              className="w-4 h-4 accent-[#22D3EE]" 
              data-testid="checkbox-sma"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#9AA4B2] text-sm">EMA (9)</span>
            <input 
              type="checkbox" 
              checked={localEMA}
              onChange={(e) => setLocalEMA(e.target.checked)}
              className="w-4 h-4 accent-[#22D3EE]" 
              data-testid="checkbox-ema"
            />
          </div>
        </div>
        <div className="p-4 border-t border-[rgba(255,255,255,0.08)] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-[#141A22] text-[#9AA4B2] rounded font-medium text-sm hover:bg-[#0F141B] border border-[rgba(255,255,255,0.08)]"
            data-testid="button-cancel-settings"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-[#22D3EE] text-[#0B0F14] rounded font-medium text-sm hover:bg-[#22D3EE]/80"
            data-testid="button-save-settings"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertsModal = ({ isOpen, onClose, symbol, currentPrice }: { isOpen: boolean; onClose: () => void; symbol: string; currentPrice?: number }) => {
  const [_, navigate] = useLocation();
  const [targetPrice, setTargetPrice] = useState(currentPrice?.toFixed(2) || '');
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  
  const createAlertMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/alerts', {
        symbol,
        targetPrice: parseFloat(targetPrice),
        condition,
        notifyEmail: true,
      });
      return response.json();
    },
    onSuccess: () => {
      setTargetPrice('');
      onClose();
    }
  });
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={onClose}>
      <div 
        className="bg-[#0F141B] border border-[rgba(255,255,255,0.08)] rounded-lg w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.08)]">
          <h2 className="text-[#E6EAF0] font-semibold flex items-center">
            <Bell className="w-5 h-5 mr-2 text-[#22D3EE]" />
            Create Alert for {symbol}
          </h2>
          <button onClick={onClose} className="text-[#9AA4B2] hover:text-[#E6EAF0]" data-testid="button-close-alerts">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[#9AA4B2] text-sm mb-2">Condition</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCondition('ABOVE')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  condition === 'ABOVE' 
                    ? 'bg-green-500 text-[#0B0F14]' 
                    : 'bg-[#141A22] text-[#9AA4B2] hover:bg-[#0F141B]'
                }`}
                data-testid="button-condition-above"
              >
                Price Above
              </button>
              <button
                type="button"
                onClick={() => setCondition('BELOW')}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  condition === 'BELOW' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-[#141A22] text-[#9AA4B2] hover:bg-[#0F141B]'
                }`}
                data-testid="button-condition-below"
              >
                Price Below
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-[#9AA4B2] text-sm mb-2">Target Price</label>
            <input
              type="number"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={`Current: $${currentPrice?.toFixed(2) || 'N/A'}`}
              className="w-full bg-[#141A22] text-[#E6EAF0] px-3 py-2 rounded border border-[rgba(255,255,255,0.08)] focus:border-[#22D3EE] outline-none font-mono"
              data-testid="input-target-price"
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => createAlertMutation.mutate()}
              disabled={!targetPrice || createAlertMutation.isPending}
              className="flex-1 px-4 py-2 bg-[#22D3EE] text-[#0B0F14] rounded font-medium text-sm hover:bg-[#22D3EE]/80 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-create-alert"
            >
              {createAlertMutation.isPending ? 'Creating...' : 'Create Alert'}
            </button>
            <button 
              type="button"
              onClick={() => {
                onClose();
                navigate('/app/alerts');
              }}
              className="px-4 py-2 bg-[#141A22] text-[#9AA4B2] rounded font-medium text-sm hover:bg-[#0F141B] border border-[rgba(255,255,255,0.08)]"
              data-testid="button-manage-alerts"
            >
              View All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Charts() {
  const [symbol, setSymbol] = useState("SPY");
  const [timeframe, setTimeframe] = useState("1mo");
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [indicators, setIndicators] = useState({
    volume: true,
    sma: false,
    smaPeriod: 20,
    ema: false,
    emaPeriod: 9,
    rsi: false,
    macd: false,
  });
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('none');
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showDrawings, setShowDrawings] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<TVChartApi | null>(null);
  const handleGenerateCoachingRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();
  
  // Tier detection for gated features
  const { hasTierAccess, tier } = useUserTier();
  const isPro = hasTierAccess('pro');
  const isElite = hasTierAccess('premium');
  
  // Active coaching tab - null means none selected
  const [activeCoachTab, setActiveCoachTab] = useState<CoachTab | null>(null);
  const [coachMarkers, setCoachMarkers] = useState<CoachMarker[]>([]);
  const [tradeGrade, setTradeGrade] = useState<TradeGrade | undefined>();
  const [riskBoxData, setRiskBoxData] = useState<{ entry: number; stop: number; target: number } | undefined>();
  const [mistakeMap, setMistakeMap] = useState<MistakeMapItem[]>([]);
  const [drillScenarios, setDrillScenarios] = useState<DrillScenario[]>([]);
  const [isGeneratingCoaching, setIsGeneratingCoaching] = useState(false);
  const [showMobileCoachPanel, setShowMobileCoachPanel] = useState(false);
  
  // Check if we have coaching data
  const hasCoachingData = coachMarkers.length > 0 || tradeGrade !== undefined || riskBoxData !== undefined || mistakeMap.length > 0 || drillScenarios.length > 0;

  const queryUrl = `/api/chart/${symbol}?period=${timeframe}`;
  const { data: rawChartData, isLoading, error } = useQuery<ChartDataPoint[]>({
    queryKey: [queryUrl],
    staleTime: 60000,
  });

  const handleCoachTabChange = useCallback((key: CoachTab, shouldAutoGenerate: boolean = true) => {
    // Toggle off if clicking the same tab
    if (activeCoachTab === key) {
      setActiveCoachTab(null);
    } else {
      setActiveCoachTab(key);
      // Auto-generate coaching if no data exists and user has access
      if (shouldAutoGenerate && !hasCoachingData && !isGeneratingCoaching && isPro) {
        // Delay slightly to allow state to update first
        setTimeout(() => {
          handleGenerateCoachingRef.current?.();
        }, 100);
      }
    }
  }, [activeCoachTab, hasCoachingData, isGeneratingCoaching, isPro]);

  const handleGenerateCoaching = useCallback(async () => {
    // Block free users from calling the API
    if (!isPro) {
      toast({ 
        title: "Pro subscription required", 
        description: "Upgrade to Pro to unlock AI chart coaching.",
        variant: "destructive" 
      });
      return;
    }
    
    const api = chartApiRef.current;
    const data = rawChartData;
    
    if (!api || !data || data.length === 0) {
      toast({ title: "Chart not ready", variant: "destructive" });
      return;
    }
    
    // Check if markers are supported (candlestick charts only)
    if (!api.supportsMarkers) {
      toast({ 
        title: "Coach markers require candlestick chart", 
        description: "Switch to candlestick view to see coaching overlays.",
        variant: "destructive" 
      });
    }
    
    setIsGeneratingCoaching(true);
    
    try {
      const candles = data.slice(-120).map(d => ({
        time: Math.floor(new Date(d.date).getTime() / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      
      // Call backend API for coaching
      // Include dev auth header for development environment
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (import.meta.env.DEV) {
        const devToken = localStorage.getItem('devAuthToken');
        if (devToken) {
          headers['X-Dev-Auth'] = devToken;
        }
      }
      
      const response = await fetch('/api/chart/coaching', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ symbol, candles }),
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate coaching');
      }
      
      const coaching = await response.json();
      
      setCoachMarkers(coaching.markers || []);
      if (coaching.grade) setTradeGrade(coaching.grade);
      if (coaching.riskBox) setRiskBoxData(coaching.riskBox);
      if (coaching.mistakeMap) setMistakeMap(coaching.mistakeMap);
      if (coaching.drillScenarios) setDrillScenarios(coaching.drillScenarios);
      
      // Only apply markers if chart supports them and coachNotes is active
      if (api.supportsMarkers && activeCoachTab === 'coachNotes' && coaching.markers?.length > 0) {
        applyCoachMarkers(api, coaching.markers);
      }
      
      toast({ title: "Coaching generated successfully" });
    } catch (err) {
      console.error('Coaching generation failed:', err);
      toast({ 
        title: "Failed to generate coaching", 
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive" 
      });
    } finally {
      setIsGeneratingCoaching(false);
    }
  }, [rawChartData, activeCoachTab, toast, symbol, isPro]);

  // Update ref so it can be called from handleCoachTabChange
  useEffect(() => {
    handleGenerateCoachingRef.current = handleGenerateCoaching;
  }, [handleGenerateCoaching]);

  const handleJumpToMarker = useCallback((time: number) => {
    const api = chartApiRef.current;
    if (api) {
      // jumpToTime now uses the sorted candle data stored in the API
      api.jumpToTime(time as any);
    }
  }, []);

  const handleChartReady = useCallback((api: TVChartApi) => {
    chartApiRef.current = api;
    // Re-apply markers if they exist when chart is re-created and chart supports markers
    if (api.supportsMarkers && activeCoachTab === 'coachNotes' && coachMarkers.length > 0) {
      applyCoachMarkers(api, coachMarkers);
    }
  }, [activeCoachTab, coachMarkers]);

  // Clear chart API ref when symbol/timeframe changes (chart will be re-created)
  useEffect(() => {
    chartApiRef.current = null;
  }, [symbol, timeframe, chartType]);

  useEffect(() => {
    const api = chartApiRef.current;
    if (!api) return;
    
    if (activeCoachTab === 'coachNotes' && coachMarkers.length > 0) {
      applyCoachMarkers(api, coachMarkers);
    } else {
      clearCoachMarkers(api);
    }
  }, [activeCoachTab, coachMarkers]);

  useEffect(() => {
    const loaded = loadDrawings(symbol, timeframe);
    setDrawings(loaded);
  }, [symbol, timeframe]);

  useEffect(() => {
    const prefs = loadChartPreferences(symbol, timeframe);
    if (prefs) {
      setChartType(prefs.chartType);
      setIndicators(prefs.indicators);
    }
  }, [symbol, timeframe]);

  const handleDrawingsChange = useCallback((newDrawings: Drawing[]) => {
    setDrawings(newDrawings);
    saveDrawings(symbol, timeframe, newDrawings);
  }, [symbol, timeframe]);

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
    saveDrawings(symbol, timeframe, []);
    setSelectedDrawingId(null);
    toast({ title: "Drawings cleared" });
  }, [symbol, timeframe, toast]);

  const handleDeleteSelectedDrawing = useCallback(() => {
    if (selectedDrawingId) {
      const newDrawings = drawings.filter(d => d.id !== selectedDrawingId);
      handleDrawingsChange(newDrawings);
      setSelectedDrawingId(null);
    }
  }, [selectedDrawingId, drawings, handleDrawingsChange]);

  const handleDrawingComplete = useCallback(() => {
    setDrawingTool('none');
  }, []);

  const handleResetView = useCallback(() => {
    setResetViewTrigger(prev => prev + 1);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement && chartContainerRef.current) {
      chartContainerRef.current.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const currentPrice = rawChartData && rawChartData.length > 0 
    ? rawChartData[rawChartData.length - 1].close 
    : undefined;

  return (
    <div ref={chartContainerRef} className="flex flex-col min-h-screen lg:h-screen bg-[#0B0F14] text-[#E6EAF0] lg:overflow-hidden overflow-y-auto" data-testid="trendspider-chart">
      <Header 
        symbol={symbol} 
        onSymbolChange={setSymbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onOpenAlerts={() => setShowAlerts(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenIndicators={() => setShowIndicators(true)}
        onOpenDrawings={() => setShowDrawings(true)}
        indicators={indicators}
      />
      <OHLCStatusBar data={rawChartData} symbol={symbol} />
      <CoachModeBar 
        activeTab={activeCoachTab}
        onTabChange={handleCoachTabChange}
        onGenerateCoaching={handleGenerateCoaching}
        isGenerating={isGeneratingCoaching}
        hasCoachingData={hasCoachingData}
        isPro={isPro}
        isElite={isElite}
      />
      <div className="flex flex-1 lg:overflow-hidden min-h-0" style={{ minHeight: '300px' }}>
        <DrawingToolbar 
          activeTool={drawingTool} 
          onToolChange={setDrawingTool}
          onClearDrawings={handleClearDrawings}
          drawingCount={drawings.length}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onResetView={handleResetView}
        />
        <main className="flex-1 flex flex-col relative bg-[#0B0F14]" data-testid="chart-area">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-[#9AA4B2]">Loading {symbol} data...</div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-destructive">Failed to load chart data</div>
            </div>
          ) : (
            <TVChart
              symbol={symbol}
              timeframe={timeframe}
              chartType={chartType}
              indicators={indicators}
              drawings={drawings}
              onDrawingsChange={handleDrawingsChange}
              drawingTool={drawingTool}
              onDrawingComplete={handleDrawingComplete}
              selectedDrawingId={selectedDrawingId}
              onDrawingSelect={setSelectedDrawingId}
              resetViewTrigger={resetViewTrigger}
              onReady={handleChartReady}
            />
          )}
        </main>
        {/* Desktop: Sidebar panel */}
        {rawChartData && rawChartData.length > 0 && (
          <div className="hidden lg:block">
            <IronStrikeCoachPanel 
              data={rawChartData} 
              symbol={symbol}
              activeTab={activeCoachTab}
              markers={coachMarkers}
              grade={tradeGrade}
              riskBox={riskBoxData}
              mistakeMap={mistakeMap}
              drillScenarios={drillScenarios}
              onJumpToMarker={handleJumpToMarker}
              isGenerating={isGeneratingCoaching}
              onGenerate={handleGenerateCoaching}
            />
          </div>
        )}
        
        {/* Mobile: Floating button to open coach panel */}
        <Button
          size="icon"
          onClick={() => setShowMobileCoachPanel(true)}
          className="lg:hidden fixed bottom-24 left-4 z-50 h-12 w-12 rounded-full bg-[#22D3EE] text-[#0B0F14] shadow-lg shadow-[#22D3EE]/30 hover:bg-[#22D3EE]/90"
          data-testid="button-open-mobile-coach"
        >
          <Bot className="h-6 w-6" />
        </Button>
      </div>
      
      
      
      {/* Mobile Coach Panel Sheet */}
      <Sheet open={showMobileCoachPanel} onOpenChange={setShowMobileCoachPanel}>
        <SheetContent side="right" className="w-full sm:w-[400px] p-0 bg-[#0F141B] border-l border-[rgba(255,255,255,0.08)]">
          <SheetHeader className="sr-only">
            <SheetTitle>Iron Strike Coach</SheetTitle>
          </SheetHeader>
          {rawChartData && rawChartData.length > 0 && (
            <IronStrikeCoachPanel 
              data={rawChartData} 
              symbol={symbol}
              activeTab={activeCoachTab}
              markers={coachMarkers}
              grade={tradeGrade}
              riskBox={riskBoxData}
              mistakeMap={mistakeMap}
              drillScenarios={drillScenarios}
              onJumpToMarker={handleJumpToMarker}
              isGenerating={isGeneratingCoaching}
              onGenerate={handleGenerateCoaching}
              isMobile
            />
          )}
        </SheetContent>
      </Sheet>
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        chartType={chartType}
        onChartTypeChange={setChartType}
        indicators={indicators}
        onIndicatorsChange={setIndicators}
      />
      <AlertsModal 
        isOpen={showAlerts} 
        onClose={() => setShowAlerts(false)} 
        symbol={symbol} 
        currentPrice={currentPrice} 
      />
      <IndicatorsDrawer
        open={showIndicators}
        onOpenChange={setShowIndicators}
        config={indicators}
        onConfigChange={setIndicators}
      />
      <DrawingsDrawer
        open={showDrawings}
        onOpenChange={setShowDrawings}
        activeTool={drawingTool}
        onToolSelect={setDrawingTool}
        drawings={drawings}
        selectedDrawingId={selectedDrawingId}
        onDrawingSelect={setSelectedDrawingId}
        onDeleteSelected={handleDeleteSelectedDrawing}
        onClearAll={handleClearDrawings}
      />
    </div>
  );
}
