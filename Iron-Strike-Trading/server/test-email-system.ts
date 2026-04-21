/**
 * ============================================================================
 * IRON STRIKE TRADING - EMAIL SYSTEM TEST SCRIPT
 * ============================================================================
 * 
 * Standalone script to validate AWS SES configuration and sender personas.
 * 
 * USAGE:
 *   npx tsx server/test-email-system.ts <test-email-address>
 * 
 * EXAMPLE:
 *   npx tsx server/test-email-system.ts admin@example.com
 * 
 * PREREQUISITES:
 *   1. AWS SES credentials configured in environment variables
 *   2. Domain verified in AWS SES
 *   3. Sender identities verified (or domain-level verification)
 *   4. If in sandbox mode: recipient email must be verified
 * 
 * ============================================================================
 */

import { EmailService, SenderPersona } from "./email-service";
import { 
  signalAlertTemplate, 
  ticketConfirmationTemplate, 
  transactionalTemplate, 
  priceAlertTemplate 
} from "./email-templates";

async function runTests(testRecipient: string): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("IRON STRIKE EMAIL SYSTEM TEST");
  console.log("=".repeat(60));
  console.log(`\nTest Recipient: ${testRecipient}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const emailService = new EmailService();
  const status = emailService.getConfigurationStatus();

  console.log("Configuration Status:");
  console.log(`  Configured: ${status.configured ? "YES" : "NO"}`);
  if (status.error) {
    console.log(`  Error: ${status.error}`);
  }
  console.log("\nSender Personas:");
  for (const [persona, config] of Object.entries(status.personas)) {
    console.log(`  ${persona}: ${config.email}`);
  }

  if (!status.configured) {
    console.log("\n[ERROR] Email service not configured. Cannot proceed with tests.");
    console.log("\nRequired environment variables:");
    console.log("  - AWS_SES_ACCESS_KEY_ID");
    console.log("  - AWS_SES_SECRET_ACCESS_KEY");
    console.log("  - AWS_SES_REGION (optional, defaults to us-east-1)");
    process.exit(1);
  }

  console.log("\n" + "-".repeat(60));
  console.log("TESTING SENDER PERSONAS");
  console.log("-".repeat(60));

  const results = await emailService.testAllPersonas(testRecipient);
  
  let successCount = 0;
  let failCount = 0;

  for (const [persona, result] of Object.entries(results)) {
    if (result.success) {
      console.log(`\n[PASS] ${persona}`);
      console.log(`       MessageId: ${result.messageId}`);
      successCount++;
    } else {
      console.log(`\n[FAIL] ${persona}`);
      console.log(`       Error: ${result.error}`);
      console.log(`       Code: ${result.errorCode}`);
      failCount++;
    }
  }

  console.log("\n" + "-".repeat(60));
  console.log("TESTING EMAIL TEMPLATES");
  console.log("-".repeat(60));

  const templateTests = [
    {
      name: "Signal Alert Email",
      test: async () => {
        const template = signalAlertTemplate({
          symbol: "AAPL",
          action: "BUY_CALL",
          strike: 195.00,
          expiration: "Dec 27, 2024",
          confidence: 82,
          premium: 3.45,
          stopLoss: 1.73,
          takeProfit: 6.90,
          rationale: "Strong bullish momentum with RSI at 58. Volume surge confirms breakout above key resistance at $192.",
        });
        return emailService.sendSignalAlert(testRecipient, "[TEST] New AAPL Signal", template.html, template.text);
      },
    },
    {
      name: "Ticket Confirmation Email",
      test: async () => {
        const template = ticketConfirmationTemplate({
          ticketNumber: "IS-TEST123456",
          name: "Test User",
          subject: "Test Support Request",
          message: "This is a test message to verify the ticket confirmation email template is working correctly.",
          createdAt: new Date(),
        });
        return emailService.sendSupportEmail(testRecipient, "[TEST] Support Ticket Created - IS-TEST123456", template.html, template.text);
      },
    },
    {
      name: "Transactional Email (Receipt)",
      test: async () => {
        const template = transactionalTemplate({
          title: "Payment Received",
          message: "Thank you for your subscription to Iron Strike Pro. Your payment has been processed successfully.",
          details: {
            "Plan": "Iron Strike Pro",
            "Amount": "$29.00/month",
            "Next Billing": "January 19, 2025",
            "Transaction ID": "TXN-TEST-12345",
          },
          actionUrl: "https://ironstriketrading.com/app/settings",
          actionText: "Manage Subscription",
        });
        return emailService.sendTransactional(testRecipient, "[TEST] Payment Confirmation", template.html, template.text);
      },
    },
    {
      name: "Price Alert Email",
      test: async () => {
        const template = priceAlertTemplate({
          symbol: "NVDA",
          alertType: "above",
          targetPrice: 500.00,
          currentPrice: 502.35,
          triggeredAt: new Date(),
        });
        return emailService.sendSignalAlert(testRecipient, "[TEST] NVDA Price Alert Triggered", template.html, template.text);
      },
    },
  ];

  for (const templateTest of templateTests) {
    try {
      const result = await templateTest.test();
      if (result.success) {
        console.log(`\n[PASS] ${templateTest.name}`);
        console.log(`       MessageId: ${result.messageId}`);
        successCount++;
      } else {
        console.log(`\n[FAIL] ${templateTest.name}`);
        console.log(`       Error: ${result.error}`);
        failCount++;
      }
    } catch (error) {
      console.log(`\n[ERROR] ${templateTest.name}`);
      console.log(`        ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`\nTotal Tests: ${successCount + failCount}`);
  console.log(`Passed: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`\nStatus: ${failCount === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
  console.log("=".repeat(60) + "\n");

  process.exit(failCount > 0 ? 1 : 0);
}

const testEmail = process.argv[2];

if (!testEmail) {
  console.log("\nUsage: npx tsx server/test-email-system.ts <test-email-address>");
  console.log("Example: npx tsx server/test-email-system.ts admin@example.com\n");
  process.exit(1);
}

if (!testEmail.includes("@") || !testEmail.includes(".")) {
  console.log("\nError: Invalid email address format\n");
  process.exit(1);
}

runTests(testEmail).catch((error) => {
  console.error("\nUnexpected error:", error);
  process.exit(1);
});
