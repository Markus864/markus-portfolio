import type { Time, SeriesMarker } from 'lightweight-charts';
import type { TVChartApi } from './TVChart';

export type CoachMarkerSeverity = 'good' | 'warn' | 'risk';
export type CoachMarkerPosition = 'aboveBar' | 'belowBar' | 'inBar';

export interface CoachMarker {
  id: string;
  time: number;
  position: CoachMarkerPosition;
  severity: CoachMarkerSeverity;
  title: string;
  detail?: string;
}

export interface RiskBox {
  entry: number;
  stop: number;
  target: number;
  startTime: number;
  endTime: number;
}

export interface TradeGrade {
  gradeLetter: 'A' | 'B' | 'C' | 'D' | 'F';
  rubric: {
    category: string;
    score: number;
    maxScore: number;
    comment?: string;
  }[];
}

export interface MistakeMapItem {
  id: string;
  time: number;
  type: 'entry_timing' | 'stop_placement' | 'target_miss' | 'overtrading' | 'sizing';
  title: string;
  description: string;
  lesson: string;
  severity: 'minor' | 'major' | 'critical';
}

export interface DrillScenario {
  id: string;
  title: string;
  description: string;
  setup: {
    entryPrice: number;
    stopPrice: number;
    targetPrice: number;
    direction: 'long' | 'short';
  };
  correctAnswer: 'take_trade' | 'skip_trade' | 'wait_for_confirmation';
  explanation: string;
}

export interface CoachingResponse {
  markers: CoachMarker[];
  riskBox?: RiskBox;
  grade?: TradeGrade;
  mistakeMap?: MistakeMapItem[];
  drillScenarios?: DrillScenario[];
}

const SEVERITY_COLORS: Record<CoachMarkerSeverity, string> = {
  good: '#22c55e',
  warn: '#f59e0b',
  risk: '#ef4444',
};

const SEVERITY_SHAPES: Record<CoachMarkerSeverity, 'circle' | 'arrowUp' | 'arrowDown'> = {
  good: 'arrowUp',
  warn: 'circle',
  risk: 'arrowDown',
};

export function convertToChartMarkers(markers: CoachMarker[]): SeriesMarker<Time>[] {
  return markers.map(m => ({
    time: m.time as Time,
    position: m.position,
    color: SEVERITY_COLORS[m.severity],
    shape: SEVERITY_SHAPES[m.severity],
    text: m.title,
    id: m.id,
  }));
}

export function applyCoachMarkers(api: TVChartApi, markers: CoachMarker[]): void {
  const chartMarkers = convertToChartMarkers(markers);
  api.setMarkers(chartMarkers);
}

export function clearCoachMarkers(api: TVChartApi): void {
  api.clearMarkers();
}

export function generateMockCoachingResponse(candles: { time: number; open: number; high: number; low: number; close: number }[]): CoachingResponse {
  if (!candles.length) {
    return { markers: [] };
  }

  const markers: CoachMarker[] = [];
  const recentCandles = candles.slice(-30);
  
  let minIdx = 0;
  let maxIdx = 0;
  let minLow = Infinity;
  let maxHigh = -Infinity;
  
  recentCandles.forEach((c, i) => {
    if (c.low < minLow) {
      minLow = c.low;
      minIdx = i;
    }
    if (c.high > maxHigh) {
      maxHigh = c.high;
      maxIdx = i;
    }
  });

  markers.push({
    id: 'support-zone',
    time: recentCandles[minIdx].time,
    position: 'belowBar',
    severity: 'good',
    title: 'Support',
    detail: `Key support zone at $${minLow.toFixed(2)}. Watch for buying pressure.`,
  });

  markers.push({
    id: 'resistance-zone',
    time: recentCandles[maxIdx].time,
    position: 'aboveBar',
    severity: 'warn',
    title: 'Resistance',
    detail: `Resistance level at $${maxHigh.toFixed(2)}. Expect potential selling.`,
  });

  const latest = recentCandles[recentCandles.length - 1];
  const trend = latest.close > recentCandles[0].close ? 'bullish' : 'bearish';
  
  markers.push({
    id: 'trend-analysis',
    time: latest.time,
    position: trend === 'bullish' ? 'belowBar' : 'aboveBar',
    severity: trend === 'bullish' ? 'good' : 'risk',
    title: trend === 'bullish' ? 'Uptrend' : 'Downtrend',
    detail: `Price ${trend === 'bullish' ? 'rising' : 'falling'} over recent period.`,
  });

  const riskBox: RiskBox = {
    entry: latest.close,
    stop: trend === 'bullish' ? minLow : maxHigh,
    target: trend === 'bullish' ? latest.close + (latest.close - minLow) * 1.5 : latest.close - (maxHigh - latest.close) * 1.5,
    startTime: recentCandles[Math.max(0, recentCandles.length - 10)].time,
    endTime: latest.time,
  };

  const grade: TradeGrade = {
    gradeLetter: 'B',
    rubric: [
      { category: 'Trend Alignment', score: 8, maxScore: 10, comment: 'Following the trend' },
      { category: 'Entry Timing', score: 7, maxScore: 10, comment: 'Reasonable entry zone' },
      { category: 'R:R Ratio', score: 8, maxScore: 10, comment: '1.5:1 risk/reward' },
      { category: 'Stop Placement', score: 6, maxScore: 10, comment: 'Near support/resistance' },
    ],
  };

  return { markers, riskBox, grade };
}

