/**
 * ============================================================================
 * IRON STRIKE TRADING - ENTERPRISE EMAIL SERVICE
 * ============================================================================
 * 
 * AWS SES Email Notification System with Sender Persona Management
 * 
 * REQUIRED DNS RECORDS FOR AWS SES VERIFICATION (Add to Cloudflare):
 * ============================================================================
 * 
 * 1. DOMAIN VERIFICATION (TXT Record):
 *    Name: _amazonses.ironstriketrading.com
 *    Type: TXT
 *    Value: [Get from AWS SES Console after domain verification request]
 * 
 * 2. DKIM RECORDS (CNAME Records - 3 required):
 *    Name: [selector1]._domainkey.ironstriketrading.com
 *    Type: CNAME
 *    Value: [selector1].dkim.amazonses.com
 *    
 *    Name: [selector2]._domainkey.ironstriketrading.com
 *    Type: CNAME
 *    Value: [selector2].dkim.amazonses.com
 *    
 *    Name: [selector3]._domainkey.ironstriketrading.com
 *    Type: CNAME
 *    Value: [selector3].dkim.amazonses.com
 * 
 * 3. SPF RECORD (TXT Record):
 *    Name: ironstriketrading.com (or @)
 *    Type: TXT
 *    Value: "v=spf1 include:amazonses.com ~all"
 * 
 * 4. DMARC RECORD (TXT Record - Recommended):
 *    Name: _dmarc.ironstriketrading.com
 *    Type: TXT
 *    Value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@ironstriketrading.com"
 * 
 * 5. MAIL FROM DOMAIN (Optional but recommended):
 *    Name: mail.ironstriketrading.com
 *    Type: MX
 *    Value: 10 feedback-smtp.us-east-1.amazonses.com
 *    
 *    Name: mail.ironstriketrading.com
 *    Type: TXT
 *    Value: "v=spf1 include:amazonses.com ~all"
 * 
 * REQUIRED ENVIRONMENT VARIABLES (in priority order):
 * Standard AWS SDK names (recommended):
 * - AWS_ACCESS_KEY_ID: IAM user access key with SES permissions
 * - AWS_SECRET_ACCESS_KEY: IAM user secret key
 * - AWS_REGION: AWS region (e.g., us-east-1)
 * 
 * SES-specific fallback names (legacy support):
 * - AWS_SES_ACCESS_KEY_ID: Fallback for access key
 * - AWS_SES_SECRET_ACCESS_KEY: Fallback for secret key
 * - AWS_SES_REGION: Fallback for region
 * 
 * ============================================================================
 */

import { SESClient, SendEmailCommand, SendEmailCommandInput, MessageRejected } from "@aws-sdk/client-ses";

export type SenderPersona = "SIGNAL_ALERT" | "TRANSACTIONAL" | "SUPPORT" | "MARKETING";

export interface SenderConfig {
  email: string;
  name: string;
  replyTo?: string;
  description: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  persona: SenderPersona;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

const SENDER_PERSONAS: Record<SenderPersona, SenderConfig> = {
  SIGNAL_ALERT: {
    email: "alerts@ironstriketrading.com",
    name: "Iron Strike Alerts",
    description: "High-priority trading signals and price alerts (No-Reply)",
  },
  TRANSACTIONAL: {
    email: "noreply@ironstriketrading.com",
    name: "Iron Strike Trading",
    description: "Authentication, receipts, security notifications",
  },
  SUPPORT: {
    email: "support@ironstriketrading.com",
    name: "Iron Strike Support",
    replyTo: "support@ironstriketrading.com",
    description: "Customer support and ticket responses",
  },
  MARKETING: {
    email: "newsletter@ironstriketrading.com",
    name: "Iron Strike Newsletter",
    description: "Newsletters, announcements, promotional content",
  },
};

/**
 * ECS/SES Environment Guardrails
 * Alerts are only sent in production when explicitly enabled.
 * This prevents accidental email sending in development/staging.
 */
const isProductionEnvironment = (): boolean => {
  const env = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  return env === 'production';
};

const areAlertsEnabled = (): boolean => {
  return process.env.ENABLE_ALERTS === 'true';
};

const canSendAlerts = (): boolean => {
  return isProductionEnvironment() && areAlertsEnabled();
};

export class EmailService {
  private client: SESClient | null = null;
  private initialized = false;
  private initError: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Check if alert emails can be sent (production + ENABLE_ALERTS=true)
   */
  public canSendAlertEmails(): boolean {
    return canSendAlerts() && this.isConfigured();
  }

