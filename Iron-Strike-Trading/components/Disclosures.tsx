import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Info, ExternalLink } from "lucide-react";
import { Link } from "wouter";

type DisclosureVariant = "warning" | "info" | "compact";

interface DisclosuresProps {
  variant?: DisclosureVariant;
  showLinks?: boolean;
  className?: string;
}

export function Disclosures({ 
  variant = "warning", 
  showLinks = true,
  className = "" 
}: DisclosuresProps) {
  if (variant === "compact") {
    return (
      <div className={`text-xs text-muted-foreground flex items-center gap-1 ${className}`} data-testid="disclosure-compact">
        <Info className="h-3 w-3" />
        <span>AI signals are for educational purposes only.</span>
        {showLinks && (
          <Link href="/risk-disclosure" className="underline hover:text-foreground">
            Learn more
          </Link>
        )}
      </div>
    );
  }

  const isWarning = variant === "warning";
  const Icon = isWarning ? AlertTriangle : Info;
  const borderColor = isWarning ? "border-border" : "border-border";
  const bgColor = isWarning ? "bg-muted" : "";
  const iconColor = isWarning ? "text-amber-500" : "text-muted-foreground";
  const titleColor = isWarning ? "text-amber-600 dark:text-amber-400" : "text-foreground";

  return (
    <Card className={`${borderColor} ${bgColor} ${className}`} data-testid="disclosure-card">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 ${iconColor} shrink-0 mt-0.5`} />
          <div className="space-y-2">
            <h4 className={`font-medium text-sm ${titleColor}`}>
              {isWarning ? "Risk Disclosure" : "Important Information"}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Options trading involves significant risk of loss and is not appropriate for all investors. 
              AI-generated signals and analysis are for educational and informational purposes only and 
              should not be considered as financial advice. Past performance does not guarantee future results.
            </p>
            {showLinks && (
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/risk-disclosure" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Risk Disclosure
                </Link>
                <Link href="/methodology" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Methodology
                </Link>
                <Link href="/terms" className="flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Terms of Service
                </Link>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SignalDisclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`p-3 rounded-lg border border-dashed text-center ${className}`} data-testid="signal-disclosure">
      <p className="text-xs text-muted-foreground">
        <AlertTriangle className="h-3 w-3 inline mr-1" />
        Signals are AI-generated for educational purposes. Not financial advice.{" "}
        <Link href="/risk-disclosure" className="underline">
          Full disclosure
        </Link>
      </p>
    </div>
  );
}

export function ConfidenceDisclosure({ confidence }: { confidence: number }) {
  const getConfidenceNote = (c: number) => {
    if (c >= 0.8) return "High confidence signals historically perform better, but all trades carry risk.";
    if (c >= 0.6) return "Moderate confidence. Consider position sizing accordingly.";
    return "Lower confidence signal. Use caution and smaller position sizes.";
  };

  return (
    <div className="text-xs text-muted-foreground flex items-start gap-1.5" data-testid="confidence-disclosure">
      <Info className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{getConfidenceNote(confidence)}</span>
    </div>
  );
}
