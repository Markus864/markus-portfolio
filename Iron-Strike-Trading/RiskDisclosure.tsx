import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function RiskDisclosure() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-risk">Risk Disclosure</h1>
            <p className="text-muted-foreground">Important information about trading risks</p>
          </div>
        </div>

        <Alert variant="destructive" className="max-w-4xl mb-6 border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-amber-500">Important Warning</AlertTitle>
          <AlertDescription className="text-amber-200/80">
            Options trading involves substantial risk of loss and is not suitable for all investors. 
            You could lose your entire investment in a relatively short period of time.
          </AlertDescription>
        </Alert>

        <Card className="max-w-4xl">
          <CardContent className="prose prose-invert max-w-none pt-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Understanding Options Risk</h2>
              <p className="text-muted-foreground">
                Options are complex financial instruments that carry significant risks. Before trading 
                options, you should understand the following:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>You can lose 100% of your investment in options</li>
                <li>Options have expiration dates and can become worthless</li>
                <li>Leverage magnifies both gains and losses</li>
                <li>Time decay works against option buyers</li>
                <li>Implied volatility changes can significantly impact option prices</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">0DTE (Zero Days to Expiration) Risks</h2>
              <p className="text-muted-foreground">
                0DTE options carry additional and amplified risks:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Extreme time decay - options lose value rapidly</li>
                <li>High gamma risk - prices can move violently</li>
                <li>Wide bid-ask spreads during volatile periods</li>
                <li>Liquidity risk - difficulty exiting positions</li>
                <li>Pin risk near strike prices at expiration</li>
                <li>Assignment risk for short options</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">AI-Generated Signals Disclaimer</h2>
              <p className="text-muted-foreground">
                The AI-generated trading signals provided by Iron Strike Trading are for informational 
                and educational purposes only. Important considerations:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>AI models can make errors and provide incorrect predictions</li>
                <li>Past performance of signals does not guarantee future results</li>
                <li>Market conditions can change rapidly, making signals obsolete</li>
                <li>Signals should be used as one of many factors in your decision-making</li>
                <li>Never trade based solely on AI-generated recommendations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Market Data Risks</h2>
              <p className="text-muted-foreground">
                The market data displayed on our platform may have limitations:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Data may be delayed (typically 15-20 minutes for free tier)</li>
                <li>Quotes may not reflect actual execution prices</li>
                <li>Technical glitches can cause incorrect data display</li>
                <li>Third-party data providers may have outages</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Financial Responsibility</h2>
              <p className="text-muted-foreground">
                You are solely responsible for your trading decisions and financial outcomes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Only trade with money you can afford to lose</li>
                <li>Never use funds needed for essential expenses</li>
                <li>Consider your overall financial situation before trading</li>
                <li>Maintain an emergency fund separate from trading capital</li>
                <li>Set strict position sizing and risk management rules</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Seek Professional Advice</h2>
              <p className="text-muted-foreground">
                Before making any investment decisions, we strongly recommend:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Consulting with a licensed financial advisor</li>
                <li>Understanding your personal risk tolerance</li>
                <li>Reviewing your investment objectives</li>
                <li>Considering your tax situation</li>
                <li>Paper trading before using real money</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">No Guarantee of Accuracy</h2>
              <p className="text-muted-foreground">
                While Iron Strike strives to provide accurate and timely information, we make no 
                warranties or representations regarding the accuracy, completeness, or reliability 
                of any information provided. Signal confidence scores reflect internal quality 
                assessments, not probabilities of profit.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Hypothetical Performance Limitations</h2>
              <p className="text-muted-foreground">
                Any performance metrics, backtesting results, or analytics shown are based on 
                historical data and hypothetical scenarios. Key limitations include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Hypothetical results do not represent actual trading</li>
                <li>Past performance is not indicative of future results</li>
                <li>Simulated results may not account for market impact, slippage, or execution delays</li>
                <li>Historical data quality varies by symbol and time period</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">No Fiduciary Duty</h2>
              <p className="text-muted-foreground">
                Iron Strike does not owe you a fiduciary duty. We do not act as your financial 
                advisor, broker, or investment manager. Our platform provides tools and information, 
                but all trading decisions and their consequences are solely your responsibility.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Regulatory Information</h2>
              <p className="text-muted-foreground">
                Iron Strike Trading is an educational and analytical tool. We are not:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>A registered broker-dealer</li>
                <li>A registered investment advisor</li>
                <li>Licensed to provide personalized investment advice</li>
                <li>Acting in a fiduciary capacity</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Nothing on this platform constitutes a recommendation to buy, sell, or hold any 
                security or financial instrument.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Acknowledgment</h2>
              <p className="text-muted-foreground">
                By using Iron Strike Trading, you acknowledge that you have read, understood, and 
                agree to this Risk Disclosure. You understand that options trading carries substantial 
                risk and that you may lose your entire investment.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
