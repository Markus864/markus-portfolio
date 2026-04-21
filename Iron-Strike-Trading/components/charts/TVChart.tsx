import { useEffect, useRef, useState, useCallback } from "react";
import { 
  createChart, 
  ColorType, 
  CrosshairMode, 
  IChartApi, 
  CandlestickData, 
  LineData, 
  HistogramData, 
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ISeriesApi,
  SeriesMarker
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { 
  OHLCData, 
  calculateSMA, 
  calculateEMA, 
  Drawing
} from "./chart-utils";
import type { DrawingTool } from "./DrawingsDrawer";

// Expose chart API for coaching overlays
export type TVChartApi = {
  chart: IChartApi;
  candleSeries: ISeriesApi<'Candlestick'> | null;
  lineSeries: ISeriesApi<'Line'> | null;
  volumeSeries?: ISeriesApi<'Histogram'>;
  chartType: 'candle' | 'line';
  supportsMarkers: boolean; // Markers only work on candlestick charts
  sortedCandleData: { time: number }[]; // Sorted candle data for binary search
  setMarkers: (markers: SeriesMarker<Time>[]) => void;
  clearMarkers: () => void;
  jumpToTime: (time: Time) => void;
};

interface TVChartProps {
  symbol: string;
  timeframe: string;
  chartType: 'candle' | 'line';
  indicators: {
    volume: boolean;
    sma: boolean;
    smaPeriod: number;
    ema: boolean;
    emaPeriod: number;
    rsi: boolean;
    macd: boolean;
  };
  drawings: Drawing[];
  onDrawingsChange: (drawings: Drawing[]) => void;
  drawingTool: DrawingTool;
  onDrawingComplete: () => void;
  selectedDrawingId: string | null;
  onDrawingSelect: (id: string | null) => void;
  resetViewTrigger?: number;
  onReady?: (api: TVChartApi) => void;
}

interface ChartDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type DragState = {
  active: boolean;
  drawingId: string;
  type: 'move' | 'resize';
  pointIndex?: number;
  startX: number;
  startY: number;
  originalPoints: { time: number; price: number }[];
};

type HoverState = {
  drawingId: string | null;
  type: 'body' | 'endpoint' | null;
  pointIndex?: number;
};

const ENDPOINT_RADIUS = 6;
const HIT_THRESHOLD = 10;

export function TVChart({
  symbol,
  timeframe,
  chartType,
  indicators,
  drawings,
  onDrawingsChange,
  drawingTool,
  onDrawingComplete,
  selectedDrawingId,
  onDrawingSelect,
  resetViewTrigger,
  onReady,
}: TVChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const smaSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [drawingPoints, setDrawingPoints] = useState<{ time: number; price: number }[]>([]);
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [ohlcData, setOhlcData] = useState<OHLCData[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>({ drawingId: null, type: null });

  const queryUrl = `/api/chart/${symbol}?period=${timeframe}`;

  const { data: chartData, isLoading, error } = useQuery<ChartDataPoint[]>({
    queryKey: [queryUrl],
    staleTime: 60000,
  });

  useEffect(() => {
    if (chartData && chartData.length > 0) {
      const converted: OHLCData[] = chartData.map((d) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      setOhlcData(converted);
    }
  }, [chartData]);

  useEffect(() => {
    if (!chartContainerRef.current || !chartData?.length) return;

    const container = chartContainerRef.current;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9AA4B2',
        fontFamily: 'Inter, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { 
          color: '#22D3EE', 
          width: 1, 
          style: 0,
          labelBackgroundColor: '#22D3EE',
          labelVisible: true,
        },
        horzLine: { 
          color: '#22D3EE', 
          width: 1, 
          style: 0,
          labelBackgroundColor: '#22D3EE',
          labelVisible: true,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: indicators.volume ? 0.25 : 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Sort data by time ascending before setting on chart
    const sortedData = [...chartData].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const candleData: CandlestickData<Time>[] = sortedData.map((d) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const lineData: LineData<Time>[] = sortedData.map((d) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000) as Time,
      value: d.close,
    }));

    if (chartType === 'candle') {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });
      series.setData(candleData);
      mainSeriesRef.current = series as any;
    } else {
      const series = chart.addSeries(LineSeries, {
        color: '#22D3EE',
        lineWidth: 2,
      });
      series.setData(lineData);
      mainSeriesRef.current = series as any;
    }

    if (indicators.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
      const volumeData: HistogramData<Time>[] = sortedData.map((d) => ({
        time: Math.floor(new Date(d.date).getTime() / 1000) as Time,
        value: d.volume,
        color: d.close >= d.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
      }));
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries as any;
    }

    if (indicators.sma && ohlcData.length > 0) {
      const smaData = calculateSMA(ohlcData, indicators.smaPeriod);
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
      });
      smaSeries.setData(smaData.map((d) => ({ time: d.time as Time, value: d.value })));
      smaSeriesRef.current = smaSeries as any;
    }

    if (indicators.ema && ohlcData.length > 0) {
      const emaData = calculateEMA(ohlcData, indicators.emaPeriod);
      const emaSeries = chart.addSeries(LineSeries, {
        color: '#8b5cf6',
        lineWidth: 1,
      });
      emaSeries.setData(emaData.map((d) => ({ time: d.time as Time, value: d.value })));
      emaSeriesRef.current = emaSeries as any;
    }

    chart.timeScale().fitContent();

    // Create sorted candle data for the API (same order as chart series)
    const sortedCandleTimestamps = sortedData.map(d => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
    }));

    // Expose chart API for coaching overlays
    if (onReady && mainSeriesRef.current) {
      const isCandleChart = chartType === 'candle';
      const api: TVChartApi = {
        chart,
        chartType,
        supportsMarkers: isCandleChart,
        sortedCandleData: sortedCandleTimestamps,
        candleSeries: isCandleChart ? mainSeriesRef.current as ISeriesApi<'Candlestick'> : null,
        lineSeries: !isCandleChart ? mainSeriesRef.current as ISeriesApi<'Line'> : null,
        volumeSeries: volumeSeriesRef.current as ISeriesApi<'Histogram'> | undefined,
        setMarkers: (markers: SeriesMarker<Time>[]) => {
          // Only candlestick series supports markers
          if (isCandleChart && mainSeriesRef.current) {
            try {
              mainSeriesRef.current.setMarkers(markers);
            } catch (e) {
              console.warn('Failed to set markers:', e);
            }
          }
        },
        clearMarkers: () => {
          if (isCandleChart && mainSeriesRef.current) {
            try {
              mainSeriesRef.current.setMarkers([]);
            } catch (e) {
              console.warn('Failed to clear markers:', e);
            }
          }
        },
        jumpToTime: (targetTime: Time) => {
          try {
            // Get current visible logical range to maintain same bar count
            const logicalRange = chart.timeScale().getVisibleLogicalRange();
            const visibleBars = logicalRange ? Math.abs(logicalRange.to - logicalRange.from) : 50;
            const halfBars = Math.floor(visibleBars / 2);
            
            const targetTimestamp = targetTime as number;
            const candleData = sortedCandleTimestamps;
            
            if (candleData.length === 0) {
              chart.timeScale().scrollToRealTime();
              return;
            }
            
            let targetIndex = -1;
            
            // Binary search for the closest bar
            let left = 0;
            let right = candleData.length - 1;
            while (left <= right) {
              const mid = Math.floor((left + right) / 2);
              const midTime = candleData[mid]?.time;
              if (midTime === targetTimestamp) {
                targetIndex = mid;
                break;
              } else if (midTime < targetTimestamp) {
                left = mid + 1;
              } else {
                right = mid - 1;
              }
            }
            
            // If not exact match, use closest
            if (targetIndex === -1) {
              targetIndex = Math.min(left, candleData.length - 1);
            }
            
            // Center the view around the target bar index
            chart.timeScale().setVisibleLogicalRange({
              from: targetIndex - halfBars,
              to: targetIndex + halfBars,
            });
          } catch (e) {
            console.warn('Failed to jump to time:', e);
            chart.timeScale().scrollToRealTime();
          }
        },
      };
      onReady(api);
    }

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, chartType, indicators.volume, indicators.sma, indicators.ema, indicators.smaPeriod, indicators.emaPeriod, indicators.rsi, indicators.macd, ohlcData, onReady]);

  useEffect(() => {
    if (chartRef.current && resetViewTrigger !== undefined) {
      chartRef.current.timeScale().fitContent();
    }
  }, [resetViewTrigger]);

  useEffect(() => {
    const canvas = drawingCanvasRef.current;
    const container = chartContainerRef.current;
    if (!canvas || !container) return;

    const sizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
    };

    sizeCanvas();

    const resizeObserver = new ResizeObserver(() => {
      sizeCanvas();
    });
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const getScreenPoints = useCallback((drawing: Drawing): { x: number; y: number; valid: boolean }[] => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries) return [];
    
    return drawing.points.map((pt) => {
      const x = chart.timeScale().timeToCoordinate(pt.time as Time);
      const y = mainSeries.priceToCoordinate(pt.price);
      const valid = x !== null && y !== null;
      return { x: x ?? 0, y: y ?? 0, valid };
    });
  }, []);

  const hitTestEndpoint = useCallback((x: number, y: number, drawing: Drawing): number | null => {
    const screenPoints = getScreenPoints(drawing);
    for (let i = 0; i < screenPoints.length; i++) {
      const pt = screenPoints[i];
      if (!pt.valid) continue;
      const dist = Math.sqrt((x - pt.x) ** 2 + (y - pt.y) ** 2);
      if (dist <= ENDPOINT_RADIUS + 4) {
        return i;
      }
    }
    return null;
  }, [getScreenPoints]);

  const hitTestBody = useCallback((x: number, y: number, drawing: Drawing): boolean => {
    const screenPoints = getScreenPoints(drawing);
    const canvas = drawingCanvasRef.current;
    if (!canvas || screenPoints.length === 0) return false;
    
    const validPoints = screenPoints.filter(p => p.valid);
    if (validPoints.length === 0) return false;
    
    if (drawing.type === 'hline' && validPoints.length >= 1) {
      return Math.abs(y - validPoints[0].y) < HIT_THRESHOLD;
    }
    
    if (drawing.type === 'fib' && validPoints.length >= 2) {
      const y1 = validPoints[0].y;
      const y2 = validPoints[1].y;
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      if (y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD) {
        return true;
      }
      return false;
    }
    
    if (validPoints.length >= 2) {
      const dx = validPoints[1].x - validPoints[0].x;
      const dy = validPoints[1].y - validPoints[0].y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return false;
      
      let t = ((x - validPoints[0].x) * dx + (y - validPoints[0].y) * dy) / lenSq;
      
      if (drawing.type === 'ray') {
        t = Math.max(0, t);
      } else {
        t = Math.max(0, Math.min(1, t));
      }
      
      const closestX = validPoints[0].x + t * dx;
      const closestY = validPoints[0].y + t * dy;
      const dist = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
      
      return dist < HIT_THRESHOLD;
    }
    
    return false;
  }, [getScreenPoints]);

  const renderDrawings = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    
    if (!canvas || !chart || !mainSeries) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    
    const timeScale = chart.timeScale();
    
    drawings.forEach((drawing) => {
      const isSelected = drawing.id === selectedDrawingId;
      const isHovered = drawing.id === hoverState.drawingId;
      const baseColor = drawing.style?.color || '#9AA4B2';
      
      ctx.strokeStyle = isSelected ? '#22D3EE' : (isHovered ? '#22D3EE' : baseColor);
      ctx.lineWidth = isSelected ? 2 : (isHovered ? 1.5 : (drawing.style?.lineWidth || 1));
      
      const screenPoints = drawing.points.map((pt) => {
        const x = timeScale.timeToCoordinate(pt.time as Time);
        const y = mainSeries.priceToCoordinate(pt.price);
        return { x: x ?? 0, y: y ?? 0 };
      }).filter(pt => pt.x !== null && pt.y !== null);
      
      if (screenPoints.length < 1) return;
      
      ctx.beginPath();
      
      switch (drawing.type) {
        case 'trendline':
          if (screenPoints.length >= 2) {
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
          }
          break;
          
        case 'hline':
          if (screenPoints.length >= 1) {
            ctx.moveTo(0, screenPoints[0].y);
            ctx.lineTo(canvas.offsetWidth, screenPoints[0].y);
          }
          break;
          
        case 'ray':
          if (screenPoints.length >= 2) {
            const dx = screenPoints[1].x - screenPoints[0].x;
            const dy = screenPoints[1].y - screenPoints[0].y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const extX = screenPoints[0].x + (dx / len) * 5000;
            const extY = screenPoints[0].y + (dy / len) * 5000;
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            ctx.lineTo(extX, extY);
          }
          break;
          
        case 'fib':
          if (screenPoints.length >= 2) {
            const y1 = screenPoints[0].y;
            const y2 = screenPoints[1].y;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            
            levels.forEach((level) => {
              const yLevel = y1 + (y2 - y1) * level;
              ctx.moveTo(0, yLevel);
              ctx.lineTo(canvas.offsetWidth, yLevel);
            });
            
            ctx.stroke();
            ctx.beginPath();
            
            ctx.fillStyle = isSelected ? '#22D3EE' : '#9AA4B2';
            ctx.font = '10px Inter';
            levels.forEach((level) => {
              const yLevel = y1 + (y2 - y1) * level;
              ctx.fillText(`${(level * 100).toFixed(1)}%`, 5, yLevel - 2);
            });
          }
          break;
      }
      
      ctx.stroke();
      
      if (isSelected) {
        ctx.fillStyle = '#22D3EE';
        screenPoints.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        });
        
        ctx.strokeStyle = '#0B0F14';
        ctx.lineWidth = 1;
        screenPoints.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, ENDPOINT_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    });
    
    if (drawingPoints.length > 0 && drawingTool !== 'none') {
      const screenPoints = drawingPoints.map((pt) => {
        const x = timeScale.timeToCoordinate(pt.time as Time);
        const y = mainSeries.priceToCoordinate(pt.price);
        return { x: x ?? 0, y: y ?? 0 };
      });
      
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      
      if (screenPoints.length >= 1) {
        ctx.beginPath();
        ctx.arc(screenPoints[0].x, screenPoints[0].y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#22D3EE';
        ctx.fill();
        
        if (previewPoint) {
          ctx.beginPath();
          ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
          ctx.lineTo(previewPoint.x, previewPoint.y);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(previewPoint.x, previewPoint.y, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      
      ctx.setLineDash([]);
    }
  }, [drawings, selectedDrawingId, drawingPoints, drawingTool, hoverState.drawingId, previewPoint]);

  useEffect(() => {
    renderDrawings();
    
    const chart = chartRef.current;
    if (chart) {
      chart.subscribeCrosshairMove(renderDrawings);
      chart.timeScale().subscribeVisibleTimeRangeChange(renderDrawings);
      
      return () => {
        chart.unsubscribeCrosshairMove(renderDrawings);
        chart.timeScale().unsubscribeVisibleTimeRangeChange(renderDrawings);
      };
    }
  }, [renderDrawings]);

  const getPointerCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const coordsToTimePrice = useCallback((x: number, y: number) => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries) return null;
    
    const timeRaw = chart.timeScale().coordinateToTime(x);
    const price = mainSeries.coordinateToPrice(y);
    
    if (timeRaw === null || price === null) return null;
    
    let time: number;
    if (typeof timeRaw === 'number') {
      time = timeRaw;
    } else if (typeof timeRaw === 'object' && 'year' in timeRaw) {
      const bd = timeRaw as { year: number; month: number; day: number };
      time = Math.floor(new Date(bd.year, bd.month - 1, bd.day).getTime() / 1000);
    } else {
      return null;
    }
    
    return { time, price: price as number };
  }, []);

  const disableChartInteraction = useCallback(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.applyOptions({
        handleScroll: false,
        handleScale: false,
      });
    }
  }, []);

  const enableChartInteraction = useCallback(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.applyOptions({
        handleScroll: { vertTouchDrag: false },
        handleScale: true,
      });
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const { x, y } = getPointerCoords(e);
    const coords = coordsToTimePrice(x, y);
    if (!coords) return;
    
    if (drawingTool !== 'none') {
      const newPoint = { time: coords.time, price: coords.price };
      const newPoints = [...drawingPoints, newPoint];
      
      const requiredPoints = drawingTool === 'hline' ? 1 : 2;
      
      if (newPoints.length >= requiredPoints) {
        const now = Date.now();
        const newId = `${drawingTool}-${now}`;
        const newDrawing: Drawing = {
          id: newId,
          type: drawingTool as Drawing['type'],
          points: newPoints,
          style: { color: '#9AA4B2', lineWidth: 1 },
          createdAt: now,
          updatedAt: now,
        };
        onDrawingsChange([...drawings, newDrawing]);
        setDrawingPoints([]);
        setPreviewPoint(null);
        onDrawingComplete();
        onDrawingSelect(newId);
      } else {
        setDrawingPoints(newPoints);
      }
      return;
    }
    
    if (selectedDrawingId) {
      const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
      if (selectedDrawing) {
        const endpointIdx = hitTestEndpoint(x, y, selectedDrawing);
        if (endpointIdx !== null) {
          e.preventDefault();
          e.stopPropagation();
          canvas.setPointerCapture(e.pointerId);
          disableChartInteraction();
          setDragState({
            active: true,
            drawingId: selectedDrawingId,
            type: 'resize',
            pointIndex: endpointIdx,
            startX: x,
            startY: y,
            originalPoints: [...selectedDrawing.points],
          });
          return;
        }
        
        if (hitTestBody(x, y, selectedDrawing)) {
          e.preventDefault();
          e.stopPropagation();
          canvas.setPointerCapture(e.pointerId);
          disableChartInteraction();
          setDragState({
            active: true,
            drawingId: selectedDrawingId,
            type: 'move',
            startX: x,
            startY: y,
            originalPoints: [...selectedDrawing.points],
          });
          return;
        }
      }
    }
    
    let clickedDrawing: string | null = null;
    for (const drawing of drawings) {
      const endpointIdx = hitTestEndpoint(x, y, drawing);
      if (endpointIdx !== null) {
        clickedDrawing = drawing.id;
        break;
      }
      if (hitTestBody(x, y, drawing)) {
        clickedDrawing = drawing.id;
        break;
      }
    }
    onDrawingSelect(clickedDrawing);
  }, [drawingTool, drawingPoints, drawings, onDrawingsChange, onDrawingComplete, onDrawingSelect, selectedDrawingId, hitTestEndpoint, hitTestBody, getPointerCoords, coordsToTimePrice, disableChartInteraction]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const { x, y } = getPointerCoords(e);
    
    if (dragState?.active) {
      const coords = coordsToTimePrice(x, y);
      if (!coords) return;
      
      let newPoints = [...dragState.originalPoints];
      
      if (dragState.type === 'resize' && dragState.pointIndex !== undefined) {
        newPoints[dragState.pointIndex] = { time: coords.time, price: coords.price };
      } else if (dragState.type === 'move') {
        const startCoords = coordsToTimePrice(dragState.startX, dragState.startY);
        if (!startCoords) return;
        
        const deltaTime = coords.time - startCoords.time;
        const deltaPrice = coords.price - startCoords.price;
        
        newPoints = dragState.originalPoints.map(pt => ({
          time: pt.time + deltaTime,
          price: pt.price + deltaPrice,
        }));
      }
      
      const updatedDrawings = drawings.map(d => 
        d.id === dragState.drawingId ? { ...d, points: newPoints, updatedAt: Date.now() } : d
      );
      onDrawingsChange(updatedDrawings);
      return;
    }
    
    if (drawingTool !== 'none') {
      if (drawingPoints.length > 0) {
        setPreviewPoint({ x, y });
        renderDrawings();
      }
      setHoverState({ drawingId: null, type: null });
      return;
    }
    
    setPreviewPoint(null);
    
    let newHover: HoverState = { drawingId: null, type: null };
    
    for (const drawing of drawings) {
      const endpointIdx = hitTestEndpoint(x, y, drawing);
      if (endpointIdx !== null) {
        newHover = { drawingId: drawing.id, type: 'endpoint', pointIndex: endpointIdx };
        break;
      }
      if (hitTestBody(x, y, drawing)) {
        newHover = { drawingId: drawing.id, type: 'body' };
        break;
      }
    }
    
    setHoverState(newHover);
  }, [dragState, drawings, onDrawingsChange, drawingTool, drawingPoints, hitTestEndpoint, hitTestBody, getPointerCoords, coordsToTimePrice, renderDrawings]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
    }
    
    if (dragState?.active) {
      enableChartInteraction();
      setDragState(null);
    } else {
      enableChartInteraction();
    }
  }, [dragState, enableChartInteraction]);

  const getCursor = useCallback(() => {
    if (drawingTool !== 'none') return 'crosshair';
    if (dragState?.active) {
      return dragState.type === 'resize' ? 'nwse-resize' : 'move';
    }
    if (hoverState.type === 'endpoint') return 'nwse-resize';
    if (hoverState.type === 'body') return 'move';
    return 'default';
  }, [drawingTool, dragState, hoverState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawingPoints([]);
        setPreviewPoint(null);
        onDrawingComplete();
        if (dragState?.active) {
          enableChartInteraction();
        }
        setDragState(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        onDrawingsChange(drawings.filter(d => d.id !== selectedDrawingId));
        onDrawingSelect(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDrawingId, drawings, onDrawingsChange, onDrawingSelect, onDrawingComplete, dragState, enableChartInteraction]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center" data-testid="chart-loading">
        <div className="text-center space-y-4">
          <Skeleton className="h-64 w-full" />
          <p className="text-muted-foreground text-sm">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error || !chartData?.length) {
    return (
      <div className="w-full h-full flex items-center justify-center" data-testid="chart-error">
        <div className="text-center space-y-2">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No data for timeframe.</p>
        </div>
      </div>
    );
  }

  const selectedDrawing = selectedDrawingId ? drawings.find(d => d.id === selectedDrawingId) : null;

  const isDrawingOrDragging = drawingTool !== 'none' || dragState?.active;

  return (
    <div className="relative w-full h-full" style={{ position: 'relative' }} data-testid="tv-chart">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full"
        style={{ 
          minHeight: '400px',
          pointerEvents: isDrawingOrDragging ? 'none' : 'auto',
        }}
      />
      <canvas
        ref={drawingCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          zIndex: 50,
          cursor: getCursor(),
          pointerEvents: isDrawingOrDragging || selectedDrawingId ? 'auto' : 'none',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      {selectedDrawing && drawingTool === 'none' && (
        <div 
          className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30"
          style={{ zIndex: 51 }}
          data-testid="selection-indicator"
        >
          Selected: {selectedDrawing.type}
        </div>
      )}
      {drawingTool !== 'none' && (
        <div 
          className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 rounded text-xs font-medium bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30"
          style={{ zIndex: 51 }}
          data-testid="drawing-mode-indicator"
        >
          <span>Drawing: {drawingTool}</span>
          <button
            onClick={onDrawingComplete}
            className="px-1.5 py-0.5 rounded bg-[#22D3EE]/30 hover:bg-[#22D3EE]/50 transition-colors"
            data-testid="button-exit-drawing"
          >
            Exit
          </button>
        </div>
      )}
    </div>
  );
}
