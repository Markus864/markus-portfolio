import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Bar,
  Cell,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, BarChart3, CandlestickChart } from "lucide-react";

interface CandlestickProps {
  x: number;
  y: number;
  width: number;
  height: number;
  open: number;
  close: number;
  high: number;
  low: number;
  yAxisDomain: [number, number];
  chartHeight: number;
}

function Candlestick({ x, y, width, height, open, close, high, low, yAxisDomain, chartHeight }: CandlestickProps) {
  const isBullish = close >= open;
  const color = isBullish ? "#22c55e" : "#ef4444";
  
  const [minPrice, maxPrice] = yAxisDomain;
  const priceRange = maxPrice - minPrice;
  
  const candleWidth = Math.max(width * 0.6, 4);
  const wickWidth = Math.max(width * 0.1, 1);
  
  const toY = (price: number) => chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  
  const bodyTop = toY(Math.max(open, close));
  const bodyBottom = toY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
  
  const wickTop = toY(high);
  const wickBottom = toY(low);
  
  const centerX = x + width / 2;
  
  return (
    <g>
      <line
        x1={centerX}
        y1={wickTop}
        x2={centerX}
        y2={wickBottom}
        stroke={color}
        strokeWidth={wickWidth}
      />
      <rect
        x={centerX - candleWidth / 2}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={isBullish ? color : color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
}

interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  symbol: string;
  currentPrice?: number;
  priceChange?: number;
  compact?: boolean;
}

const timeframes = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "5d" },
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
];

const intradayIntervals = [
  { label: "5m", value: "5min" },
  { label: "15m", value: "15min" },
  { label: "30m", value: "30min" },
  { label: "1H", value: "1hour" },
  { label: "4H", value: "4hour" },
];

function calculateSMA(data: ChartDataPoint[], period: number): (number | null)[] {
  return data.map((_, index) => {
    if (index < period - 1) return null;
    const sum = data
      .slice(index - period + 1, index + 1)
      .reduce((acc, d) => acc + d.close, 0);
    return sum / period;
  });
}

function calculateEMA(data: ChartDataPoint[], period: number): (number | null)[] {
  const multiplier = 2 / (period + 1);
  const ema: (number | null)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push(null);
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((acc, d) => acc + d.close, 0);
      ema.push(sum / period);
    } else {
      const prevEma = ema[i - 1] as number;
      ema.push((data[i].close - prevEma) * multiplier + prevEma);
    }
  }
  return ema;
}

function calculateRSI(data: ChartDataPoint[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rsi.push(null);
      continue;
    }
    
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
    
    if (i < period) {
      rsi.push(null);
      continue;
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  return rsi;
}

function calculateMACD(data: ChartDataPoint[]): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  const macd: (number | null)[] = data.map((_, i) => {
    if (ema12[i] === null || ema26[i] === null) return null;
    return (ema12[i] as number) - (ema26[i] as number);
  });
  
  const macdData = macd
    .filter((v): v is number => v !== null)
    .map((v, i) => ({ close: v, open: v, high: v, low: v, volume: 0, date: "" }));
  
  const signalRaw = calculateEMA(macdData as ChartDataPoint[], 9);
  
  const signal: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
    } else {
      signal.push(signalRaw[signalIdx] || null);
      signalIdx++;
    }
  }
  
  const histogram: (number | null)[] = macd.map((m, i) => {
    if (m === null || signal[i] === null) return null;
    return m - (signal[i] as number);
  });
  
  return { macd, signal, histogram };
}

