/**
 * AI Coaching Service - Trade Review and Portfolio Insights
 * Routes all AI calls through the AI Gateway for Iron Strike Doctrine compliance.
 */

import type { SelectTradeExecution } from "@shared/schema";
import { 
  generateCoachReview, 
  callAIGateway,
  type CoachReviewResponse,
  type ExplainResponse,
} from "./ai-gateway";

export interface TradeReview {
  setupQualityScore: number;
  riskScore: number;
  psychologicalBiases: string[];
  suggestedImprovements: string[];
  patternWarnings: string[];
  overallGrade: string;
  gradeColor: string;
  summary: string;
}

function calculatePnL(trade: SelectTradeExecution): number {
  if (!trade.profitLoss) return 0;
  return parseFloat(trade.profitLoss);
}

function formatTradeForAI(trade: SelectTradeExecution): string {
  const pnl = calculatePnL(trade);
  const outcome = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAKEVEN";
  
  return `
Trade Details:
- Symbol: ${trade.symbol}
- Action: ${trade.action}
- Option Type: ${trade.optionType || "N/A"}
- Strike Price: ${trade.strikePrice || "N/A"}
- Entry Premium: $${trade.entryPremium}
- Exit Premium: ${trade.exitPremium ? `$${trade.exitPremium}` : "Still Open"}
- Contracts: ${trade.contracts}
- P&L: ${pnl > 0 ? "+" : ""}$${pnl.toFixed(2)} (${outcome})
- Opened: ${trade.executedAt ? new Date(trade.executedAt).toLocaleDateString() : "N/A"}
- Closed: ${trade.closedAt ? new Date(trade.closedAt).toLocaleDateString() : "Still Open"}

Journal Notes:
- Strategy: ${trade.strategyTag || "Not specified"}
- Emotional State: ${trade.emotionalState || "Not recorded"}
- What Went Well: ${trade.whatWentWell || "Not recorded"}
- What Went Wrong: ${trade.whatWentWrong || "Not recorded"}
- Lessons Learned: ${trade.lessonLearned || "Not recorded"}
- Notes: ${trade.notes || "None"}

Risk Management:
- Planned Risk Per Trade: ${trade.plannedRiskPerTrade ? `$${trade.plannedRiskPerTrade}` : "Not set"}
- Planned Stop Price: ${trade.plannedStopPrice ? `$${trade.plannedStopPrice}` : "Not set"}
- Planned Take Profit: ${trade.plannedTakeProfitPrice ? `$${trade.plannedTakeProfitPrice}` : "Not set"}
`.trim();
}

const GRADE_COLOR_MAP: Record<string, string> = {
  "A+": "emerald",
  "A": "emerald",
  "B+": "blue",
  "B": "blue",
  "C+": "yellow",
  "C": "yellow",
  "D": "orange",
  "F": "red",
};

export async function generateTradeReview(trade: SelectTradeExecution): Promise<TradeReview> {
  const tradeContext = formatTradeForAI(trade);
  
  try {
    const result = await generateCoachReview(tradeContext);
    
    if (result.success) {
      const data = result.data;
      return {
        setupQualityScore: data.setup_score,
        riskScore: data.risk_score,
        psychologicalBiases: data.psychological_notes,
        suggestedImprovements: data.next_actions,
        patternWarnings: data.pattern_observations,
        overallGrade: data.grade,
        gradeColor: GRADE_COLOR_MAP[data.grade] || "gray",
        summary: data.summary,
      };
    }

    // Log validation errors if any
    if (result.validationErrors) {
      console.warn("[AI Coaching] Validation errors:", result.validationErrors);
    }
    if (result.forbiddenLanguage) {
      console.warn("[AI Coaching] Forbidden language detected:", result.forbiddenLanguage);
    }

    // Return default response from gateway result
    const data = result.data;
    return {
      setupQualityScore: data.setup_score,
      riskScore: data.risk_score,
      psychologicalBiases: data.psychological_notes,
      suggestedImprovements: data.next_actions,
      patternWarnings: data.pattern_observations,
      overallGrade: data.grade,
      gradeColor: GRADE_COLOR_MAP[data.grade] || "gray",
      summary: data.summary,
    };

  } catch (error) {
    console.error("[AI Coaching] Error generating trade review:", error);
    
    const pnl = calculatePnL(trade);
    const hasRiskManagement = trade.plannedRiskPerTrade || trade.plannedStopPrice;
    const hasJournal = trade.strategyTag || trade.emotionalState || trade.notes;
    
    let setupScore = 50;
    let riskScore = 50;
    
    if (pnl > 0) setupScore += 20;
    if (hasRiskManagement) riskScore += 30;
    if (hasJournal) setupScore += 10;
    
    return {
      setupQualityScore: Math.min(setupScore, 100),
      riskScore: Math.min(riskScore, 100),
      psychologicalBiases: [],
      suggestedImprovements: [
        "Add detailed journal notes to improve self-awareness",
        "Set stop-loss and take-profit levels before entering trades",
        "Record your emotional state to identify patterns",
      ],
      patternWarnings: [],
      overallGrade: pnl > 0 ? "B" : "C",
      gradeColor: pnl > 0 ? "blue" : "yellow",
      summary: "AI review temporarily unavailable. Basic analysis provided based on trade data.",
    };
  }
}

