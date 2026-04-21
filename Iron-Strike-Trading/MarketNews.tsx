import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Newspaper, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  ExternalLink, 
  Clock,
  RefreshCw,
  Loader2,
  Flame,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Bot,
  Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { NewsItem, MarketTrend } from "@shared/schema";

interface NewsResponse {
  news: NewsItem[];
  totalCount: number;
  lastUpdated: string;
}

interface TrendsResponse {
  trends: MarketTrend[];
  lastUpdated: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
}

function SentimentBadge({ sentiment }: { sentiment?: string }) {
  if (!sentiment) return null;
  
  const config = {
    POSITIVE: { icon: ArrowUpRight, className: "text-green-500" },
    NEGATIVE: { icon: ArrowDownRight, className: "text-red-400" },
    NEUTRAL: { icon: Minus, className: "text-muted-foreground" },
  }[sentiment] || { icon: Minus, className: "text-muted-foreground" };
  
  const Icon = config.icon;
  
  return (
    <Badge variant="secondary" className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {sentiment.toLowerCase()}
    </Badge>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true });
  
  return (
    <Card className="hover-elevate group" data-testid={`news-card-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {item.imageUrl && (
            <div className="hidden sm:block shrink-0">
              <img 
                src={item.imageUrl} 
                alt="" 
                className="w-24 h-24 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{item.sourceName}</span>
                <span>•</span>
                <Clock className="h-3 w-3" />
                <span>{timeAgo}</span>
              </div>
              <SentimentBadge sentiment={item.sentiment} />
            </div>
            
            <a 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block group/link"
              data-testid={`link-news-${item.id}`}
            >
              <h3 className="font-semibold text-foreground group-hover/link:text-foreground/80 transition-colors line-clamp-2 mb-2">
                {item.title}
                <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover/link:opacity-100 transition-opacity" />
              </h3>
            </a>
            
            {item.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {item.summary}
              </p>
            )}
            
            <div className="flex items-center gap-2 flex-wrap">
              {item.category && (
                <Badge variant="secondary" className="text-xs">
                  {item.category}
                </Badge>
              )}
              {item.relatedSymbols?.slice(0, 4).map((symbol) => (
                <Badge 
                  key={symbol} 
                  variant="outline" 
                  className="text-xs font-mono text-foreground"
                >
                  ${symbol}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendCard({ trend, onClick }: { trend: MarketTrend; onClick?: () => void }) {
  const isPositive = trend.change >= 0;
  
  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      data-testid={`trend-card-${trend.id}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${
              trend.sentiment === "POSITIVE" ? "bg-green-500/10" :
              trend.sentiment === "NEGATIVE" ? "bg-red-500/10" : "bg-muted"
            }`}>
              <Flame className={`h-4 w-4 ${
                trend.sentiment === "POSITIVE" ? "text-green-500" :
                trend.sentiment === "NEGATIVE" ? "text-red-400" : "text-muted-foreground"
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{trend.topic}</h3>
              <div className="text-xs text-muted-foreground">{trend.newsCount} articles</div>
            </div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-mono ${
            isPositive ? "text-green-500" : "text-red-400"
          }`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isPositive ? "+" : ""}{trend.change.toFixed(1)}%
          </div>
        </div>
        
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Trend Score</span>
            <span className="text-foreground font-medium">{trend.score}/100</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                trend.sentiment === "POSITIVE" ? "bg-green-500" :
                trend.sentiment === "NEGATIVE" ? "bg-red-500" : "bg-muted-foreground"
              }`}
              style={{ width: `${trend.score}%` }}
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1">
          {trend.relatedSymbols.map((symbol) => (
            <Badge 
              key={symbol} 
              variant="outline" 
              className="text-xs font-mono text-muted-foreground"
            >
              ${symbol}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MarketNews() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("news");
  
  const [coachMessage, setCoachMessage] = useState("");
  const [coachResponse, setCoachResponse] = useState<string | null>(null);

  const coachMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/chat", { message });
      return res.json();
    },
    onSuccess: (data) => {
      setCoachResponse(data.response || data.structured?.answer || "Ready to assist.");
    },
    onError: () => {
      setCoachResponse("Unable to process request. Try again.");
    }
  });

  const handleCoachSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachMessage.trim()) {
      coachMutation.mutate(coachMessage);
      setCoachMessage("");
    }
  };

  const { data: newsData, isLoading: newsLoading, refetch: refetchNews, isFetching: newsFetching } = useQuery<NewsResponse>({
    queryKey: ["/api/news", selectedCategory === "all" ? "" : selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") {
        params.set("category", selectedCategory);
      }
      const res = await fetch(`/api/news?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
  });

  const { data: trendsData, isLoading: trendsLoading, refetch: refetchTrends, isFetching: trendsFetching } = useQuery<TrendsResponse>({
    queryKey: ["/api/trends"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/news/categories"],
  });

  const handleRefresh = () => {
    refetchNews();
    refetchTrends();
  };

  const handleTrendClick = (trend: MarketTrend) => {
    const topicKeywords: Record<string, string> = {
      "AI & Machine Learning": "AI",
      "Federal Reserve Policy": "Fed",
      "Electric Vehicles": "electric",
      "Cloud Computing": "cloud",
      "Semiconductor Supply": "semiconductor",
      "Cryptocurrency Adoption": "crypto",
    };
    
    const searchQuery = topicKeywords[trend.topic] 
      || trend.topic.split(/\s+/)[0]
      || (trend.relatedSymbols.length > 0 ? trend.relatedSymbols[0] : "");
    
    setSearchTerm(searchQuery);
    setSelectedCategory("all");
    setActiveTab("news");
  };

  const isRefreshing = newsFetching || trendsFetching;

  const filteredNews = newsData?.news.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.relatedSymbols?.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  const sentimentCounts = {
    positive: filteredNews.filter(n => n.sentiment === "POSITIVE").length,
    negative: filteredNews.filter(n => n.sentiment === "NEGATIVE").length,
    neutral: filteredNews.filter(n => n.sentiment === "NEUTRAL").length,
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative" data-testid="market-news-page">
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-muted border border-border rounded-lg">
              <Newspaper className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Market News & Trends</h1>
              <p className="text-muted-foreground">Real-time market insights and trending topics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search news or symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-news"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-news"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <Newspaper className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{filteredNews.length}</div>
                <div className="text-sm text-muted-foreground">Total Articles</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{sentimentCounts.positive}</div>
                <div className="text-sm text-muted-foreground">Positive</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-400">{sentimentCounts.negative}</div>
                <div className="text-sm text-muted-foreground">Negative</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Flame className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{trendsData?.trends.length || 0}</div>
                <div className="text-sm text-muted-foreground">Hot Trends</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Iron Strike Coach - Mobile visible */}
        <Card data-testid="card-coach-mobile" className="lg:hidden">
          <CardHeader className="border-b border-border py-3">
            <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Iron Strike Coach
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {coachResponse && (
              <div className="p-3 bg-muted rounded-lg text-sm text-foreground" data-testid="text-coach-response-mobile">
                {coachResponse}
              </div>
            )}
            <form onSubmit={handleCoachSubmit} className="flex gap-2">
              <Input placeholder="Ask the coach..." value={coachMessage} onChange={(e) => setCoachMessage(e.target.value)} className="flex-1 text-sm" data-testid="input-coach-message-mobile" />
              <Button type="submit" size="icon" disabled={coachMutation.isPending || !coachMessage.trim()} data-testid="button-coach-send-mobile">
                {coachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="news" data-testid="tab-news">
                  <Newspaper className="h-4 w-4 mr-2" />
                  Headlines
                </TabsTrigger>
                <TabsTrigger value="trends" data-testid="tab-trends">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Trending
                </TabsTrigger>
              </TabsList>

              <TabsContent value="news" className="space-y-4">
                <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  <div className="flex gap-2 min-w-max">
                    {categories.map((cat) => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(cat.id)}
                        className="shrink-0 whitespace-nowrap"
                        data-testid={`button-category-${cat.id}`}
                      >
                        {cat.name}
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {cat.count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>

                {newsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                  </div>
                ) : filteredNews.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No news found</h3>
                      <p className="text-muted-foreground">Try adjusting your search or category filter</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {filteredNews.map((item) => (
                      <NewsCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
                
                {newsData?.lastUpdated && (
                  <div className="text-center text-xs text-muted-foreground">
                    Last updated: {new Date(newsData.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trends" className="space-y-4">
                {trendsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                  </div>
                ) : !trendsData?.trends.length ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Flame className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No trends available</h3>
                      <p className="text-muted-foreground">Check back later for trending topics</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trendsData.trends.map((trend) => (
                      <TrendCard 
                        key={trend.id} 
                        trend={trend} 
                        onClick={() => handleTrendClick(trend)}
                      />
                    ))}
                  </div>
                )}
                
                {trendsData?.lastUpdated && (
                  <div className="text-center text-xs text-muted-foreground">
                    Last updated: {new Date(trendsData.lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card data-testid="card-coach">
              <CardHeader className="border-b border-border py-3">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Iron Strike Coach
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {coachResponse && (
                  <div className="p-3 bg-muted rounded-lg text-sm text-foreground" data-testid="text-coach-response">
                    {coachResponse}
                  </div>
                )}
                <form onSubmit={handleCoachSubmit} className="flex gap-2">
                  <Input placeholder="Ask the coach..." value={coachMessage} onChange={(e) => setCoachMessage(e.target.value)} className="flex-1 text-sm" data-testid="input-coach-message" />
                  <Button type="submit" size="icon" disabled={coachMutation.isPending || !coachMessage.trim()} data-testid="button-coach-send">
                    {coachMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
