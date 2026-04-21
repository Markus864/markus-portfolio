/**
 * Centralized support utilities for Iron Strike Trading
 * Single source of truth for ticket formatting, support portal URL, and support issue detection
 */

/**
 * Freshdesk customer support portal URL
 * Used consistently across Discord bot, Telegram bot, and web UI
 */
export const SUPPORT_PORTAL_URL = "https://ironstriketrading.freshdesk.com/en/support/home";

/**
 * Ticket number offset for IST format
 * Freshdesk ID 1 becomes IST-1001
 */
export const TICKET_NUMBER_OFFSET = 1000;

/**
 * Formats a Freshdesk ticket ID to the IST display format
 * @param freshdeskId - The raw Freshdesk ticket ID
 * @returns Formatted ticket number (e.g., "IST-1001")
 * @throws Error if freshdeskId is not a valid positive number
 */
export function formatTicketNumber(freshdeskId: number): string {
  if (typeof freshdeskId !== 'number' || isNaN(freshdeskId) || freshdeskId < 1) {
    throw new Error(`Invalid Freshdesk ID: ${freshdeskId}. Must be a positive number.`);
  }
  return `IST-${freshdeskId + TICKET_NUMBER_OFFSET}`;
}

/**
 * Safe version of formatTicketNumber that returns a fallback instead of throwing
 * Suitable for UI contexts where we don't want to crash on bad data
 * @param freshdeskId - The raw Freshdesk ticket ID
 * @param fallback - Fallback value if formatting fails (default: "IST-UNKNOWN")
 * @returns Formatted ticket number or fallback
 */
export function formatTicketNumberSafe(freshdeskId: number | null | undefined, fallback: string = "IST-UNKNOWN"): string {
  try {
    if (freshdeskId === null || freshdeskId === undefined) {
      return fallback;
    }
    return formatTicketNumber(freshdeskId);
  } catch {
    return fallback;
  }
}

/**
 * Keywords that indicate a support issue
 * Grouped by category for maintainability
 * 
 * Note: Some keywords require context to avoid false positives:
 * - "upgrade" alone could be about trading strategies, so it's paired with billing context
 * - "issue" could be about market issues, so we require additional context
 */
const SUPPORT_KEYWORDS = {
  bugs: ['bug', 'error', 'crash', 'not working', 'broken', 'fails', 'failed', 'glitch', 'freeze', 'stuck'],
  negation: ["cant", "can't", "won't", "doesn't", "didnt", "didn't", "wont", "cannot", "unable to login", "unable to access"],
  auth: ['login failed', 'sign in failed', 'signin failed', 'log in failed', 'account locked', 'password reset', 'locked out', 'verification failed', '2fa', 'otp', 'authenticate'],
  billing: ['billing', 'subscription', 'payment', 'charge', 'refund', 'cancel subscription', 'upgrade plan', 'downgrade plan', 'invoice', 'receipt', 'charged'],
  access: ['access denied', 'permission denied', 'blocked', 'restricted', 'expired', 'disabled account'],
  helpRequest: ['help me', 'support ticket', 'customer service', 'contact support', 'need help with', 'please help', 'urgent issue']
};

/**
 * High-confidence keywords that alone indicate support need
 * These don't require additional context
 */
const HIGH_CONFIDENCE_KEYWORDS = [
  'bug', 'error', 'crash', 'refund', 'billing', 'payment failed', 
  'cant login', "can't login", 'account locked', 'support ticket',
  'customer service', 'locked out', '2fa', 'otp'
];

/**
 * Result of support issue detection
 */
export interface SupportIssueResult {
  isSupport: boolean;
  reason: string;
  matched: string[];
  category?: string;
}

/**
 * Detects if a message indicates a support issue that should be routed to ticket creation
 * Uses high-confidence keywords for immediate detection, otherwise requires multiple matches
 * @param message - User message to analyze
 * @returns Detection result with reason and matched keywords
 */
export function isSupportIssue(message: string): SupportIssueResult {
  if (!message || typeof message !== 'string') {
    return { isSupport: false, reason: 'Empty or invalid message', matched: [] };
  }

  const lowerMessage = message.toLowerCase();
  const matched: string[] = [];
  let category: string | undefined;
  let highConfidenceMatch = false;

  // First check for high-confidence keywords (single match is enough)
  for (const keyword of HIGH_CONFIDENCE_KEYWORDS) {
    if (lowerMessage.includes(keyword)) {
      matched.push(keyword);
      highConfidenceMatch = true;
    }
  }

  // Then check category keywords
  for (const [cat, keywords] of Object.entries(SUPPORT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword) && !matched.includes(keyword)) {
        matched.push(keyword);
        if (!category) {
          category = cat;
        }
      }
    }
  }

  // Require high-confidence match OR multiple category matches to reduce false positives
  const isSupport = highConfidenceMatch || matched.length >= 2;

  if (isSupport && matched.length > 0) {
    const categoryLabels: Record<string, string> = {
      bugs: 'technical issue detected',
      negation: 'functionality problem detected',
      auth: 'account/authentication issue detected',
      billing: 'billing/subscription issue detected',
      access: 'access issue detected',
      helpRequest: 'explicit support request'
    };

    return {
      isSupport: true,
      reason: categoryLabels[category!] || 'support keywords detected',
      matched: Array.from(new Set(matched)),
      category
    };
  }

  return { isSupport: false, reason: 'No support indicators found', matched: [] };
}

/**
 * Generates a standardized support guidance response
 * @param detectionResult - Result from isSupportIssue()
 * @returns Formatted guidance message for the user
 */
export function generateSupportGuidance(detectionResult: SupportIssueResult): string {
  if (!detectionResult.isSupport) {
    return '';
  }

  return `It looks like you may need support (${detectionResult.reason}). Please open a ticket with /ticket and you can also visit the Support Portal: ${SUPPORT_PORTAL_URL}`;
}

/**
 * Standard error response when ticket creation fails
 * @param error - Optional error message for logging (not exposed to user)
 * @returns User-friendly error message with portal link
 */
export function getTicketCreationErrorMessage(): string {
  return `Unable to create support ticket at this time. Please visit the Support Portal to submit your request manually: ${SUPPORT_PORTAL_URL}`;
}
