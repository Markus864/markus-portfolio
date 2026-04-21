import { Link } from "wouter";
import { TrendingUp, Mail, Shield, FileText, AlertTriangle, Database, BookOpen, HelpCircle } from "lucide-react";
import { SiX } from "react-icons/si";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card/50 mt-auto" data-testid="footer">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-foreground" />
              </div>
              <span className="font-bold text-lg">Iron Strike Trading</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered options trading signals with professional-grade analysis and risk management.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Platform</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/app" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-dashboard">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/app/screener" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-screener">
                  Options Screener
                </Link>
              </li>
              <li>
                <Link href="/app/0dte" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-0dte">
                  0DTE Hub
                </Link>
              </li>
              <li>
                <Link href="/app/live" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-signals">
                  Live Signals
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/app/calculator" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-calculator">
                  Options Calculator
                </Link>
              </li>
              <li>
                <Link href="/app/strategies" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-strategies">
                  Strategies
                </Link>
              </li>
              <li>
                <Link href="/app/news" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-footer-news">
                  Market News
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Legal & Info</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-terms">
                  <FileText className="h-3.5 w-3.5" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-privacy">
                  <Shield className="h-3.5 w-3.5" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/risk-disclosure" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-risk">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Risk Disclosure
                </Link>
              </li>
              <li>
                <Link href="/methodology" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-methodology">
                  <Database className="h-3.5 w-3.5" />
                  Methodology & Data Sources
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-how-it-works">
                  <HelpCircle className="h-3.5 w-3.5" />
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5" data-testid="link-footer-contact">
                  <Mail className="h-3.5 w-3.5" />
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 space-y-4">
          <div className="bg-muted border border-border rounded-lg p-4" data-testid="disclaimer-banner">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-amber-400 text-sm">
                  Educational Purposes Only - Not Financial Advice
                </p>
                <p className="text-xs text-muted-foreground">
                  Iron Strike Beta is an experimental AI-powered trading signal generator for educational and informational purposes only. 
                  The signals, analysis, and recommendations provided do not constitute investment advice, financial advice, or trading advice. 
                  Options trading involves substantial risk of loss and is not suitable for all investors. 
                  Past performance is not indicative of future results. Always consult with a qualified financial advisor before making investment decisions.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <p className="text-xs text-muted-foreground">
                &copy; {currentYear} Iron Strike Trading. All rights reserved.
              </p>
              <span className="text-xs text-muted-foreground/50">|</span>
              <span className="text-xs text-amber-500 font-medium">Beta v0.1.0</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://x.com/iron_strike_ai" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-twitter"
              >
                <SiX className="h-4 w-4" />
              </a>
              <Link 
                href="/changelog" 
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-changelog"
              >
                Changelog
              </Link>
              <a 
                href="mailto:feedback@ironstrike.app?subject=Iron Strike Beta Feedback" 
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-feedback"
              >
                Send Feedback
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