export async function generatePortfolioCoaching(
  trades: SelectTradeExecution[],
  metrics: { winRate: number; profitFactor: number; avgRMultiple: number }
): Promise<{
  strengths: string[];
  areasForImprovement: string[];
  weeklyFocus: string;
  mindsetTip: string;
}> {
  const closedTrades = trades.filter(t => t.closedAt !== null);
  
  if (closedTrades.length < 5) {
    return {
      strengths: ["Building trading experience"],
      areasForImprovement: ["Log more trades to receive personalized coaching"],
      weeklyFocus: "Focus on consistent journaling and risk management",
      mindsetTip: "Every trade is a learning opportunity. Stay curious and patient.",
    };
  }

  const emotionalBreakdown = new Map<string, number>();
  for (const trade of closedTrades) {
    if (trade.emotionalState) {
      emotionalBreakdown.set(
        trade.emotionalState,
        (emotionalBreakdown.get(trade.emotionalState) || 0) + 1
      );
    }
  }

  const context = `
Trading Statistics:
- Total Trades: ${closedTrades.length}
- Win Rate: ${metrics.winRate.toFixed(1)}%
- Profit Factor: ${metrics.profitFactor.toFixed(2)}
- Average R-Multiple: ${metrics.avgRMultiple.toFixed(2)}

Emotional State Distribution:
${Array.from(emotionalBreakdown.entries()).map(([state, count]) => `- ${state}: ${count} trades`).join("\n") || "No emotional data recorded"}
`;

  try {
    const result = await callAIGateway<ExplainResponse>({
      mode: "explain",
      userPrompt: "Based on this trading performance data, provide coaching advice with strengths, areas for improvement, a weekly focus, and a mindset tip.",
      contextData: context,
      temperature: 0.5,
      maxTokens: 800,
    });

    if (result.success) {
      // Parse the answer for structured coaching advice
      const answer = result.data.answer;
      const nextActions = result.data.next_actions;
      
      return {
        strengths: nextActions.slice(0, 2),
        areasForImprovement: [result.data.risk],
        weeklyFocus: nextActions[2] || "Focus on process over outcomes",
        mindsetTip: nextActions[3] || "Trust your system and stay disciplined.",
      };
    }

    throw new Error("AI Gateway returned unsuccessful response");

  } catch (error) {
    console.error("[AI Coaching] Error generating portfolio coaching:", error);
    
    const strengths: string[] = [];
    const improvements: string[] = [];
    
    if (metrics.winRate > 50) strengths.push("Above average win rate");
    else improvements.push("Work on entry timing to improve win rate");
    
    if (metrics.profitFactor > 1.5) strengths.push("Strong profit factor");
    else improvements.push("Let winners run longer or cut losses quicker");
    
    if (metrics.avgRMultiple > 1) strengths.push("Positive R-multiple average");
    else improvements.push("Focus on risk-reward ratio improvement");

    return {
      strengths: strengths.length > 0 ? strengths : ["Building trading experience"],
      areasForImprovement: improvements.length > 0 ? improvements : ["Continue learning and improving"],
      weeklyFocus: "Review your last 5 trades and identify one pattern",
      mindsetTip: "Progress, not perfection. Every trade teaches you something.",
    };
  }
}

export interface PortfolioInsights {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  behaviorPatterns: string[];
  overallGrade: string;
  gradeColor: string;
}

interface TradeData {
  symbol: string;
  action: string;
  pnl: number;
  pnlPercent: number;
  strategyTag?: string | null;
  emotionalState?: string | null;
  sessionTag?: string | null;
  whatWentWell?: string | null;
  whatWentWrong?: string | null;
  lessonLearned?: string | null;
}

