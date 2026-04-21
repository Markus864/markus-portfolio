import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/Footer";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import type { SelectSignalHistory } from "@shared/schema";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const Landing = lazy(() => import("@/pages/Landing"));
const Home = lazy(() => import("@/pages/Home"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const SignalGenerator = lazy(() => import("@/pages/SignalGenerator"));
const HistoryPage = lazy(() => import("@/pages/History"));
const Charts = lazy(() => import("@/pages/Charts"));
const PortfolioAnalytics = lazy(() => import("@/pages/PortfolioAnalytics"));
const Strategies = lazy(() => import("@/pages/Strategies"));
const LiveSignals = lazy(() => import("@/pages/LiveSignals"));
const CalculatorPage = lazy(() => import("@/pages/Calculator"));
const Watchlist = lazy(() => import("@/pages/Watchlist"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const MarketNews = lazy(() => import("@/pages/MarketNews"));
const ChartAnalysis = lazy(() => import("@/pages/ChartAnalysis"));
const OptionsScreener = lazy(() => import("@/pages/OptionsScreener"));
const ZeroDTEHub = lazy(() => import("@/pages/ZeroDTEHub"));
const WhaleTracker = lazy(() => import("@/pages/WhaleTracker"));
const EarningsPlays = lazy(() => import("@/pages/EarningsPlays"));
const AIChatbot = lazy(() => import("@/components/AIChatbot"));
const ControlCenter = lazy(() => import("@/pages/ControlCenter"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const RiskDisclosure = lazy(() => import("@/pages/RiskDisclosure"));
const Contact = lazy(() => import("@/pages/Contact"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const BillingSuccess = lazy(() => import("@/pages/BillingSuccess"));
const AccountSettings = lazy(() => import("@/pages/AccountSettings"));
const AnalyticsKpis = lazy(() => import("@/pages/AnalyticsKpis"));
const StrategyPerformance = lazy(() => import("@/pages/StrategyPerformance"));
const ConfidenceCalibration = lazy(() => import("@/pages/ConfidenceCalibration"));
const UserVsAI = lazy(() => import("@/pages/UserVsAI"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const Methodology = lazy(() => import("@/pages/Methodology"));
const Disclaimer = lazy(() => import("@/pages/Disclaimer"));
const BotCommands = lazy(() => import("@/pages/BotCommands"));
const SupportTickets = lazy(() => import("@/pages/SupportTickets"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]" data-testid="page-loader">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    </div>
  );
}

function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background" data-testid="full-page-loader">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Loading Iron Strike Trading...</span>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full bg-background overflow-x-hidden">
      <TopNav />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="flex-1">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </div>
        <Footer />
      </main>
    </div>
  );
}

function AppLayoutWithChatbot({ children }: { children: React.ReactNode }) {
  const { data: recentSignals } = useQuery<SelectSignalHistory[]>({
    queryKey: ["/api/history"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <AppLayout>{children}</AppLayout>
      <Suspense fallback={null}>
        <AIChatbot recentSignals={recentSignals?.slice(0, 5)} />
      </Suspense>
    </>
  );
}

function Router() {
  return (
    <Switch>
      {/* App routes with sidebar navigation - protected, require authentication */}
      <Route path="/app/home">
        <ProtectedRoute><AppLayoutWithChatbot><Home /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/control-center">
        <ProtectedRoute><AppLayoutWithChatbot><ControlCenter /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/live">
        <ProtectedRoute><AppLayoutWithChatbot><LiveSignals /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/generator">
        <ProtectedRoute><AppLayoutWithChatbot><SignalGenerator /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/history">
        <ProtectedRoute><AppLayoutWithChatbot><HistoryPage /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/charts">
        <ProtectedRoute><AppLayoutWithChatbot><Charts /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/chart-analysis">
        <ProtectedRoute><AppLayoutWithChatbot><ChartAnalysis /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/screener">
        <ProtectedRoute><AppLayoutWithChatbot><OptionsScreener /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/0dte">
        <ProtectedRoute><AppLayoutWithChatbot><ZeroDTEHub /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/whales">
        <ProtectedRoute><AppLayoutWithChatbot><WhaleTracker /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/earnings">
        <ProtectedRoute><AppLayoutWithChatbot><EarningsPlays /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/portfolio">
        <ProtectedRoute><AppLayoutWithChatbot><PortfolioAnalytics /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/watchlist">
        <ProtectedRoute><AppLayoutWithChatbot><Watchlist /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/alerts">
        <ProtectedRoute><AppLayoutWithChatbot><Alerts /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/strategies">
        <ProtectedRoute><AppLayoutWithChatbot><Strategies /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/calculator">
        <ProtectedRoute><AppLayoutWithChatbot><CalculatorPage /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/news">
        <ProtectedRoute><AppLayoutWithChatbot><MarketNews /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/analytics-kpis">
        <ProtectedRoute><AppLayoutWithChatbot><AnalyticsKpis /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/strategy-performance">
        <ProtectedRoute><AppLayoutWithChatbot><StrategyPerformance /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/confidence-calibration">
        <ProtectedRoute><AppLayoutWithChatbot><ConfidenceCalibration /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/user-vs-ai">
        <ProtectedRoute><AppLayoutWithChatbot><UserVsAI /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/settings">
        <ProtectedRoute><AppLayoutWithChatbot><AccountSettings /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app/support-tickets">
        <ProtectedRoute><AppLayoutWithChatbot><SupportTickets /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      <Route path="/app">
        <ProtectedRoute><AppLayoutWithChatbot><Dashboard /></AppLayoutWithChatbot></ProtectedRoute>
      </Route>
      
      {/* Legal pages */}
      <Route path="/terms">
        <Suspense fallback={<FullPageLoader />}>
          <Terms />
        </Suspense>
      </Route>
      <Route path="/privacy">
        <Suspense fallback={<FullPageLoader />}>
          <Privacy />
        </Suspense>
      </Route>
      <Route path="/risk-disclosure">
        <Suspense fallback={<FullPageLoader />}>
          <RiskDisclosure />
        </Suspense>
      </Route>
      <Route path="/contact">
        <Suspense fallback={<FullPageLoader />}>
          <Contact />
        </Suspense>
      </Route>
      <Route path="/changelog">
        <Suspense fallback={<FullPageLoader />}>
          <Changelog />
        </Suspense>
      </Route>
      <Route path="/how-it-works">
        <Suspense fallback={<FullPageLoader />}>
          <HowItWorks />
        </Suspense>
      </Route>
      <Route path="/methodology">
        <Suspense fallback={<FullPageLoader />}>
          <Methodology />
        </Suspense>
      </Route>
      <Route path="/disclaimer">
        <Suspense fallback={<FullPageLoader />}>
          <Disclaimer />
        </Suspense>
      </Route>
      <Route path="/commands">
        <Suspense fallback={<FullPageLoader />}>
          <BotCommands />
        </Suspense>
      </Route>
      <Route path="/pricing">
        <Suspense fallback={<FullPageLoader />}>
          <Pricing />
        </Suspense>
      </Route>
      <Route path="/billing/success">
        <Suspense fallback={<FullPageLoader />}>
          <BillingSuccess />
        </Suspense>
      </Route>
      
      {/* Landing page at root - last specific route */}
      <Route path="/">
        <Suspense fallback={<FullPageLoader />}>
          <Landing />
        </Suspense>
      </Route>
      
      {/* Catch-all for 404 */}
      <Route>
        <Suspense fallback={<FullPageLoader />}>
          <NotFound />
        </Suspense>
      </Route>
    </Switch>
  );
}

function App() {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-red-400">Missing Clerk Publishable Key</div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
