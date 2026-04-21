import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Database, Brain, AlertTriangle, CheckCircle } from "lucide-react";

interface StatusResponse {
  dataSource: string;
  dataSourceAvailable: boolean;
  aiAvailable: boolean;
  lastScannerUpdate: string | null;
  serverUptime: number;
  betaSymbols: string[];
  version: string;
}

export function StatusIndicator() {
  const { data: status, isLoading, isError } = useQuery<StatusResponse>({
    queryKey: ["/api/status"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2" data-testid="status-loading">
        <Badge variant="outline" className="text-xs">
          Loading...
        </Badge>
      </div>
    );
  }

  if (isError || !status) {
    return (
      <div className="flex items-center gap-2" data-testid="status-error">
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          Status Unknown
        </Badge>
      </div>
    );
  }

  const isMockData = status.dataSource === "mock";
  const isRealData = status.dataSource === "tradier" || status.dataSource === "finnhub";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="status-indicator">
      <Badge 
        variant="secondary"
        className={`text-xs gap-1 ${isMockData ? "text-amber-400" : "text-green-500"}`}
        data-testid="badge-data-source"
      >
        <Database className="h-3 w-3" />
        {isMockData ? "Mock Data" : `Live: ${status.dataSource}`}
      </Badge>

      <Badge 
        variant="secondary"
        className={`text-xs gap-1 ${status.aiAvailable ? "text-blue-400" : "text-muted-foreground"}`}
        data-testid="badge-ai-status"
      >
        <Brain className="h-3 w-3" />
        {status.aiAvailable ? "AI Online" : "AI Offline"}
      </Badge>

      <Badge 
        variant="outline"
        className="text-xs gap-1 text-muted-foreground"
        data-testid="badge-version"
      >
        Beta v{status.version}
      </Badge>
    </div>
  );
}