interface PortfolioMetrics {
  winRate: number;
  profitFactor: number;
  totalPnL: number;
}

export async function generatePortfolioInsights(
  trades: TradeData[],
  metrics: PortfolioMetrics
): Promise<PortfolioInsights> {
  if (trades.length < 5) {
    return {
      summary: "Complete at least 5 trades to receive AI-powered insights.",
      strengths: [],
      weaknesses: [],
      recommendations: ["Log more trades to build a performance history"],
      behaviorPatterns: [],
      overallGrade: "N/A",
      gradeColor: "gray",
    };
  }

  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  
  const emotionBreakdown: Record<string, { count: number; wins: number }> = {};
  const strategyBreakdown: Record<string, { count: number; totalPnl: number }> = {};
  const sessionBreakdown: Record<string, number> = {};
  
  for (const trade of trades) {
    if (trade.emotionalState) {
      if (!emotionBreakdown[trade.emotionalState]) {
        emotionBreakdown[trade.emotionalState] = { count: 0, wins: 0 };
      }
      emotionBreakdown[trade.emotionalState].count++;
      if (trade.pnl > 0) emotionBreakdown[trade.emotionalState].wins++;
    }
    
    if (trade.strategyTag) {
      if (!strategyBreakdown[trade.strategyTag]) {
        strategyBreakdown[trade.strategyTag] = { count: 0, totalPnl: 0 };
      }
      strategyBreakdown[trade.strategyTag].count++;
      strategyBreakdown[trade.strategyTag].totalPnl += trade.pnl;
    }
    
    if (trade.sessionTag) {
      sessionBreakdown[trade.sessionTag] = (sessionBreakdown[trade.sessionTag] || 0) + 1;
    }
  }

  const context = `
Portfolio Performance Summary:
- Total Trades Analyzed: ${trades.length}
- Win Rate: ${metrics.winRate.toFixed(1)}%
- Profit Factor: ${metrics.profitFactor.toFixed(2)}
- Total P&L: $${metrics.totalPnL.toFixed(2)}
- Wins: ${wins.length}, Losses: ${losses.length}
- Average Win: $${wins.length > 0 ? (wins.reduce((s, t) => s + t.pnl, 0) / wins.length).toFixed(2) : "0"}
- Average Loss: $${losses.length > 0 ? (losses.reduce((s, t) => s + t.pnl, 0) / losses.length).toFixed(2) : "0"}

Emotional State Analysis:
${Object.entries(emotionBreakdown).map(([state, data]) => 
  `- ${state}: ${data.count} trades, ${((data.wins / data.count) * 100).toFixed(0)}% win rate`
).join("\n") || "- No emotional data recorded"}

Strategy Performance:
${Object.entries(strategyBreakdown).map(([strategy, data]) => 
  `- ${strategy}: ${data.count} trades, $${data.totalPnl.toFixed(2)} total P&L`
).join("\n") || "- No strategy tags recorded"}

Trading Session Distribution:
${Object.entries(sessionBreakdown).map(([session, count]) => 
  `- ${session}: ${count} trades`
).join("\n") || "- No session data recorded"}

Recent Journal Insights:
${trades.slice(0, 5).map(t => {
  const notes = [
    t.whatWentWell ? `Well: ${t.whatWentWell}` : null,
    t.whatWentWrong ? `Wrong: ${t.whatWentWrong}` : null,
    t.lessonLearned ? `Lesson: ${t.lessonLearned}` : null,
  ].filter(Boolean).join("; ");
  return notes ? `- ${t.symbol} (${t.pnl > 0 ? "WIN" : "LOSS"}): ${notes}` : null;
}).filter(Boolean).join("\n") || "- No journal entries available"}
`;

  try {
    const result = await generateCoachReview(context);
    
    if (result.success) {
      const data = result.data;
      
      // Map coach_review response to portfolio insights format
      const strengths: string[] = [];
      const weaknesses: string[] = [];
      
      if (metrics.winRate > 50) strengths.push("Above average win rate");
      if (metrics.profitFactor > 1.5) strengths.push("Strong profit factor");
      if (data.setup_score > 70) strengths.push("Quality trade setups");
      
      if (metrics.winRate < 50) weaknesses.push("Win rate below 50%");
      if (metrics.profitFactor < 1) weaknesses.push("Losses outweigh gains");
      if (data.risk_score < 50) weaknesses.push("Risk management needs attention");

      return {
        summary: data.summary,
        strengths: strengths.length > 0 ? strengths : ["Consistent trading activity"],
        weaknesses: weaknesses.length > 0 ? weaknesses : ["Continue building your edge"],
        recommendations: data.next_actions,
        behaviorPatterns: data.psychological_notes,
        overallGrade: data.grade,
        gradeColor: GRADE_COLOR_MAP[data.grade] || "gray",
      };
    }

    throw new Error("AI Gateway returned unsuccessful response");

  } catch (error) {
    console.error("[AI Coaching] Error generating portfolio insights:", error);
    
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];
    
    if (metrics.winRate > 50) {
      strengths.push("Above average win rate");
    } else {
      weaknesses.push("Win rate below 50%");
      recommendations.push("Review entry criteria and timing");
    }
    
    if (metrics.profitFactor > 1.5) {
      strengths.push("Strong profit factor indicates good risk management");
    } else if (metrics.profitFactor < 1) {
      weaknesses.push("Profit factor below 1 indicates losses outweigh gains");
      recommendations.push("Consider tighter stop losses or larger profit targets");
    }
    
    if (Object.keys(emotionBreakdown).length > 0) {
      const negativeEmotions = ["anxious", "fearful", "greedy", "revenge", "fomo"];
      const hasNegative = negativeEmotions.some(e => emotionBreakdown[e]?.count > 0);
      if (hasNegative) {
        weaknesses.push("Trading while experiencing negative emotions");
        recommendations.push("Consider taking breaks when feeling anxious or FOMO");
      }
    }
    
    let grade = "C";
    if (metrics.winRate > 60 && metrics.profitFactor > 1.5) grade = "A";
    else if (metrics.winRate > 50 && metrics.profitFactor > 1.2) grade = "B";
    else if (metrics.winRate < 40 || metrics.profitFactor < 0.8) grade = "D";

    return {
      summary: `Based on ${trades.length} trades with a ${metrics.winRate.toFixed(1)}% win rate and ${metrics.profitFactor.toFixed(2)} profit factor.`,
      strengths: strengths.length > 0 ? strengths : ["Consistent trading activity"],
      weaknesses: weaknesses.length > 0 ? weaknesses : ["Continue building your edge"],
      recommendations: recommendations.length > 0 ? recommendations : ["Keep journaling trades to identify patterns"],
      behaviorPatterns: [],
      overallGrade: grade,
      gradeColor: grade === "A" || grade === "A+" ? "emerald" : grade === "B" || grade === "B+" ? "blue" : grade === "D" || grade === "F" ? "orange" : "yellow",
    };
  }
}

