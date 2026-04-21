import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/clerk-react";
import { Check, X, ArrowLeft, Database, Cpu, ShieldCheck } from "lucide-react";

import logo from "@/assets/iron-strike-trading_primary_dark.png";

/**
 * METHODOLOGY / TRUST PAGE — Precision AI Engine
 * 
 * Title: "Built for discipline, not prediction."
 * Sections: What it does, what it doesn't, risk disclosure, data sources, model philosophy
 * This page builds legitimacy.
 */

const WHAT_WE_DO = [
  "Analyze market data using institutional-grade sources",
  "Generate structured options signals with confidence scores",
  "Calculate position sizes based on premium and risk tolerance",
  "Track performance through adaptive learning systems",
  "Deliver signals to Telegram, Discord, and web dashboard",
  "Provide journaling tools for decision accountability",
];

const WHAT_WE_DO_NOT = [
  "Execute trades on your behalf",
  "Guarantee profits or specific returns",
  "Provide personalized financial advice",
  "Access your brokerage accounts",
  "Know your complete financial situation",
  "Replace professional financial guidance",
];

const DATA_SOURCES = [
  {
    name: "Polygon.io",
    description: "Primary source for real-time quotes, historical OHLCV data, and options Greeks",
    type: "Market Data",
  },
  {
    name: "Tradier",
    description: "Fallback source for quotes and options chain data",
    type: "Market Data",
  },
  {
    name: "OpenAI GPT-4o",
    description: "AI model for market analysis, pattern recognition, and signal generation",
    type: "Analysis Engine",
  },
];

export default function Methodology() {
  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="methodology-container">
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
              <span className="text-sm text-foreground hover:text-foreground transition-colors cursor-pointer">
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
        {/* Hero */}
        <div className="max-w-3xl mb-24">
          <h1 className="text-hero mb-6" data-testid="page-title">
            Built for discipline, not prediction.
          </h1>
          <p className="text-lg text-foreground-secondary" data-testid="page-description">
            Iron Strike is a decision support system, not a crystal ball. 
            We provide analytical tools, structured signals, and accountability infrastructure 
            to help traders act with consistency and precision.
          </p>
        </div>

        {/* What we do / don't do */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
          {/* What we do */}
          <div data-testid="section-what-we-do">
            <h2 className="text-display mb-8">What Iron Strike does</h2>
            <ul className="space-y-4">
              {WHAT_WE_DO.map((item, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-3"
                  data-testid={`do-item-${idx}`}
                >
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground-secondary">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What we don't do */}
          <div data-testid="section-what-we-dont">
            <h2 className="text-display mb-8">What Iron Strike does NOT do</h2>
            <ul className="space-y-4">
              {WHAT_WE_DO_NOT.map((item, idx) => (
                <li 
                  key={idx} 
                  className="flex items-start gap-3"
                  data-testid={`dont-item-${idx}`}
                >
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <span className="text-foreground-secondary">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Risk disclosure */}
        <div className="mb-24 p-8 bg-card border border-border/50 rounded-md" data-testid="section-risk">
          <h2 className="text-display mb-6">Risk Disclosure</h2>
          <div className="space-y-4 text-foreground-secondary max-w-3xl">
            <p>
              Options trading involves significant risk of loss and is not suitable for all investors. 
              Before trading options, please read the 
              <Link href="/risk-disclosure" className="text-primary hover:underline mx-1">
                Characteristics and Risks of Standardized Options
              </Link>
              disclosure document.
            </p>
            <p>
              The signals, analysis, and content provided by Iron Strike are for educational and 
              informational purposes only. They do not constitute financial advice, investment advice, 
              trading advice, or any other sort of advice.
            </p>
            <p>
              Past performance of any signal, strategy, or analysis does not guarantee future results. 
              You should not make any trading decision based solely on signals or analysis provided by 
              this platform. Always conduct your own research and consider seeking advice from a 
              licensed financial advisor.
            </p>
            <p className="font-mono text-sm text-muted-foreground">
              You could lose some or all of your invested capital.
            </p>
          </div>
        </div>

        {/* Data sources */}
        <div className="mb-24" data-testid="section-data-sources">
          <h2 className="text-display mb-8">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DATA_SOURCES.map((source, idx) => (
              <div 
                key={idx}
                className="p-6 bg-card border border-border/50 rounded-md"
                data-testid={`data-source-${idx}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  {idx === 0 && <Database className="w-5 h-5 text-foreground-secondary" />}
                  {idx === 1 && <Database className="w-5 h-5 text-foreground-secondary" />}
                  {idx === 2 && <Cpu className="w-5 h-5 text-foreground-secondary" />}
                  <span className="text-label">{source.type}</span>
                </div>
                <h3 className="font-medium mb-2">{source.name}</h3>
                <p className="text-sm text-muted-foreground">{source.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Model philosophy */}
        <div className="mb-24" data-testid="section-philosophy">
          <h2 className="text-display mb-8">Model Philosophy</h2>
          <div className="max-w-3xl space-y-6 text-foreground-secondary">
            <p>
              Iron Strike is built on a simple premise: <strong className="text-foreground">discipline scales, prediction does not</strong>.
            </p>
            <p>
              Our AI models do not attempt to predict market movements. Instead, they identify 
              structured setups based on technical conditions, assess risk-reward ratios, and 
              generate decision context that helps traders evaluate opportunities systematically.
            </p>
            <p>
              Confidence scores reflect setup quality based on available data and historical 
              calibration — not certainty about future outcomes. The system is designed to 
              improve trader behavior, not to replace trader judgment.
            </p>
            <div className="pt-6 flex items-center gap-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="text-sm">
                Transparency. Accountability. Precision.
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-12 border-t border-border/50">
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

            <Link href="/how-it-works">
              <Button variant="outline" data-testid="button-cta-how-it-works">
                How it works
              </Button>
            </Link>
            
            <Link href="/pricing">
              <Button variant="outline" data-testid="button-cta-pricing">
                View pricing
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
              <Link href="/disclaimer" className="hover:text-foreground transition-colors">Disclaimer</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
