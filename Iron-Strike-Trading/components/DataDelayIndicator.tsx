import { Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

interface DataDelayIndicatorProps {
  lastUpdated?: Date | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export function DataDelayIndicator({
  lastUpdated,
  onRefresh,
  isRefreshing = false,
  showRefreshButton = true,
  compact = false,
}: DataDelayIndicatorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="bg-muted text-amber-400 border-border cursor-help"
            data-testid="badge-data-delay"
          >
            <Clock className="h-3 w-3 mr-1" />
            {compact ? "15m delay" : "Data delayed 15 min"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium mb-1">Market Data Delay</p>
          <p className="text-xs text-muted-foreground">
            Stock quotes and options prices are delayed by 15 minutes.
          </p>
        </TooltipContent>
      </Tooltip>

      {lastUpdated && (
        <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
          Updated: {format(lastUpdated, "h:mm:ss a")}
        </span>
      )}

      {showRefreshButton && onRefresh && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-data"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh data</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