// Chart Coaching Types
export interface ChartCoachingMarker {
  id: string;
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  severity: 'good' | 'warn' | 'risk';
  title: string;
  detail?: string;
}

export interface ChartCoachingRiskBox {
  entry: number;
  stop: number;
  target: number;
  startTime: number;
  endTime: number;
}

export interface ChartCoachingGrade {
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

export interface ChartCoachingResponse {
  markers: ChartCoachingMarker[];
  riskBox?: ChartCoachingRiskBox;
  grade?: ChartCoachingGrade;
  mistakeMap?: MistakeMapItem[];
  drillScenarios?: DrillScenario[];
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Generate chart coaching analysis using AI
 */
export async function generateChartCoaching(
  symbol: string,
  candles: CandleData[],
  userTier: 'free' | 'pro' | 'premium' = 'pro'
): Promise<ChartCoachingResponse> {
  if (candles.length === 0) {
    return { markers: [] };
  }

  const recentCandles = candles.slice(-60);
  
  // Calculate basic technical levels
  let minLow = Infinity;
  let maxHigh = -Infinity;
  let minIdx = 0;
  let maxIdx = 0;
  
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

  const latest = recentCandles[recentCandles.length - 1];
  const first = recentCandles[0];
  const trend = latest.close > first.close ? 'bullish' : 'bearish';
  const priceChange = ((latest.close - first.close) / first.close) * 100;

  // Calculate SMA for trend confirmation
  const sma20 = recentCandles.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
  const trendStrength = latest.close > sma20 ? 'strong' : 'weak';

  try {
    // Try to use AI gateway for enhanced analysis
    const prompt = `Analyze this ${symbol} price action:
- Current price: $${latest.close.toFixed(2)}
- Recent trend: ${trend} (${priceChange.toFixed(1)}% change)
- Support level: $${minLow.toFixed(2)}
- Resistance level: $${maxHigh.toFixed(2)}
- Price vs 20-SMA: ${trendStrength}

Provide a brief technical analysis focusing on:
1. Key support/resistance levels
2. Trend direction and strength
3. Risk/reward for potential trades`;

    const response = await callAIGateway<ExplainResponse>({
      mode: 'explain',
      userPrompt: prompt,
      temperature: 0.3,
      maxTokens: 500,
    });
    
    // Extract AI analysis text from response
    const aiInsight = response.data?.answer?.slice(0, 100) || '';
    
    // Build markers based on technical analysis
    const markers: ChartCoachingMarker[] = [];
    
    // Support marker
    markers.push({
      id: 'support-zone',
      time: recentCandles[minIdx].time,
      position: 'belowBar',
      severity: 'good',
      title: 'Support',
      detail: `Key support at $${minLow.toFixed(2)}. ${aiInsight || 'Watch for buying pressure.'}`,
    });

    // Resistance marker
    markers.push({
      id: 'resistance-zone',
      time: recentCandles[maxIdx].time,
      position: 'aboveBar',
      severity: 'warn',
      title: 'Resistance',
      detail: `Resistance at $${maxHigh.toFixed(2)}. Expect potential selling pressure.`,
    });

    // Trend marker
    markers.push({
      id: 'trend-analysis',
      time: latest.time,
      position: trend === 'bullish' ? 'belowBar' : 'aboveBar',
      severity: trend === 'bullish' ? 'good' : 'risk',
      title: trend === 'bullish' ? 'Uptrend' : 'Downtrend',
      detail: `Price ${trend === 'bullish' ? 'rising' : 'falling'} ${Math.abs(priceChange).toFixed(1)}% over period.`,
    });

    // Pro tier gets risk box
    let riskBox: ChartCoachingRiskBox | undefined;
    if (userTier === 'pro' || userTier === 'premium') {
      riskBox = {
        entry: latest.close,
        stop: trend === 'bullish' ? minLow : maxHigh,
        target: trend === 'bullish' 
          ? latest.close + (latest.close - minLow) * 1.5 
          : latest.close - (maxHigh - latest.close) * 1.5,
        startTime: recentCandles[Math.max(0, recentCandles.length - 10)].time,
        endTime: latest.time,
      };
    }

    // Pro tier gets grade
    let grade: ChartCoachingGrade | undefined;
    if (userTier === 'pro' || userTier === 'premium') {
      const trendScore = Math.abs(priceChange) > 5 ? 8 : 6;
      const entryScore = latest.close > sma20 === (trend === 'bullish') ? 8 : 5;
      const rrRatio = Math.abs(riskBox!.target - riskBox!.entry) / Math.abs(riskBox!.stop - riskBox!.entry);
      const rrScore = rrRatio >= 2 ? 9 : rrRatio >= 1.5 ? 7 : 5;
      
      const totalScore = trendScore + entryScore + rrScore;
      const gradeLetter: ChartCoachingGrade['gradeLetter'] = 
        totalScore >= 24 ? 'A' : 
        totalScore >= 20 ? 'B' : 
        totalScore >= 15 ? 'C' : 
        totalScore >= 10 ? 'D' : 'F';

      grade = {
        gradeLetter,
        rubric: [
          { category: 'Trend Alignment', score: trendScore, maxScore: 10, comment: `${trend} trend ${trendStrength}` },
          { category: 'Entry Timing', score: entryScore, maxScore: 10, comment: `Price ${latest.close > sma20 ? 'above' : 'below'} 20-SMA` },
          { category: 'R:R Ratio', score: rrScore, maxScore: 10, comment: `${rrRatio.toFixed(1)}:1 risk/reward` },
        ],
      };
    }

    // Elite tier gets Mistake Map and Drill Mode
    let mistakeMap: MistakeMapItem[] | undefined;
    let drillScenarios: DrillScenario[] | undefined;
    
    if (userTier === 'premium') {
      // Generate Mistake Map - analyze potential trading errors
      mistakeMap = [];
      
      // Check for potential entry timing issues
      const volatility = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;
      if (volatility > (maxHigh - minLow) * 0.1) {
        const highVolIdx = recentCandles.findIndex(c => (c.high - c.low) > volatility * 1.5);
        if (highVolIdx > 0) {
          mistakeMap.push({
            id: 'mistake-volatility-entry',
            time: recentCandles[highVolIdx].time,
            type: 'entry_timing',
            title: 'High Volatility Entry Risk',
            description: 'Entering during high volatility periods increases risk of whipsaw.',
            lesson: 'Wait for volatility to contract before entering positions.',
            severity: 'major',
          });
        }
      }
      
      // Check for potential stop placement issues
      if (trend === 'bullish' && latest.close - minLow < volatility * 2) {
        mistakeMap.push({
          id: 'mistake-tight-stop',
          time: latest.time,
          type: 'stop_placement',
          title: 'Stop Too Tight',
          description: 'Stop loss placement may be too close to current price given volatility.',
          lesson: 'Place stops beyond normal volatility range to avoid premature exit.',
          severity: 'minor',
        });
      }
      
      // Generate Drill Scenarios - practice setups
      drillScenarios = [
        {
          id: 'drill-trend-continuation',
          title: 'Trend Continuation Setup',
          description: `${symbol} is showing a ${trend} trend with price ${trendStrength} relative to the 20-SMA.`,
          setup: {
            entryPrice: latest.close,
            stopPrice: trend === 'bullish' ? minLow : maxHigh,
            targetPrice: trend === 'bullish' 
              ? latest.close + (latest.close - minLow) * 2 
              : latest.close - (maxHigh - latest.close) * 2,
            direction: trend === 'bullish' ? 'long' : 'short',
          },
          correctAnswer: trendStrength === 'strong' ? 'take_trade' : 'wait_for_confirmation',
          explanation: trendStrength === 'strong' 
            ? 'Strong trend alignment with price above SMA supports entry.'
            : 'Weak trend requires confirmation before commitment.',
        },
        {
          id: 'drill-reversal-assessment',
          title: 'Reversal Risk Assessment',
          description: `Price approaching ${trend === 'bullish' ? 'resistance' : 'support'} at $${trend === 'bullish' ? maxHigh.toFixed(2) : minLow.toFixed(2)}.`,
          setup: {
            entryPrice: trend === 'bullish' ? maxHigh : minLow,
            stopPrice: trend === 'bullish' ? latest.close : latest.close,
            targetPrice: trend === 'bullish' ? maxHigh * 1.05 : minLow * 0.95,
            direction: trend === 'bullish' ? 'long' : 'short',
          },
          correctAnswer: 'skip_trade',
          explanation: 'Entering at key resistance/support levels carries high reversal risk.',
        },
      ];
    }

    return { markers, riskBox, grade, mistakeMap, drillScenarios };

  } catch (error) {
    console.error("[Chart Coaching] AI error, using fallback:", error);
    
    // Fallback to basic technical analysis
    const markers: ChartCoachingMarker[] = [
      {
        id: 'support-zone',
        time: recentCandles[minIdx].time,
        position: 'belowBar',
        severity: 'good',
        title: 'Support',
        detail: `Key support zone at $${minLow.toFixed(2)}`,
      },
      {
        id: 'resistance-zone',
        time: recentCandles[maxIdx].time,
        position: 'aboveBar',
        severity: 'warn',
        title: 'Resistance',
        detail: `Resistance level at $${maxHigh.toFixed(2)}`,
      },
      {
        id: 'trend-analysis',
        time: latest.time,
        position: trend === 'bullish' ? 'belowBar' : 'aboveBar',
        severity: trend === 'bullish' ? 'good' : 'risk',
        title: trend === 'bullish' ? 'Uptrend' : 'Downtrend',
        detail: `Price ${trend === 'bullish' ? 'rising' : 'falling'} ${Math.abs(priceChange).toFixed(1)}% over period`,
      },
    ];

    let riskBox: ChartCoachingRiskBox | undefined;
    let grade: ChartCoachingGrade | undefined;

    if (userTier === 'pro' || userTier === 'premium') {
      riskBox = {
        entry: latest.close,
        stop: trend === 'bullish' ? minLow : maxHigh,
        target: trend === 'bullish' 
          ? latest.close + (latest.close - minLow) * 1.5 
          : latest.close - (maxHigh - latest.close) * 1.5,
        startTime: recentCandles[Math.max(0, recentCandles.length - 10)].time,
        endTime: latest.time,
      };

      grade = {
        gradeLetter: 'B',
        rubric: [
          { category: 'Trend Alignment', score: 7, maxScore: 10 },
          { category: 'Entry Timing', score: 7, maxScore: 10 },
          { category: 'R:R Ratio', score: 7, maxScore: 10 },
        ],
      };
    }

    return { markers, riskBox, grade };
  }
}