export function PriceChart({ symbol, currentPrice, priceChange, compact = false }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState("1mo");
  const [interval, setInterval] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState({
    sma20: false,
    ema9: false,
    volume: true,
  });
  const [chartType, setChartType] = useState<"line" | "area" | "candle">("area");

  // Build query URL with optional interval parameter
  const queryUrl = interval 
    ? `/api/chart/${symbol}?period=${timeframe}&interval=${interval}`
    : `/api/chart/${symbol}?period=${timeframe}`;

  const { data: chartData, isLoading, error } = useQuery<ChartDataPoint[]>({
    queryKey: [queryUrl],
    staleTime: 60000,
  });

  // Show intraday intervals only for short-term periods
  const showIntradayIntervals = ["1d", "5d", "1mo"].includes(timeframe);

  const processedData = useMemo(() => {
    if (!chartData?.length) return [];
    
    const sma20Array = showIndicators.sma20 ? calculateSMA(chartData, 20) : [];
    const ema9Array = showIndicators.ema9 ? calculateEMA(chartData, 9) : [];
    
    // Format date based on whether we have intraday or daily data
    const isIntraday = interval !== null || timeframe === "1d" || timeframe === "5d";
    
    return chartData.map((d, index) => {
      const dateObj = new Date(d.date);
      
      // For intraday data, show time; for daily, show date
      const dateLabel = isIntraday 
        ? dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      const fullDateLabel = dateObj.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      
      return {
        ...d,
        date: dateLabel,
        fullDate: fullDateLabel,
        sma20: sma20Array[index],
        ema9: ema9Array[index],
      };
    });
  }, [chartData, showIndicators.sma20, showIndicators.ema9, interval, timeframe]);

  const priceMin = processedData.length ? Math.min(...processedData.map(d => d.low)) * 0.995 : 0;
  const priceMax = processedData.length ? Math.max(...processedData.map(d => d.high)) * 1.005 : 0;

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""} data-testid={`chart-loading-${symbol}`}>
        <CardContent className="p-4">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !chartData?.length) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""} data-testid={`chart-error-${symbol}`}>
        <CardContent className="p-4 text-center text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load chart data</p>
        </CardContent>
      </Card>
    );
  }

  const isPositive = (priceChange || 0) >= 0;

  return (
    <Card className={compact ? "border-0 shadow-none bg-transparent" : ""} data-testid={`chart-container-${symbol}`}>
      {!compact && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{symbol}</CardTitle>
              {currentPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold font-mono">${currentPrice.toFixed(2)}</span>
                  {priceChange !== undefined && (
                    <span className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isPositive ? "+" : ""}{priceChange.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {timeframes.map(tf => (
                <Button
                  key={tf.value}
                  variant={timeframe === tf.value && !interval ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTimeframe(tf.value);
                    setInterval(null); // Reset interval when changing timeframe
                  }}
                  data-testid={`timeframe-${tf.value}-${symbol}`}
                >
                  {tf.label}
                </Button>
              ))}
            </div>
          </div>
          {showIntradayIntervals && (
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Interval:</span>
              {intradayIntervals.map(iv => (
                <Button
                  key={iv.value}
                  variant={interval === iv.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setInterval(iv.value)}
                  data-testid={`interval-${iv.value}-${symbol}`}
                >
                  {iv.label}
                </Button>
              ))}
              {interval && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInterval(null)}
                  className="text-muted-foreground"
                  data-testid={`interval-reset-${symbol}`}
                >
                  Default
                </Button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Button
              variant={chartType === "area" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartType("area")}
              data-testid={`chart-type-area-${symbol}`}
            >
              <Activity className="h-4 w-4 mr-1" />
              Area
            </Button>
            <Button
              variant={chartType === "line" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartType("line")}
              data-testid={`chart-type-line-${symbol}`}
            >
              <TrendingUp className="h-4 w-4 mr-1" />
              Line
            </Button>
            <Button
              variant={chartType === "candle" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartType("candle")}
              data-testid={`chart-type-candle-${symbol}`}
            >
              <CandlestickChart className="h-4 w-4 mr-1" />
              Candles
            </Button>
            <div className="h-4 w-px bg-border mx-2" />
            <Button
              variant={showIndicators.sma20 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowIndicators(prev => ({ ...prev, sma20: !prev.sma20 }))}
              data-testid={`indicator-sma20-${symbol}`}
            >
              SMA 20
            </Button>
            <Button
              variant={showIndicators.ema9 ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowIndicators(prev => ({ ...prev, ema9: !prev.ema9 }))}
              data-testid={`indicator-ema9-${symbol}`}
            >
              EMA 9
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent className={compact ? "p-0" : "pt-0"}>
        <div className={compact ? "h-[120px]" : "h-[300px]"} data-testid={`chart-${symbol}`}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "candle" ? (
              <ComposedChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                {!compact && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[priceMin, priceMax]}
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  width={compact ? 45 : 60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0]?.payload?.fullDate) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-md p-2 text-sm">
                          <p className="font-medium">{data.fullDate || label}</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                            <span className="text-muted-foreground">Open:</span>
                            <span className="font-mono">${data.open?.toFixed(2)}</span>
                            <span className="text-muted-foreground">High:</span>
                            <span className="font-mono">${data.high?.toFixed(2)}</span>
                            <span className="text-muted-foreground">Low:</span>
                            <span className="font-mono">${data.low?.toFixed(2)}</span>
                            <span className="text-muted-foreground">Close:</span>
                            <span className="font-mono">${data.close?.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {!compact && <Legend />}
                <Bar
                  dataKey="high"
                  fill="transparent"
                  name="OHLC"
                  shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const chartHeight = compact ? 110 : 280;
                    return (
                      <Candlestick
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        open={payload.open}
                        close={payload.close}
                        high={payload.high}
                        low={payload.low}
                        yAxisDomain={[priceMin, priceMax]}
                        chartHeight={chartHeight}
                      />
                    );
                  }}
                />
                {showIndicators.sma20 && (
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1.5}
                    name="SMA 20"
                    connectNulls
                  />
                )}
                {showIndicators.ema9 && (
                  <Line
                    type="monotone"
                    dataKey="ema9"
                    stroke="#8b5cf6"
                    dot={false}
                    strokeWidth={1.5}
                    name="EMA 9"
                    connectNulls
                  />
                )}
              </ComposedChart>
            ) : chartType === "area" ? (
              <ComposedChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                {!compact && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[priceMin, priceMax]}
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  width={compact ? 45 : 60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0]?.payload?.fullDate) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                />
                {!compact && <Legend />}
                <defs>
                  <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={isPositive ? "#22c55e" : "#ef4444"}
                  fill={`url(#gradient-${symbol})`}
                  strokeWidth={2}
                  name="Price"
                />
                {showIndicators.sma20 && (
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1.5}
                    name="SMA 20"
                    connectNulls
                  />
                )}
                {showIndicators.ema9 && (
                  <Line
                    type="monotone"
                    dataKey="ema9"
                    stroke="#8b5cf6"
                    dot={false}
                    strokeWidth={1.5}
                    name="EMA 9"
                    connectNulls
                  />
                )}
              </ComposedChart>
            ) : (
              <LineChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                {!compact && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[priceMin, priceMax]}
                  tick={{ fontSize: compact ? 10 : 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="fill-muted-foreground"
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  width={compact ? 45 : 60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  labelFormatter={(label, payload) => {
                    if (payload?.[0]?.payload?.fullDate) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, ""]}
                />
                {!compact && <Legend />}
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isPositive ? "#22c55e" : "#ef4444"}
                  dot={false}
                  strokeWidth={2}
                  name="Price"
                />
                {showIndicators.sma20 && (
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="#f59e0b"
                    dot={false}
                    strokeWidth={1.5}
                    name="SMA 20"
                    connectNulls
                  />
                )}
                {showIndicators.ema9 && (
                  <Line
                    type="monotone"
                    dataKey="ema9"
                    stroke="#8b5cf6"
                    dot={false}
                    strokeWidth={1.5}
                    name="EMA 9"
                    connectNulls
                  />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function RSIChart({ symbol }: { symbol: string }) {
  const { data: chartData, isLoading } = useQuery<ChartDataPoint[]>({
    queryKey: [`/api/chart/${symbol}?period=1mo`],
    staleTime: 60000,
  });

  const processedData = useMemo(() => {
    if (!chartData?.length) return [];
    const rsiValues = calculateRSI(chartData);
    return chartData.map((d, i) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      rsi: rsiValues[i],
    }));
  }, [chartData]);

  if (isLoading || !chartData?.length) {
    return <Skeleton className="h-[100px] w-full" />;
  }

  return (
    <div className="h-[100px]" data-testid={`rsi-chart-${symbol}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 100]} ticks={[30, 70]} tick={{ fontSize: 10 }} width={30} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            formatter={(value: number) => [value?.toFixed(1), "RSI"]}
          />
          <Line type="monotone" dataKey="rsi" stroke="#3b82f6" dot={false} strokeWidth={1.5} connectNulls />
          <Line
            type="monotone"
            dataKey={() => 70}
            stroke="#ef4444"
            strokeDasharray="3 3"
            dot={false}
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey={() => 30}
            stroke="#22c55e"
            strokeDasharray="3 3"
            dot={false}
            strokeWidth={1}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MACDChart({ symbol }: { symbol: string }) {
  // MACD needs at least 35 data points (26 for EMA-26 + 9 for signal line)
  // Use 3 month period to ensure enough data
  const { data: chartData, isLoading } = useQuery<ChartDataPoint[]>({
    queryKey: [`/api/chart/${symbol}?period=3mo`],
    staleTime: 60000,
  });

  const processedData = useMemo(() => {
    if (!chartData?.length) return [];
    const { macd, signal, histogram } = calculateMACD(chartData);
    return chartData.map((d, i) => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      macd: macd[i],
      signal: signal[i],
      histogram: histogram[i],
    }));
  }, [chartData]);

  if (isLoading || !chartData?.length) {
    return <Skeleton className="h-[100px] w-full" />;
  }

  return (
    <div className="h-[100px]" data-testid={`macd-chart-${symbol}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <XAxis dataKey="date" hide />
          <YAxis tick={{ fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
            formatter={(value: number) => [value?.toFixed(2), ""]}
          />
          <Bar
            dataKey="histogram"
            fill="#94a3b8"
            name="Histogram"
          />
          <Line type="monotone" dataKey="macd" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="MACD" connectNulls />
          <Line type="monotone" dataKey="signal" stroke="#f97316" dot={false} strokeWidth={1.5} name="Signal" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
