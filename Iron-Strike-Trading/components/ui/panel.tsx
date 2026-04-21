import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "inset";
}

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-border/50",
          variant === "default" && "bg-card",
          variant === "elevated" && "bg-[hsl(213_24%_13%)] shadow-md",
          variant === "inset" && "bg-background-secondary",
          className
        )}
        {...props}
      />
    );
  }
);
Panel.displayName = "Panel";

interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("px-6 py-4 border-b border-border/50", className)}
        {...props}
      />
    );
  }
);
PanelHeader.displayName = "PanelHeader";

interface PanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const PanelTitle = forwardRef<HTMLHeadingElement, PanelTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn("text-lg font-medium text-foreground", className)}
        {...props}
      />
    );
  }
);
PanelTitle.displayName = "PanelTitle";

interface PanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const PanelContent = forwardRef<HTMLDivElement, PanelContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("p-6", className)}
        {...props}
      />
    );
  }
);
PanelContent.displayName = "PanelContent";

export { Panel, PanelHeader, PanelTitle, PanelContent };
