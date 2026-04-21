import { useAuth } from "@/hooks/useAuth";
import { hasAppAccess } from "@/lib/authUtils";
import { RedirectToSignIn } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background" data-testid="protected-route-loader">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-foreground" />
          <span className="text-muted-foreground">Checking access...</span>
        </div>
      </div>
    );
  }

  if (!hasAppAccess(isAuthenticated, user?.id)) {
    return <RedirectToSignIn />;
  }

  return <>{children}</>;
}
