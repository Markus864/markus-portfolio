import { AlertTriangle } from "lucide-react";

export function DisclaimerFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm py-4 px-4 mt-auto" data-testid="disclaimer-footer">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start gap-3 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground/80">
              Educational Purposes Only - Not Financial Advice
            </p>
            <p>
              Iron Strike Beta is an experimental AI-powered trading signal generator for educational and informational purposes only. 
              The signals, analysis, and recommendations provided do not constitute investment advice, financial advice, trading advice, or any other advice. 
              Options trading involves substantial risk of loss and is not suitable for all investors. 
              Past performance is not indicative of future results. Always consult with a qualified financial advisor before making investment decisions.
            </p>
            <p className="text-muted-foreground/70">
              Beta v0.1.0 | Data may be delayed | AI analysis is experimental
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}