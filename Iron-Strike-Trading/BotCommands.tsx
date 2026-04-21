import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Command = {
  name: string;
  desc: string;
  tier: "Free" | "Pro" | "Premium";
  example: string;
};

const COMMANDS: Record<string, Command[]> = {
  "Market Data": [
    { name: "/price", desc: "Get real-time stock quotes", tier: "Free", example: "/price AAPL" },
    { name: "/chart", desc: "View interactive technical chart", tier: "Free", example: "/chart TSLA" },
  ],
  "AI Analysis": [
    { name: "/analyze", desc: "Full AI market analysis", tier: "Premium", example: "/analyze SPY" },
    { name: "/ask", desc: "Ask the AI a custom question", tier: "Premium", example: "/ask What is Delta?" },
    { name: "/sentiment", desc: "Market sentiment analysis", tier: "Premium", example: "/sentiment AAPL" },
    { name: "/bias", desc: "Daily directional bias", tier: "Premium", example: "/bias QQQ" },
    { name: "/plan", desc: "Generate a trading plan", tier: "Premium", example: "/plan IWM" },
    { name: "/explain", desc: "Explain trading concepts", tier: "Premium", example: "/explain Theta Decay" },
    { name: "/review", desc: "Review a trade idea", tier: "Premium", example: "/review AAPL call spread" },
  ],
  "Options": [
    { name: "/options", desc: "Options chain summary", tier: "Premium", example: "/options AAPL" },
    { name: "/chain", desc: "Detailed option strikes", tier: "Premium", example: "/chain SPY" },
    { name: "/iv", desc: "Implied Volatility rank & percentile", tier: "Premium", example: "/iv TSLA" },
    { name: "/greeks", desc: "Delta, Gamma, Theta, Vega", tier: "Premium", example: "/greeks NVDA" },
    { name: "/maxpain", desc: "Max Pain price level", tier: "Premium", example: "/maxpain AAPL" },
    { name: "/openinterest", desc: "Open Interest distribution", tier: "Premium", example: "/openinterest SPY" },
  ],
  "Technicals": [
    { name: "/rsi", desc: "Relative Strength Index", tier: "Pro", example: "/rsi AAPL" },
    { name: "/macd", desc: "MACD Indicator", tier: "Pro", example: "/macd TSLA" },
    { name: "/ema", desc: "Exponential Moving Averages", tier: "Pro", example: "/ema AMD" },
    { name: "/sma", desc: "Simple Moving Averages", tier: "Pro", example: "/sma NVDA" },
    { name: "/vwap", desc: "Volume Weighted Avg Price", tier: "Pro", example: "/vwap SPY" },
    { name: "/support", desc: "Key support levels", tier: "Pro", example: "/support QQQ" },
    { name: "/resistance", desc: "Key resistance levels", tier: "Pro", example: "/resistance IWM" },
  ],
  "Risk & Strategy": [
    { name: "/entry", desc: "Optimal entry zones", tier: "Pro", example: "/entry AAPL" },
    { name: "/stoploss", desc: "Calculate stop loss levels", tier: "Pro", example: "/stoploss AAPL 150" },
    { name: "/takeprofit", desc: "Calculate take profit targets", tier: "Pro", example: "/takeprofit AAPL 150" },
    { name: "/position", desc: "Position sizing calculator", tier: "Pro", example: "/position 10000 2" },
    { name: "/risk", desc: "Risk/Reward analysis", tier: "Pro", example: "/risk AAPL" },
    { name: "/strategy", desc: "Recommended option strategy", tier: "Pro", example: "/strategy SPY" },
  ],
  "Signals": [
    { name: "/signals", desc: "Premium Signals overview", tier: "Free", example: "/signals" },
    { name: "/signal", desc: "Latest signal for symbol", tier: "Pro", example: "/signal AAPL" },
    { name: "/today", desc: "Today's market outlook", tier: "Pro", example: "/today" },
    { name: "/weekly", desc: "Weekly market outlook", tier: "Pro", example: "/weekly" },
  ],
  "Portfolio": [
    { name: "/portfolio", desc: "Account summary", tier: "Premium", example: "/portfolio" },
    { name: "/positions", desc: "Open positions", tier: "Premium", example: "/positions" },
    { name: "/pnl", desc: "Profit & Loss analysis", tier: "Premium", example: "/pnl" },
    { name: "/winrate", desc: "Win rate statistics", tier: "Premium", example: "/winrate" },
    { name: "/journal", desc: "Trading journal", tier: "Premium", example: "/journal" },
    { name: "/history", desc: "Trade history", tier: "Premium", example: "/history" },
    { name: "/stats", desc: "Advanced statistics", tier: "Premium", example: "/stats" },
    { name: "/drawdown", desc: "Drawdown analysis", tier: "Premium", example: "/drawdown" },
    { name: "/expectancy", desc: "Trade expectancy", tier: "Premium", example: "/expectancy" },
  ],
  "Account": [
    { name: "/status", desc: "Check your account status", tier: "Free", example: "/status" },
    { name: "/connect", desc: "Link your account", tier: "Free", example: "/connect" },
    { name: "/alerts", desc: "Manage active alerts", tier: "Pro", example: "/alerts" },
    { name: "/alert", desc: "Set price alert", tier: "Pro", example: "/alert AAPL 150 above" },
    { name: "/faq", desc: "Common questions & troubleshooting", tier: "Free", example: "/faq" },
    { name: "/help", desc: "Show all commands", tier: "Free", example: "/help" },
  ]
};

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    Free: "bg-slate-500",
    Pro: "bg-blue-500",
    Premium: "bg-purple-500"
  };
  return <Badge className={`${colors[tier]} hover:${colors[tier]}`}>{tier}</Badge>;
}

export default function BotCommands() {
  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="text-center mb-10 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground" data-testid="text-page-title">Bot Command Center</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-page-description">
          Master the market with over 50+ commands available on Discord and Telegram.
        </p>
      </div>

      <Tabs defaultValue="Market Data" className="w-full" data-testid="tabs-command-categories">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 mb-8 h-auto gap-2 bg-transparent" data-testid="tablist-categories">
          {Object.keys(COMMANDS).map((category) => (
            <TabsTrigger 
              key={category} 
              value={category}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-border text-xs sm:text-sm"
              data-testid={`tab-${category.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(COMMANDS).map(([category, commands]) => (
          <TabsContent key={category} value={category} data-testid={`tabcontent-${category.toLowerCase().replace(/\s+/g, '-')}`}>
            <Card className="bg-card/40 border-border backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-foreground" data-testid={`text-category-title-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                  {category} Commands
                </CardTitle>
                <CardDescription>
                  Available for Discord and Telegram
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table data-testid={`table-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Command</TableHead>
                      <TableHead className="text-muted-foreground">Description</TableHead>
                      <TableHead className="text-muted-foreground">Tier</TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commands.map((cmd) => (
                      <TableRow key={cmd.name} className="border-border/50 hover:bg-muted/50" data-testid={`row-command-${cmd.name.replace('/', '')}`}>
                        <TableCell className="font-mono text-foreground font-medium" data-testid={`text-command-name-${cmd.name.replace('/', '')}`}>{cmd.name}</TableCell>
                        <TableCell className="text-muted-foreground">{cmd.desc}</TableCell>
                        <TableCell><TierBadge tier={cmd.tier} /></TableCell>
                        <TableCell className="text-muted-foreground/70 font-mono text-xs hidden md:table-cell">{cmd.example}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
