import { ReactNode } from "react";
import { Lock, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  hasFeatureAccess, 
  FEATURE_FLAGS, 
  type FeatureName, 
  type UserRole 
} from "@shared/feature-flags";

interface FeatureGateProps {
  feature: FeatureName;
  userRole?: UserRole;
  children: ReactNode;
  showLockIcon?: boolean;
  fallback?: ReactNode;
}

export function FeatureGate({ 
  feature, 
  userRole = "free", 
  children, 
  showLockIcon = true,
  fallback 
}: FeatureGateProps) {
  const config = FEATURE_FLAGS[feature];
  const hasAccess = hasFeatureAccess(userRole, feature);
  const isComingSoon = config?.comingSoon;

  if (hasAccess && !isComingSoon) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="relative opacity-60 cursor-not-allowed" data-testid={`gate-${feature}`}>
      {children}
      {showLockIcon && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md">
                {isComingSoon ? (
                  <>
                    <Clock className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-xs text-amber-400">Coming Soon</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground capitalize">{config?.requiredRole}</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isComingSoon 
                ? `${config?.displayName} is coming soon!`
                : `Upgrade to ${config?.requiredRole} to unlock ${config?.displayName}`
              }
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

interface ComingSoonBadgeProps {
  className?: string;
}

export function ComingSoonBadge({ className = "" }: ComingSoonBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={`text-[10px] px-1.5 py-0 bg-muted text-amber-400 border-border ${className}`}
      data-testid="badge-coming-soon"
    >
      Soon
    </Badge>
  );
}

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className = "" }: ProBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={`text-[10px] px-1.5 py-0 bg-muted text-blue-400 border-border ${className}`}
      data-testid="badge-pro"
    >
      Pro
    </Badge>
  );
}

interface PremiumBadgeProps {
  className?: string;
}

export function PremiumBadge({ className = "" }: PremiumBadgeProps) {
  return (
    <Badge 
      variant="outline" 
      className={`text-[10px] px-1.5 py-0 bg-muted text-purple-400 border-border ${className}`}
      data-testid="badge-premium"
    >
      Premium
    </Badge>
  );
}