  /**
   * Get environment status for debugging
   */
  public getEnvironmentStatus(): { 
    environment: string; 
    alertsEnabled: boolean; 
    canSendAlerts: boolean;
    isProduction: boolean;
  } {
    return {
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
      alertsEnabled: areAlertsEnabled(),
      canSendAlerts: canSendAlerts(),
      isProduction: isProductionEnvironment(),
    };
  }

  private initialize(): void {
    // Check standard AWS SDK env vars first, with SES-prefixed fallback for legacy support
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SES_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SES_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || process.env.AWS_SES_REGION || "us-east-1";

    // Log which credential source is being used
    const credSource = process.env.AWS_ACCESS_KEY_ID ? "standard AWS SDK" : 
                       process.env.AWS_SES_ACCESS_KEY_ID ? "SES-specific" : "none";

    if (!accessKeyId || !secretAccessKey) {
      this.initError = "AWS SES credentials not configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (recommended) or AWS_SES_ACCESS_KEY_ID/AWS_SES_SECRET_ACCESS_KEY (legacy).";
      console.warn(`[EmailService] ${this.initError}`);
      return;
    }

    try {
      this.client = new SESClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.initialized = true;
      console.log(`[EmailService] Initialized successfully for region: ${region} (credentials: ${credSource})`);
    } catch (error) {
      this.initError = `Failed to initialize SES client: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[EmailService] ${this.initError}`);
    }
  }

  public isConfigured(): boolean {
    return this.initialized && this.client !== null;
  }

  public getConfigurationStatus(): { configured: boolean; error: string | null; personas: Record<SenderPersona, SenderConfig> } {
    return {
      configured: this.isConfigured(),
      error: this.initError,
      personas: SENDER_PERSONAS,
    };
  }

  public getSenderConfig(persona: SenderPersona): SenderConfig {
    return SENDER_PERSONAS[persona];
  }

  public formatSender(persona: SenderPersona): string {
    const config = SENDER_PERSONAS[persona];
    return `${config.name} <${config.email}>`;
  }

  /**
   * Determines the appropriate Reply-To address based on sender persona.
   * 
   * Logic:
   * - SIGNAL_ALERT: Route replies to support for follow-up questions
   * - MARKETING: Route replies to support for engagement tracking
   * - TRANSACTIONAL: No-reply address (or blank) to discourage responses
   * - SUPPORT: Direct reply to support team
   */
  private getReplyToForPersona(persona: SenderPersona, explicitReplyTo?: string): string[] | undefined {
    // Explicit replyTo always takes precedence
    if (explicitReplyTo) {
      return [explicitReplyTo];
    }

    switch (persona) {
      case "SIGNAL_ALERT":
      case "MARKETING":
        // Route to support so users can ask follow-up questions
        return ["support@ironstriketrading.com"];
      case "TRANSACTIONAL":
        // Strictly no-reply - don't set Reply-To to discourage responses
        // AWS SES will use the From address as default if not set
        return ["noreply@ironstriketrading.com"];
      case "SUPPORT":
        // Direct support replies
        return ["support@ironstriketrading.com"];
      default:
        return undefined;
    }
  }

  public async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const { to, subject, html, text, persona, replyTo } = options;

    if (!this.initialized || !this.client) {
      console.error(`[EmailService] Cannot send email: ${this.initError || "Not initialized"}`);
      return {
        success: false,
        error: this.initError || "Email service not initialized",
        errorCode: "NOT_INITIALIZED",
      };
    }