export function parseCoachingResponse(response: unknown): CoachingResponse | null {
  try {
    if (!response || typeof response !== 'object') return null;
    
    const res = response as Record<string, unknown>;
    const markers: CoachMarker[] = [];
    
    if (Array.isArray(res.markers)) {
      for (const m of res.markers) {
        if (m && typeof m === 'object' && 'time' in m && 'title' in m) {
          markers.push({
            id: String(m.id || `marker-${Date.now()}-${Math.random()}`),
            time: Number(m.time),
            position: (m.position as CoachMarkerPosition) || 'aboveBar',
            severity: (m.severity as CoachMarkerSeverity) || 'warn',
            title: String(m.title),
            detail: m.detail ? String(m.detail) : undefined,
          });
        }
      }
    }

    let riskBox: RiskBox | undefined;
    if (res.riskBox && typeof res.riskBox === 'object') {
      const rb = res.riskBox as Record<string, unknown>;
      if ('entry' in rb && 'stop' in rb && 'target' in rb) {
        riskBox = {
          entry: Number(rb.entry),
          stop: Number(rb.stop),
          target: Number(rb.target),
          startTime: Number(rb.startTime || 0),
          endTime: Number(rb.endTime || 0),
        };
      }
    }

    let grade: TradeGrade | undefined;
    if (res.grade && typeof res.grade === 'object') {
      const g = res.grade as Record<string, unknown>;
      if ('gradeLetter' in g) {
        grade = {
          gradeLetter: String(g.gradeLetter) as TradeGrade['gradeLetter'],
          rubric: Array.isArray(g.rubric) ? g.rubric.map((r: Record<string, unknown>) => ({
            category: String(r.category || ''),
            score: Number(r.score || 0),
            maxScore: Number(r.maxScore || 10),
            comment: r.comment ? String(r.comment) : undefined,
          })) : [],
        };
      }
    }

    // Parse Elite-only features
    let mistakeMap: MistakeMapItem[] | undefined;
    if (Array.isArray(res.mistakeMap)) {
      mistakeMap = res.mistakeMap.map((m: any) => ({
        id: String(m.id || `mistake-${Date.now()}-${Math.random()}`),
        time: Number(m.time),
        type: m.type || 'entry_timing',
        title: String(m.title || ''),
        description: String(m.description || ''),
        lesson: String(m.lesson || ''),
        severity: m.severity || 'minor',
      }));
    }

    let drillScenarios: DrillScenario[] | undefined;
    if (Array.isArray(res.drillScenarios)) {
      drillScenarios = res.drillScenarios.map((d: any) => ({
        id: String(d.id || `drill-${Date.now()}-${Math.random()}`),
        title: String(d.title || ''),
        description: String(d.description || ''),
        setup: {
          entryPrice: Number(d.setup?.entryPrice || 0),
          stopPrice: Number(d.setup?.stopPrice || 0),
          targetPrice: Number(d.setup?.targetPrice || 0),
          direction: d.setup?.direction || 'long',
        },
        correctAnswer: d.correctAnswer || 'wait_for_confirmation',
        explanation: String(d.explanation || ''),
      }));
    }

    return { markers, riskBox, grade, mistakeMap, drillScenarios };
  } catch {
    return null;
  }
}
