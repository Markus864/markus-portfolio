import { useState } from "react";
import { Link } from "wouter";
import { SignInButton, SignUpButton } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { hasAppAccess } from "@/lib/authUtils";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, ArrowLeft } from "lucide-react";

import logo from "@/assets/iron-strike-trading_primary_dark.png";

/**
 * PRICING PAGE — Zone I: Commitment Gate
 * 
 * Purpose: Frame pricing as access to capability, not features.
 * 
 * Must Communicate:
 * - Responsibility of access
 * - Capability progression
 * - Who each tier is for
 * 
 * Must Never:
 * - Push urgency
 * - Use emotional pricing tactics
 * - Feel promotional
 */

type TierId = "free" | "pro" | "premium";
type BillingInterval = "monthly" | "yearly";

type PricingInfo = {
  monthly: { price: string; priceSub: string };
  yearly: { price: string; priceSub: string; savings: string };
};

type Tier = {
  id: TierId;
  name: string;
  pricing: PricingInfo | null;
  targetUser: string;
  description: string;
  ctaLabel: string;
  capabilities: string[];
};

const tiers: Tier[] = [
  {
    id: "free",
    name: "Starter",
    pricing: null,
    targetUser: "Learning structure",
    description: "Explore the platform and evaluate the decision workflow before committing.",
    ctaLabel: "Start free",
    capabilities: [
      "Core dashboard access",
      "Basic price alerts",
      "Simple watchlist tracking",
      "Email delivery",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Analyst",
    pricing: {
      monthly: { price: "$49", priceSub: "/month" },
      yearly: { price: "$41", priceSub: "/month, billed annually", savings: "Save $96/year" },
    },
    targetUser: "Active swing traders",
    description: "For traders who rely on consistent signal flow and structured decision context.",
    ctaLabel: "Upgrade to Analyst",
    capabilities: [
      "Expanded alert limits",
      "Full Options Screener",
      "Telegram & Discord delivery",
      "Basic AI coaching",
      "Priority support",
    ],
  },
  {
    id: "premium",
    name: "Professional",
    pricing: {
      monthly: { price: "$99", priceSub: "/month" },
      yearly: { price: "$82", priceSub: "/month, billed annually", savings: "Save $204/year" },
    },
    targetUser: "Serious options traders",
    description: "Full system access with maximum flexibility and advanced analytical capabilities.",
    ctaLabel: "Unlock Professional",
    capabilities: [
      "Maximum alert capacity",
      "Advanced screener filters",
      "Full AI coaching suite",
      "Strategy performance tracking",
      "Priority support + roadmap input",
    ],
  },
];

const COMPARISON_FEATURES = [
  { name: "Signal capacity", free: "10/month", pro: "50/month", premium: "200/month" },
  { name: "Journal entries", free: "20", pro: "100", premium: "Unlimited" },
  { name: "Alert channels", free: "Email", pro: "Email, Telegram, Discord", premium: "All + Webhook" },
  { name: "Screener access", free: "Basic", pro: "Full", premium: "Full + Advanced filters" },
  { name: "AI coaching", free: "-", pro: "Standard", premium: "Full suite" },
  { name: "Performance tracking", free: "-", pro: "Basic", premium: "Full analytics" },
  { name: "Data export", free: "-", pro: "-", premium: "Yes" },
  { name: "Support", free: "Community", pro: "Priority email", premium: "Priority + Roadmap" },
];

type BillingConfig = {
  yearlyPricingAvailable: boolean;
  stripeConfigured: boolean;
};

export default function Pricing() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState<TierId | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  const { data: billingConfig } = useQuery<BillingConfig>({
    queryKey: ["/api/billing/config"],
  });

  const yearlyAvailable = billingConfig?.yearlyPricingAvailable ?? false;
  const canAccessApp = hasAppAccess(isAuthenticated, user?.id);

  async function handleSubscribe(tierId: TierId) {
    if (authLoading) return;

    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to continue.",
      });
      return;
    }

    if (tierId === "free") {
      window.location.href = "/app";
      return;
    }

    try {
      setLoading(tierId);
      const res = await apiRequest("POST", "/api/billing/create-checkout-session", {
        plan: tierId,
        interval: billingInterval,
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err: any) {
      toast({
        title: "Billing error",
        description: err.message || "Unable to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  }

  function getPriceDisplay(tier: Tier): { price: string; priceSub: string; savings?: string } {
    if (!tier.pricing) {
      return { price: "$0", priceSub: "No card required" };
    }
    return billingInterval === "yearly" ? tier.pricing.yearly : tier.pricing.monthly;
  }

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="pricing-container">
      {/* Header */}
      <header className="border-b border-border/50" data-testid="header">
        <div className="mx-auto max-w-content px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <img
                src={logo}
                alt="Iron Strike Trading"
                className="h-7 w-auto cursor-pointer"
                data-testid="img-logo"
              />
            </Link>
          </div>

          <nav className="hidden sm:flex items-center gap-6" data-testid="nav-links">
            <Link href="/">
              <span className="text-sm text-foreground-secondary hover:text-foreground transition-colors cursor-pointer">
                Platform
              </span>
            </Link>
            <Link href="/how-it-works">
              <span className="text-sm text-foreground-secondary hover:text-foreground transition-colors cursor-pointer">
                How It Works
              </span>
            </Link>
            <Link href="/methodology">
              <span className="text-sm text-foreground-secondary hover:text-foreground transition-colors cursor-pointer">
                Methodology
              </span>
            </Link>
            <Link href="/pricing">
              <span className="text-sm text-foreground hover:text-foreground transition-colors cursor-pointer">
                Pricing
              </span>
            </Link>
          </nav>

          {canAccessApp ? (
            <Link href="/app">
              <Button size="sm" data-testid="button-enter-platform">
                Enter Platform
              </Button>
            </Link>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/pricing">
              <Button variant="ghost" size="sm" data-testid="button-signin">
                Sign in
              </Button>
            </SignInButton>
          )}
        </div>
      </header>

      {/* Back navigation */}
      <div className="mx-auto max-w-content px-6 pt-8">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-content px-6 py-16">
        {/* Hero */}
        <div className="max-w-2xl mb-16">
          <span className="text-label text-muted-foreground">
            Capability Progression
          </span>
          <h1 className="text-hero mt-4 mb-6" data-testid="page-title">
            Access levels
          </h1>
          <p className="text-lg text-foreground-secondary" data-testid="page-description">
            Iron Strike sells capability progression, not features. 
            Free tiers teach structure. Paid tiers unlock control.
          </p>

          {/* Billing toggle */}
          {yearlyAvailable && (
            <div className="flex items-center gap-4 mt-8">
              <Label
                htmlFor="billing-toggle"
                className={`text-sm cursor-pointer ${billingInterval === "monthly" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={billingInterval === "yearly"}
                onCheckedChange={(checked) => setBillingInterval(checked ? "yearly" : "monthly")}
                data-testid="switch-billing-interval"
              />
              <Label
                htmlFor="billing-toggle"
                className={`text-sm cursor-pointer ${billingInterval === "yearly" ? "text-foreground" : "text-muted-foreground"}`}
              >
                Yearly
                {billingInterval === "yearly" && (
                  <span className="ml-2 text-xs text-primary">Save up to 17%</span>
                )}
              </Label>
            </div>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24" data-testid="pricing-cards">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="p-6 bg-card border border-border/50 rounded-md flex flex-col"
              data-testid={`pricing-card-${tier.id}`}
            >
              {/* Header */}
              <div className="mb-6">
                <div className="flex flex-col gap-2 mb-3">
                  <h2 className="text-heading">{tier.name}</h2>
                  <span className="text-label text-muted-foreground">{tier.targetUser}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-semibold font-mono">
                    {getPriceDisplay(tier).price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {getPriceDisplay(tier).priceSub}
                  </span>
                </div>
                {getPriceDisplay(tier).savings && (
                  <span className="text-xs text-primary">{getPriceDisplay(tier).savings}</span>
                )}
                <p className="text-sm text-foreground-secondary mt-3">{tier.description}</p>
              </div>

              {/* Capabilities */}
              <ul className="space-y-3 flex-1 mb-6">
                {tier.capabilities.map((capability, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground-secondary">{capability}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {authLoading || isAuthenticated ? (
                <Button
                  variant={tier.id === "free" ? "outline" : "default"}
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading !== null || authLoading}
                  className="w-full"
                  data-testid={`button-subscribe-${tier.id}`}
                >
                  {authLoading ? "Loading..." : loading === tier.id ? "Processing..." : tier.ctaLabel}
                </Button>
              ) : (
                <SignUpButton mode="redirect" forceRedirectUrl={tier.id === "free" ? "/app" : "/pricing"}>
                  <Button
                    variant={tier.id === "free" ? "outline" : "default"}
                    className="w-full"
                    data-testid={`button-subscribe-${tier.id}`}
                  >
                    {tier.ctaLabel}
                  </Button>
                </SignUpButton>
              )}
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mb-24" data-testid="comparison-table">
          <h2 className="text-display mb-8">Compare access levels</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="py-4 text-left font-medium text-muted-foreground">Capability</th>
                  <th className="py-4 text-center font-medium text-muted-foreground">Starter</th>
                  <th className="py-4 text-center font-medium text-muted-foreground">Analyst</th>
                  <th className="py-4 text-center font-medium text-muted-foreground">Professional</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((feature, idx) => (
                  <tr key={idx} className="border-b border-border/30" data-testid={`comparison-row-${idx}`}>
                    <td className="py-4 text-foreground">{feature.name}</td>
                    <td className="py-4 text-center text-muted-foreground font-mono text-xs">{feature.free}</td>
                    <td className="py-4 text-center text-foreground-secondary font-mono text-xs">{feature.pro}</td>
                    <td className="py-4 text-center text-foreground font-mono text-xs">{feature.premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing Philosophy */}
        <div className="mb-24 p-8 bg-card border border-border/50 rounded-md" data-testid="pricing-philosophy">
          <h2 className="text-display mb-6">Pricing philosophy</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-foreground-secondary">
            <div>
              <h3 className="font-medium text-foreground mb-3">What you pay for</h3>
              <ul className="space-y-2 text-sm">
                <li>Capability progression</li>
                <li>Structural depth</li>
                <li>Analytical leverage</li>
                <li>Time efficiency</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-3">What pricing reflects</h3>
              <ul className="space-y-2 text-sm">
                <li>Responsibility of access</li>
                <li>Trust through transparency</li>
                <li>System capability, not feature count</li>
                <li>Discipline infrastructure</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Trust footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2" data-testid="trust-footer">
          <p>All payments processed securely via Stripe.</p>
          <p>Cancel or change your access level anytime from account settings.</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50" data-testid="footer">
        <div className="mx-auto max-w-content px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Not financial advice. Options involve risk.</span>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/risk-disclosure" className="hover:text-foreground transition-colors">
                Risk Disclosure
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
