import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Sparkles, Crown, Zap } from "lucide-react";
import { Link } from "wouter";

interface UpgradeBannerProps {
  feature: string;
  requiredTier: "pro" | "premium";
  description?: string;
  compact?: boolean;
}

export function UpgradeBanner({ feature, requiredTier, description, compact = false }: UpgradeBannerProps) {
  const tierConfig = {
    pro: {
      icon: Zap,
      label: "Pro",
      price: "$49/mo",
    },
    premium: {
      icon: Crown,
      label: "Premium",
      price: "$99/mo",
    },
  };

  const config = tierConfig[requiredTier];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted border border-border"
        data-testid="banner-upgrade-compact"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{feature}</span>
          <Badge variant="secondary" className="text-xs">
            {config.label}
          </Badge>
        </div>
        <Link href="/pricing">
          <Button size="sm" variant="outline" className="gap-1" data-testid="button-upgrade-compact">
            <Sparkles className="h-3 w-3" />
            Upgrade
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Card className="bg-muted border-border" data-testid="banner-upgrade">
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{feature}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
        )}
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Available with</span>
          <Badge variant="secondary">
            {config.label}
          </Badge>
        </div>
        <Link href="/pricing">
          <Button className="gap-2" data-testid="button-upgrade">
            <Sparkles className="h-4 w-4" />
            Upgrade to {config.label}
          </Button>
        </Link>
        <p className="text-xs text-muted-foreground mt-2">{config.price}</p>
      </CardContent>
    </Card>
  );
}

interface FeatureGateProps {
  children: React.ReactNode;
  hasAccess: boolean;
  feature: string;
  requiredTier: "pro" | "premium";
  description?: string;
  compact?: boolean;
}

export function FeatureGate({ children, hasAccess, feature, requiredTier, description, compact }: FeatureGateProps) {
  if (hasAccess) {
    return <>{children}</>;
  }
  return <UpgradeBanner feature={feature} requiredTier={requiredTier} description={description} compact={compact} />;
}
