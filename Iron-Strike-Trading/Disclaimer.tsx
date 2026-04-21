import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { AlertTriangle, FileText, Shield, Scale } from "lucide-react";

export default function Disclaimer() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="page-title">Legal Disclaimer</h1>
            <p className="text-sm text-muted-foreground">
              Important legal information regarding use of this platform
            </p>
          </div>
        </div>

        <Card className="border-amber-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle>Not Financial Advice</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The information, signals, and analysis provided by Iron Strike Trading ("the Platform") 
              are for educational and informational purposes only. Nothing on this Platform constitutes 
              financial advice, investment advice, trading advice, or any other sort of advice.
            </p>
            <p>
              The Platform's AI-generated signals, market analysis, and trading recommendations should 
              not be construed as a recommendation to buy, sell, or hold any financial instrument. 
              You should not treat any of the Platform's content as such.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Warning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Options trading involves substantial risk of loss 
              and is not suitable for all investors.</strong> Past performance is not indicative of 
              future results. You could lose all of your invested capital.
            </p>
            <p>Key risks include:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Time decay (theta) can erode option value quickly</li>
              <li>Options can expire worthless, resulting in 100% loss of premium</li>
              <li>Leverage amplifies both gains and losses</li>
              <li>Market volatility can cause rapid price swings</li>
              <li>Liquidity risk may prevent timely exits</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI and Algorithmic Limitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The Platform uses artificial intelligence and machine learning algorithms to generate 
              trading signals. These systems have inherent limitations:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI models are trained on historical data and may not predict future events</li>
              <li>Market conditions can change in ways not captured by the model</li>
              <li>Technical indicators may give false signals in unusual market conditions</li>
              <li>The system may experience errors, downtime, or produce incorrect outputs</li>
              <li>Confidence scores are estimates and do not guarantee outcomes</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>No Guarantee of Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              The Platform makes no guarantees or warranties regarding:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>The accuracy, completeness, or timeliness of any information</li>
              <li>The performance of any signals or recommendations</li>
              <li>The results that may be obtained from using the Platform</li>
              <li>The availability or uninterrupted operation of the Platform</li>
            </ul>
            <p>
              Any testimonials, performance metrics, or backtesting results shown are for 
              illustrative purposes only and do not represent actual user results.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Responsibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              You are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>All trading and investment decisions you make</li>
              <li>Conducting your own research and due diligence</li>
              <li>Understanding the risks involved in options trading</li>
              <li>Consulting with qualified financial professionals</li>
              <li>Ensuring compliance with applicable laws and regulations</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              To the maximum extent permitted by law, the Platform and its operators shall not be 
              liable for any direct, indirect, incidental, special, consequential, or punitive 
              damages arising out of or relating to your use of the Platform or any trading 
              decisions made based on information provided by the Platform.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link href="/risk-disclosure">
            <Badge variant="outline" className="cursor-pointer hover-elevate px-4 py-2">
              <Shield className="h-3 w-3 mr-1" />
              Risk Disclosure
            </Badge>
          </Link>
          <Link href="/terms">
            <Badge variant="outline" className="cursor-pointer hover-elevate px-4 py-2">
              <Scale className="h-3 w-3 mr-1" />
              Terms of Service
            </Badge>
          </Link>
          <Link href="/methodology">
            <Badge variant="outline" className="cursor-pointer hover-elevate px-4 py-2">
              <FileText className="h-3 w-3 mr-1" />
              Methodology
            </Badge>
          </Link>
        </div>
      </div>
    </div>
  );
}
