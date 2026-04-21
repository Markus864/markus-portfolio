import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";

export default function Terms() {
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
          <div className="p-3 rounded-lg bg-muted">
            <FileText className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-terms">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </div>
        </div>

        <Card className="max-w-4xl">
          <CardContent className="prose prose-invert max-w-none pt-6 space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Iron Strike Trading ("the Platform"), you agree to be bound by these 
                Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Services</h2>
              <p className="text-muted-foreground">
                Iron Strike Trading provides AI-powered options trading signals, market analysis, and 
                educational tools. Our services include:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>AI-generated trading signals with confidence scores</li>
                <li>Real-time options screening and analysis</li>
                <li>0DTE (Zero Days to Expiration) trading strategies</li>
                <li>Market news and trend analysis</li>
                <li>Options calculators and risk management tools</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
              <p className="text-muted-foreground">
                Users are responsible for:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Maintaining the confidentiality of account credentials</li>
                <li>All activities that occur under their account</li>
                <li>Ensuring compliance with applicable securities laws and regulations</li>
                <li>Making their own investment decisions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Investment Disclaimer</h2>
              <p className="text-muted-foreground">
                The information provided on this platform is for educational and informational purposes only. 
                It does not constitute financial advice, investment advice, trading advice, or any other 
                type of advice. You should not treat any of the platform's content as such.
              </p>
              <p className="text-muted-foreground mt-2">
                Options trading involves substantial risk of loss and is not suitable for all investors. 
                Past performance is not indicative of future results. You should consult with a licensed 
                financial advisor before making any investment decisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Iron Strike Trading and its affiliates shall not be liable for any direct, indirect, 
                incidental, special, consequential, or punitive damages resulting from your use of 
                or inability to use the platform, including but not limited to trading losses.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, features, and functionality of the platform are owned by Iron Strike Trading 
                and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to terminate or suspend your account and access to the platform at 
                our sole discretion, without notice, for conduct that we believe violates these Terms of 
                Service or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. We will notify users of any 
                material changes by posting the new terms on the platform. Your continued use of the 
                platform after such modifications constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact us through our 
                <Link href="/contact" className="text-foreground hover:underline ml-1">Contact page</Link>.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
