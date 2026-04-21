import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface QueryErrorProps {
  error: Error | null;
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryError({
  error,
  title = "Failed to load data",
  message,
  onRetry,
  className = "",
}: QueryErrorProps) {
  const errorMessage = message || error?.message || "An unexpected error occurred";
  
  return (
    <Alert variant="destructive" className={`border-destructive/50 bg-destructive/10 ${className}`} data-testid="alert-query-error">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm">{errorMessage}</span>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
            data-testid="button-retry-query"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
