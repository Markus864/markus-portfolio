import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FiltersBarProps {
  children: React.ReactNode;
  activeFilters?: number;
  onClearAll?: () => void;
  className?: string;
}

export function FiltersBar({
  children,
  activeFilters = 0,
  onClearAll,
  className,
}: FiltersBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/30",
        className
      )}
      data-testid="filters-bar"
    >
      <div className="flex flex-wrap items-center gap-2 flex-1">{children}</div>
      {activeFilters > 0 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-xs text-muted-foreground"
          data-testid="button-clear-filters"
        >
          <X className="h-3 w-3 mr-1" />
          Clear all ({activeFilters})
        </Button>
      )}
    </div>
  );
}
