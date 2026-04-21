import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

export default function Billing() {
  return (
    <div className="max-w-3xl space-y-8" data-testid="billing-container">
      <header>
        <h1 className="text-xl font-semibold" data-testid="text-billing-title">Billing & Account</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-billing-subtitle">
          Manage your subscription and payment details.
        </p>
      </header>

      {/* PLAN */}
      <Card data-testid="card-current-plan">
        <CardHeader>
          <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-plan-header">
            Current Plan
          </h2>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-mono text-foreground" data-testid="text-plan-name">
              Iron Strike Pro
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Billing cycle</span>
            <span className="font-mono text-foreground" data-testid="text-billing-cycle">
              Monthly
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Next renewal</span>
            <span className="font-mono text-foreground" data-testid="text-renewal-date">
              Oct 12, 2025
            </span>
          </div>
        </CardContent>
      </Card>

      {/* PAYMENT METHOD */}
      <Card data-testid="card-payment-method">
        <CardHeader>
          <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-payment-header">
            Payment Method
          </h2>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Card</span>
            <span className="font-mono text-foreground" data-testid="text-card-last4">
              •••• 4242
            </span>
          </div>
          <Button variant="secondary" data-testid="button-update-payment">
            Update payment method
          </Button>
        </CardContent>
      </Card>

      {/* INVOICES */}
      <Card data-testid="card-invoices">
        <CardHeader>
          <h2 className="text-sm font-medium uppercase tracking-wide" data-testid="text-invoices-header">
            Invoices
          </h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between" data-testid="invoice-sep-2025">
            <span className="font-mono">Sep 2025</span>
            <span className="font-mono">$49.00</span>
          </div>
          <div className="flex items-center justify-between" data-testid="invoice-aug-2025">
            <span className="font-mono">Aug 2025</span>
            <span className="font-mono">$49.00</span>
          </div>
          <div className="flex items-center justify-between" data-testid="invoice-jul-2025">
            <span className="font-mono">Jul 2025</span>
            <span className="font-mono">$49.00</span>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ACTIONS */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" data-testid="button-cancel-subscription">
          Cancel subscription
        </Button>
        <Button variant="secondary" data-testid="button-stripe-portal">
          View Stripe portal
        </Button>
      </div>
    </div>
  )
}