    // ECS/SES Guardrail: Block alert emails in non-production or when alerts are disabled
    if (persona === "SIGNAL_ALERT" && !canSendAlerts()) {
      const envStatus = this.getEnvironmentStatus();
      console.warn(`[EmailService] Alert email blocked: environment=${envStatus.environment}, alertsEnabled=${envStatus.alertsEnabled}`);
      return {
        success: false,
        error: "Alert emails are only sent in production with ENABLE_ALERTS=true",
        errorCode: "ALERTS_DISABLED",
      };
    }

    const senderConfig = SENDER_PERSONAS[persona];
    const recipients = Array.isArray(to) ? to : [to];
    
    // Use persona-based Reply-To logic
    const replyToAddresses = this.getReplyToForPersona(persona, replyTo);

    const params: SendEmailCommandInput = {
      Source: this.formatSender(persona),
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: subject,
        },
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: html,
          },
          ...(text && {
            Text: {
              Charset: "UTF-8",
              Data: text,
            },
          }),
        },
      },
      ReplyToAddresses: replyToAddresses,
    };

    try {
      console.log(`[EmailService] Sending ${persona} email to ${recipients.join(", ")}: "${subject}"`);
      const command = new SendEmailCommand(params);
      const response = await this.client.send(command);

      console.log(`[EmailService] Email sent successfully. MessageId: ${response.MessageId}`);
      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorCode = "UNKNOWN_ERROR";

      if (error instanceof MessageRejected) {
        errorCode = "MESSAGE_REJECTED";
        console.error(`[EmailService] MESSAGE REJECTED: ${errorMessage}`);
      } else if (errorMessage.includes("Throttling")) {
        errorCode = "THROTTLING";
        console.error(`[EmailService] THROTTLING: Too many requests. ${errorMessage}`);
      } else if (errorMessage.includes("InvalidParameterValue")) {
        errorCode = "INVALID_PARAMETER";
        console.error(`[EmailService] INVALID PARAMETER: ${errorMessage}`);
      } else if (errorMessage.includes("Email address is not verified")) {
        errorCode = "UNVERIFIED_EMAIL";
        console.error(`[EmailService] UNVERIFIED EMAIL: Sender or recipient not verified in SES. ${errorMessage}`);
      } else if (errorMessage.includes("AccessDenied")) {
        errorCode = "ACCESS_DENIED";
        console.error(`[EmailService] ACCESS DENIED: Check IAM permissions. ${errorMessage}`);
      } else {
        console.error(`[EmailService] ERROR: ${errorMessage}`);
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  public async sendSignalAlert(to: string | string[], subject: string, html: string, text?: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      text,
      persona: "SIGNAL_ALERT",
    });
  }

  public async sendTransactional(to: string | string[], subject: string, html: string, text?: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      text,
      persona: "TRANSACTIONAL",
    });
  }

  public async sendSupportEmail(to: string | string[], subject: string, html: string, text?: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      text,
      persona: "SUPPORT",
    });
  }

  public async sendMarketingEmail(to: string | string[], subject: string, html: string, text?: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject,
      html,
      text,
      persona: "MARKETING",
    });
  }

  public async testAllPersonas(testRecipient: string): Promise<Record<SenderPersona, EmailResult>> {
    const results: Record<SenderPersona, EmailResult> = {} as Record<SenderPersona, EmailResult>;
    const personas: SenderPersona[] = ["SIGNAL_ALERT", "TRANSACTIONAL", "SUPPORT", "MARKETING"];

    for (const persona of personas) {
      const config = SENDER_PERSONAS[persona];
      const result = await this.sendEmail({
        to: testRecipient,
        subject: `[Iron Strike] System Test - ${persona}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10b981;">Iron Strike Email System Test</h2>
            <p><strong>Persona:</strong> ${persona}</p>
            <p><strong>Sender:</strong> ${config.email}</p>
            <p><strong>Description:</strong> ${config.description}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              This is a system test email from Iron Strike Trading.
              If you received this email, the ${persona} sender is configured correctly.
            </p>
          </div>
        `,
        text: `Iron Strike Email System Test\n\nPersona: ${persona}\nSender: ${config.email}\nDescription: ${config.description}\nTimestamp: ${new Date().toISOString()}`,
        persona,
      });
      results[persona] = result;
    }

    return results;
  }
}

export const emailService = new EmailService();
