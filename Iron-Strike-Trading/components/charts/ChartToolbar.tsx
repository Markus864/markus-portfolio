import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  CandlestickChart, 
  LineChart, 
  RotateCcw,
} from "lucide-react";

interface ChartToolbarProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  chartType: 'candle' | 'line';
  onChartTypeChange: (type: 'candle' | 'line') => void;
}

const timeframes = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y' },
];

const popularSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "SPY", "QQQ", "AMD"];

export function ChartToolbar({
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  chartType,
  onChartTypeChange,
}: ChartToolbarProps) {
  const [inputValue, setInputValue] = useState(symbol);

  const handleSearch = () => {
    const cleanSymbol = inputValue.trim().toUpperCase();
    if (cleanSymbol) {
      onSymbolChange(cleanSymbol);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleQuickSymbol = (s: string) => {
    setInputValue(s);
    onSymbolChange(s);
  };

  return (
    <div className="flex flex-col border-b border-border bg-[#0F141B]" data-testid="chart-toolbar">
      <div className="flex items-center gap-2 p-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Input
            placeholder="Symbol..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            className="w-24 h-8 uppercase font-mono text-sm bg-[#141A22] border-[rgba(255,255,255,0.1)]"
            data-testid="input-chart-symbol"
          />
          <Button size="sm" variant="ghost" onClick={handleSearch} className="h-8 px-2" data-testid="button-chart-search">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />

        <div className="flex items-center gap-1">
          {timeframes.map((tf) => (
            <Button
              key={tf.value}
              size="sm"
              variant={timeframe === tf.value ? 'default' : 'ghost'}
              onClick={() => onTimeframeChange(tf.value)}
              className="h-8 px-2 text-xs"
              data-testid={`button-timeframe-${tf.value}`}
            >
              {tf.label}
            </Button>
          ))}
        </div>

        <div className="h-6 w-px bg-[rgba(255,255,255,0.1)]" />

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={chartType === 'candle' ? 'default' : 'ghost'}
            onClick={() => onChartTypeChange('candle')}
            className="h-8 px-2"
            data-testid="button-chart-type-candle"
          >
            <CandlestickChart className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={chartType === 'line' ? 'default' : 'ghost'}
            onClick={() => onChartTypeChange('line')}
            className="h-8 px-2"
            data-testid="button-chart-type-line"
          >
            <LineChart className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 pb-2 overflow-x-auto">
        {popularSymbols.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={symbol === s ? 'default' : 'outline'}
            onClick={() => handleQuickSymbol(s)}
            className="h-6 px-2 text-xs"
            data-testid={`button-quick-symbol-${s}`}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}
