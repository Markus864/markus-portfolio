import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Image, 
  Upload, 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Target,
  Shield,
  Zap,
  BarChart3,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ChartAnalysisResult {
  symbol?: string;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
  patterns: string[];
  supportLevels: number[];
  resistanceLevels: number[];
  recommendation: {
    action: "BUY_CALL" | "BUY_PUT" | "SELL_CALL" | "SELL_PUT" | "HOLD";
    reasoning: string;
    entryZone?: { min: number; max: number };
    stopLoss?: number;
    targets?: number[];
  };
  technicalIndicators: {
    name: string;
    value: string;
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  }[];
  summary: string;
}

export default function ChartAnalysis() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [analysisResult, setAnalysisResult] = useState<ChartAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: async ({ chartImage, context }: { chartImage: string; context: string }) => {
      const response = await apiRequest("POST", "/api/analyze-chart", {
        chartImage,
        context,
      });
      if (!response.ok) throw new Error("Analysis failed");
      return response.json();
    },
    onSuccess: (data: ChartAnalysisResult) => {
      setAnalysisResult(data);
      toast({ title: "Chart analysis complete" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Analysis failed", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Please select an image file", variant: "destructive" });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Image must be less than 10MB", variant: "destructive" });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setAnalysisResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setAnalysisResult(null);
    }
  };

  const handleAnalyze = () => {
    if (!imagePreview) return;
    analyzeMutation.mutate({ 
      chartImage: imagePreview, 
      context: additionalContext 
    });
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getTrendIcon = (trend: ChartAnalysisResult["trend"]) => {
    switch (trend) {
      case "BULLISH": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "BEARISH": return <TrendingDown className="h-5 w-5 text-red-400" />;
      default: return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    }
  };

  const getTrendColor = (trend: ChartAnalysisResult["trend"]) => {
    switch (trend) {
      case "BULLISH": return "text-green-500";
      case "BEARISH": return "text-red-400";
      default: return "text-amber-400";
    }
  };

  const getActionBadge = (action: ChartAnalysisResult["recommendation"]["action"]) => {
    const variants: Record<string, { className: string }> = {
      BUY_CALL: { className: "text-green-500" },
      BUY_PUT: { className: "text-red-400" },
      SELL_CALL: { className: "text-orange-400" },
      SELL_PUT: { className: "text-blue-400" },
      HOLD: { className: "text-muted-foreground" },
    };
    const v = variants[action];
    return (
      <Badge variant="secondary" className={`${v.className} text-sm font-semibold`}>
        {action.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 space-y-6" data-testid="chart-analysis-page">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-lg">
          <Image className="h-6 w-6 text-foreground" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Chart Analysis</h1>
          <p className="text-muted-foreground">Upload a chart screenshot for AI-powered technical analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Chart</CardTitle>
              <CardDescription>
                Drag and drop or click to upload a chart screenshot
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-chart-file"
              />
              
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Chart preview" 
                    className="w-full rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={clearImage}
                    data-testid="button-clear-image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-foreground/50 transition-colors"
                  data-testid="dropzone-chart"
                >
                  <Upload className="h-12 w-12 text-foreground mx-auto mb-4" />
                  <p className="text-foreground font-medium mb-1">Drop your chart here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-2">PNG, JPG up to 10MB</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Additional Context (optional)</Label>
                <Textarea
                  placeholder="Add any relevant information like your trading strategy, timeframe preferences, or specific questions..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={3}
                  data-testid="input-context"
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleAnalyze}
                disabled={!selectedImage || analyzeMutation.isPending}
                data-testid="button-analyze"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Chart...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Analyze Chart
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {analyzeMutation.isPending && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Analyzing your chart...</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments</p>
                  </div>
                </div>
                <Progress value={65} className="h-2" />
              </CardContent>
            </Card>
          )}

          {analysisResult && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {getTrendIcon(analysisResult.trend)}
                      Market Trend
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${getTrendColor(analysisResult.trend)}`}>
                        {analysisResult.trend}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">Confidence</span>
                        <span className="font-mono font-semibold">{analysisResult.confidence}%</span>
                      </div>
                      <Progress value={analysisResult.confidence} className="h-2" />
                    </div>
                    <p className="text-muted-foreground">{analysisResult.summary}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="h-5 w-5 text-foreground" />
                    Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    {getActionBadge(analysisResult.recommendation.action)}
                  </div>
                  <p className="text-muted-foreground">{analysisResult.recommendation.reasoning}</p>
                  
                  {analysisResult.recommendation.entryZone && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase">Entry Zone</div>
                        <div className="font-mono font-semibold text-green-500">
                          ${analysisResult.recommendation.entryZone.min.toFixed(2)} - ${analysisResult.recommendation.entryZone.max.toFixed(2)}
                        </div>
                      </div>
                      {analysisResult.recommendation.stopLoss && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase">Stop Loss</div>
                          <div className="font-mono font-semibold text-red-400">
                            ${analysisResult.recommendation.stopLoss.toFixed(2)}
                          </div>
                        </div>
                      )}
                      {analysisResult.recommendation.targets && (
                        <div>
                          <div className="text-xs text-muted-foreground uppercase">Targets</div>
                          <div className="font-mono font-semibold text-green-500">
                            {analysisResult.recommendation.targets.map(t => `$${t.toFixed(2)}`).join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {analysisResult.patterns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-foreground" />
                      Patterns Detected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.patterns.map((pattern, i) => (
                        <Badge key={i} variant="secondary">{pattern}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-foreground" />
                    Key Levels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Support Levels</div>
                      <div className="space-y-1">
                        {analysisResult.supportLevels.map((level, i) => (
                          <div key={i} className="font-mono text-green-500">${level.toFixed(2)}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Resistance Levels</div>
                      <div className="space-y-1">
                        {analysisResult.resistanceLevels.map((level, i) => (
                          <div key={i} className="font-mono text-red-400">${level.toFixed(2)}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!analysisResult && !analyzeMutation.isPending && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Analysis Yet</h3>
                <p className="text-muted-foreground">Upload a chart to get AI-powered insights</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
