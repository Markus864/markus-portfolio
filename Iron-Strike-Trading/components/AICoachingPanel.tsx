import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Lightbulb, AlertTriangle, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SelectTradeExecution } from "@shared/schema";

interface TradeReview {
  setupQualityScore: number;
  riskScore: number;
  psychologicalBiases: string[];
  suggestedImprovements: string[];
  patternWarnings: string[];
  overallGrade: string;
  gradeColor: string;
  summary: string;
}

interface AICoachingPanelProps {
  trade: SelectTradeExecution;
}

const gradeColorClasses: Record<string, string> = {
  emerald: "text-green-500",
  blue: "text-blue-400",
  yellow: "text-amber-400",
  orange: "text-amber-400",
  red: "text-red-400",
  gray: "text-muted-foreground",
};

export function AICoachingPanel({ trade }: AICoachingPanelProps) {
  const [review, setReview] = useState<TradeReview | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/trade-review", { tradeId: trade.id });
      return response.json();
    },
    onSuccess: (data) => {
      setReview(data);
    },
  });

  if (!review && !mutation.isPending) {
    return (
      <Card data-testid="panel-ai-coaching">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Brain className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trade Coach</CardTitle>
              <CardDescription className="text-xs">Get personalized feedback on this trade</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full gap-2"
            data-testid="button-generate-review"
          >
            <Sparkles className="h-4 w-4" />
            Generate AI Review
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mutation.isPending) {
    return (
      <Card data-testid="panel-ai-coaching">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Brain className="h-4 w-4 text-foreground animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trade Coach</CardTitle>
              <CardDescription className="text-xs">Analyzing your trade...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (mutation.isError) {
    return (
      <Card data-testid="panel-ai-coaching">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trade Coach</CardTitle>
              <CardDescription className="text-xs text-red-400">Failed to generate review</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => mutation.mutate()}
            variant="outline"
            className="w-full gap-2"
            data-testid="button-retry-review"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!review) return null;

  return (
    <Card data-testid="panel-ai-coaching">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <Brain className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">AI Trade Coach</CardTitle>
              <CardDescription className="text-xs">Personalized trade analysis</CardDescription>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-lg font-bold ${gradeColorClasses[review.gradeColor] || gradeColorClasses.gray}`}
            data-testid="badge-grade"
          >
            {review.overallGrade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground" data-testid="text-summary">{review.summary}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Setup Quality</span>
              <span className="font-mono font-medium">{review.setupQualityScore}%</span>
            </div>
            <Progress value={review.setupQualityScore} className="h-2" data-testid="progress-setup" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Risk Management</span>
              <span className="font-mono font-medium">{review.riskScore}%</span>
            </div>
            <Progress value={review.riskScore} className="h-2" data-testid="progress-risk" />
          </div>
        </div>

        {review.psychologicalBiases.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Psychological Biases Detected</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {review.psychologicalBiases.map((bias, i) => (
                <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-bias-${i}`}>
                  {bias}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {review.suggestedImprovements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="h-4 w-4 text-blue-400" />
              <span>Suggestions for Improvement</span>
            </div>
            <ul className="space-y-1">
              {review.suggestedImprovements.map((suggestion, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2" data-testid={`text-suggestion-${i}`}>
                  <span className="text-foreground mt-1">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {review.patternWarnings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <span>Pattern Warnings</span>
            </div>
            <ul className="space-y-1">
              {review.patternWarnings.map((warning, i) => (
                <li key={i} className="text-sm text-amber-400 flex items-start gap-2" data-testid={`text-warning-${i}`}>
                  <AlertTriangle className="h-3 w-3 mt-0.5" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={() => mutation.mutate()}
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          data-testid="button-regenerate-review"
        >
          <RefreshCw className="h-4 w-4" />
          Regenerate Review
        </Button>
      </CardContent>
    </Card>
  );
}
