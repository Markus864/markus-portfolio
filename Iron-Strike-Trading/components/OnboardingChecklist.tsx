import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, User, Database, CreditCard, Bell, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";

type OnboardingStatus = {
  profileComplete: boolean;
  dataSourceConnected: boolean;
  planUpgraded: boolean;
  firstAlertCreated: boolean;
};

type OnboardingResponse = {
  status: OnboardingStatus;
  progress: number;
  complete: boolean;
};

export function OnboardingChecklist() {
  const { data, isLoading, error } = useQuery<OnboardingResponse>({
    queryKey: ["/api/onboarding/status"],
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
            <span className="ml-2 text-sm text-muted-foreground">Loading setup progress...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.complete) {
    return null;
  }

  const steps = [
    {
      key: "profileComplete",
      label: "Complete your profile",
      description: "Add your name to personalize your experience",
      icon: User,
      completed: data.status.profileComplete,
      action: { label: "Edit Profile", href: "/settings" },
    },
    {
      key: "dataSourceConnected",
      label: "Connect market data",
      description: "Link Tradier for real-time options data",
      icon: Database,
      completed: data.status.dataSourceConnected,
      action: null,
    },
    {
      key: "planUpgraded",
      label: "Choose a plan",
      description: "Upgrade for unlimited signals and alerts",
      icon: CreditCard,
      completed: data.status.planUpgraded,
      action: { label: "View Plans", href: "/pricing" },
    },
    {
      key: "firstAlertCreated",
      label: "Create your first alert",
      description: "Set up price alerts to never miss an opportunity",
      icon: Bell,
      completed: data.status.firstAlertCreated,
      action: { label: "Create Alert", href: "/alerts" },
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-foreground" />
            <CardTitle className="text-lg">Get Started</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{steps.length} complete
          </Badge>
        </div>
        <CardDescription>
          Complete these steps to unlock the full power of Iron Strike Trading.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress 
          value={data.progress} 
          className="h-2" 
        />
        
        <ul className="space-y-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                  step.completed 
                    ? "bg-muted" 
                    : "bg-background/50 hover:bg-background/80"
                }`}
                data-testid={`onboarding-step-${step.key}`}
              >
                <div className="mt-0.5">
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Icon className={`h-4 w-4 ${step.completed ? "text-green-500" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${step.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
                {!step.completed && step.action && (
                  <Link href={step.action.href}>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="shrink-0"
                      data-testid={`button-onboarding-${step.key}`}
                    >
                      {step.action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
