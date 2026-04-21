import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Bug, Zap, Shield } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: "feature" | "fix" | "improvement" | "security";
    description: string;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2024-12-06",
    changes: [
      { type: "feature", description: "Initial beta release of Iron Strike Trading" },
      { type: "feature", description: "AI-powered options signal generation for SPY, QQQ, IWM, TSLA" },
      { type: "feature", description: "Real-time market data integration with fallback to mock data" },
      { type: "feature", description: "Options calculator with Greeks analysis" },
      { type: "feature", description: "Portfolio analytics and trade history tracking" },
      { type: "feature", description: "AI chatbot for trading assistance" },
      { type: "improvement", description: "Status indicators showing data source and AI availability" },
      { type: "security", description: "Educational disclaimer and risk warnings" },
    ],
  },
];

const typeConfig = {
  feature: { icon: Sparkles, color: "bg-green-500/20 text-green-500 border-green-500/30" },
  fix: { icon: Bug, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  improvement: { icon: Zap, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  security: { icon: Shield, color: "bg-muted text-amber-400 border-border" },
};

export default function Changelog() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <main className="max-w-3xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-changelog-title">
            Beta Changelog
          </h1>
          <p className="text-muted-foreground">
            Track updates and improvements to Iron Strike Trading
          </p>
        </div>

        <div className="space-y-6">
          {changelog.map((entry) => (
            <Card key={entry.version} className="overflow-visible" data-testid={`card-version-${entry.version}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">v{entry.version}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {entry.date}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {entry.changes.map((change, idx) => {
                    const config = typeConfig[change.type];
                    const Icon = config.icon;
                    return (
                      <li key={idx} className="flex items-start gap-3">
                        <Badge className={`${config.color} text-xs gap-1 flex-shrink-0`}>
                          <Icon className="h-3 w-3" />
                          {change.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{change.description}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}