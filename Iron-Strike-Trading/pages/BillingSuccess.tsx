import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";

export default function BillingSuccess() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      toast({ title: "Missing session", description: "No session ID found", variant: "destructive" });
      navigate("/pricing");
      return;
    }

    (async () => {
      try {
        const res = await apiRequest("GET", `/api/billing/confirm?session_id=${sessionId}`);
        const data = await res.json();
        if (data.success) {
          toast({ title: "Subscription activated", description: `Your plan is now ${data.role}` });
          setTimeout(() => navigate("/app"), 2000);
        } else {
          toast({ title: "Payment processed", description: "We could not update your plan automatically." });
          setTimeout(() => navigate("/app"), 3000);
        }
      } catch (err: any) {
        toast({ title: "Error", description: err.message ?? "Could not confirm subscription", variant: "destructive" });
        setTimeout(() => navigate("/pricing"), 3000);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="billing-success-page">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
          <div className="p-4 bg-muted rounded-full">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Finalizing your subscription...</h1>
          <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
