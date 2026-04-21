import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/clerk-react";
import {
  Database,
  Cpu,
  ShieldCheck,
  Activity,
  Send,
  ArrowLeft,
} from "lucide-react";

import logo from "@/assets/iron-strike-trading_primary_dark.png";

/**
 * HOW IT WORKS — Precision AI Engine
 * 
 * Five steps, one sentence each.
 * If it takes longer than 15 seconds to read, it's wrong.
 */

const PROCESS_STEPS = [
  {
    icon: Database,
    step: "01",
    title: "Ingest market data",
    description: "Real-time quotes, historical OHLCV, and options chains from institutional-grade sources.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "Apply signal models",
    description: "Technical indicators, volatility metrics, and pattern recognition processed through AI.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    title: "Evaluate risk conditions",
    description: "Position sizing, stop-loss levels, and exposure limits calibrated to your tolerance.",
  },
  {
    icon: Activity,
    step: "04",
    title: "Generate decision context",
    description: "Structured output with confidence scores, rationale, and actionable parameters.",
  },
  {
    icon: Send,
    step: "05",
    title: "Deliver through your channels",
    description: "Signals dispatched to Telegram, Discord, or web dashboard in real-time.",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="how-it-works-container">
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
              <span className="text-sm text-foreground hover:text-foreground transition-colors cursor-pointer">
                How It Works
              </span>
            </Link>
            <Link href="/methodology">
              <span className="text-sm text-foreground-secondary hover:text-foreground transition-colors cursor-pointer">
                Methodology
              </span>
            </Link>
            <Link href="/pricing">
              <span className="text-sm text-foreground-secondary hover:text-foreground transition-colors cursor-pointer">
                Pricing
              </span>
            </Link>
          </nav>

          <SignedOut>
            <SignUpButton mode="redirect" forceRedirectUrl="/app">
              <Button size="sm" data-testid="button-get-access">
                Get access
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Link href="/app">
              <Button size="sm" data-testid="button-enter-platform">
                Enter Platform
              </Button>
            </Link>
          </SignedIn>
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
        <div className="max-w-3xl">
          <h1 className="text-hero mb-6" data-testid="page-title">
            How it works
          </h1>
          <p className="text-lg text-foreground-secondary mb-16" data-testid="page-description">
            A systematic process from market data to actionable intelligence.
          </p>
        </div>

        {/* Process steps */}
        <div className="space-y-12" data-testid="process-steps">
          {PROCESS_STEPS.map((item, idx) => (
            <div 
              key={item.step}
              className="grid grid-cols-12 gap-6 items-start"
              data-testid={`process-step-${item.step}`}
            >
              {/* Icon */}
              <div className="col-span-12 sm:col-span-1">
                <div className="w-12 h-12 rounded-md bg-card border border-border/50 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-foreground-secondary" />
                </div>
              </div>

              {/* Content */}
              <div className="col-span-12 sm:col-span-11 space-y-2">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs text-muted-foreground" data-testid={`step-number-${item.step}`}>
                    {item.step}
                  </span>
                  <h3 className="text-heading" data-testid={`step-title-${item.step}`}>
                    {item.title}
                  </h3>
                </div>
                <p className="text-foreground-secondary max-w-xl" data-testid={`step-description-${item.step}`}>
                  {item.description}
                </p>
              </div>

              {/* Connector line (except last) */}
              {idx < PROCESS_STEPS.length - 1 && (
                <div className="col-span-12 sm:col-span-1 hidden sm:flex justify-center">
                  <div className="w-px h-8 bg-border/30" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-24 pt-12 border-t border-border/50">
          <div className="flex flex-wrap gap-4">
            <SignedOut>
              <SignUpButton mode="redirect" forceRedirectUrl="/app">
                <Button data-testid="button-cta-access">
                  Get access
                </Button>
              </SignUpButton>
            </SignedOut>
            
            <SignedIn>
              <Link href="/app">
                <Button data-testid="button-cta-dashboard">
                  Enter dashboard
                </Button>
              </Link>
            </SignedIn>

            <Link href="/methodology">
              <Button variant="outline" data-testid="button-cta-methodology">
                View methodology
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50" data-testid="footer">
        <div className="mx-auto max-w-content px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <span>Not financial advice. Options involve risk.</span>
            <div className="flex gap-4">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/risk-disclosure" className="hover:text-foreground transition-colors">Risk Disclosure</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
