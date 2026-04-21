/**
 * Unit tests for shared/support-utils.ts
 * Run with: npx tsx shared/support-utils.test.ts
 */

import {
  formatTicketNumber,
  formatTicketNumberSafe,
  SUPPORT_PORTAL_URL,
  TICKET_NUMBER_OFFSET,
  isSupportIssue,
  generateSupportGuidance,
  getTicketCreationErrorMessage,
} from './support-utils';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || 'Expected true but got false');
  }
}

function assertThrows(fn: () => void, message?: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw but it did not');
  }
}

console.log('\n=== formatTicketNumber Tests ===\n');

test('formatTicketNumber: ticket 1 returns IST-1001', () => {
  assertEqual(formatTicketNumber(1), 'IST-1001');
});

test('formatTicketNumber: ticket 9 returns IST-1009', () => {
  assertEqual(formatTicketNumber(9), 'IST-1009');
});

test('formatTicketNumber: ticket 1010 returns IST-2010 (sanity)', () => {
  assertEqual(formatTicketNumber(1010), 'IST-2010');
});

test('formatTicketNumber: ticket 100 returns IST-1100', () => {
  assertEqual(formatTicketNumber(100), 'IST-1100');
});

test('formatTicketNumber: throws for 0', () => {
  assertThrows(() => formatTicketNumber(0));
});

test('formatTicketNumber: throws for negative numbers', () => {
  assertThrows(() => formatTicketNumber(-1));
});

test('formatTicketNumber: throws for NaN', () => {
  assertThrows(() => formatTicketNumber(NaN));
});

test('formatTicketNumber: throws for non-number input', () => {
  assertThrows(() => formatTicketNumber('5' as any));
});

console.log('\n=== formatTicketNumberSafe Tests ===\n');

test('formatTicketNumberSafe: returns formatted number for valid input', () => {
  assertEqual(formatTicketNumberSafe(5), 'IST-1005');
});

test('formatTicketNumberSafe: returns fallback for null', () => {
  assertEqual(formatTicketNumberSafe(null), 'IST-UNKNOWN');
});

test('formatTicketNumberSafe: returns fallback for undefined', () => {
  assertEqual(formatTicketNumberSafe(undefined), 'IST-UNKNOWN');
});

test('formatTicketNumberSafe: returns custom fallback', () => {
  assertEqual(formatTicketNumberSafe(null, 'CUSTOM'), 'CUSTOM');
});

console.log('\n=== Constants Tests ===\n');

test('SUPPORT_PORTAL_URL is correct Freshdesk URL', () => {
  assertEqual(SUPPORT_PORTAL_URL, 'https://ironstriketrading.freshdesk.com/en/support/home');
});

test('TICKET_NUMBER_OFFSET is 1000', () => {
  assertEqual(TICKET_NUMBER_OFFSET, 1000);
});

console.log('\n=== isSupportIssue Tests (Positive Cases) ===\n');

test('isSupportIssue: detects "I can\'t login" (high-confidence)', () => {
  const result = isSupportIssue("I can't login to my account");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes("can't login"), 'Should match can\'t login keyword');
});

test('isSupportIssue: detects "payment failed" (high-confidence)', () => {
  const result = isSupportIssue("My payment failed");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('payment failed'), 'Should match payment failed keyword');
});

test('isSupportIssue: detects "bug in dashboard" (high-confidence)', () => {
  const result = isSupportIssue("There is a bug in the dashboard");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('bug'), 'Should match bug keyword');
});

test('isSupportIssue: detects billing issues (high-confidence)', () => {
  const result = isSupportIssue("I need a refund for my subscription");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('refund') || result.matched.includes('billing'), 'Should match billing keywords');
});

test('isSupportIssue: detects error messages (high-confidence)', () => {
  const result = isSupportIssue("I keep getting an error when I try to generate signals");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('error'), 'Should match error keyword');
});

test('isSupportIssue: detects account locked (high-confidence)', () => {
  const result = isSupportIssue("My account is locked out");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('account locked') || result.matched.includes('locked out'), 'Should match account locked keywords');
});

test('isSupportIssue: detects 2FA issues (high-confidence)', () => {
  const result = isSupportIssue("I lost access to my 2fa");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('2fa'), 'Should match 2fa keyword');
});

test('isSupportIssue: detects customer service request (high-confidence)', () => {
  const result = isSupportIssue("I need to speak with customer service");
  assertTrue(result.isSupport, 'Should detect as support issue');
  assertTrue(result.matched.includes('customer service'), 'Should match customer service keyword');
});

console.log('\n=== isSupportIssue Tests (Negative Cases) ===\n');

test('isSupportIssue: "what is RSI?" is not support', () => {
  const result = isSupportIssue("What is RSI?");
  assertTrue(!result.isSupport, 'Should NOT detect as support issue');
});

test('isSupportIssue: "how do options work?" is not support', () => {
  const result = isSupportIssue("How do options work?");
  assertTrue(!result.isSupport, 'Should NOT detect as support issue');
});

test('isSupportIssue: trading questions are not support', () => {
  const result = isSupportIssue("What's the best strike price for AAPL calls?");
  assertTrue(!result.isSupport, 'Should NOT detect as support issue');
});

test('isSupportIssue: market questions are not support', () => {
  const result = isSupportIssue("Is the market going up or down tomorrow?");
  assertTrue(!result.isSupport, 'Should NOT detect as support issue');
});

test('isSupportIssue: "upgrade strategy" is not support (false positive check)', () => {
  const result = isSupportIssue("How can I upgrade my trading strategy?");
  assertTrue(!result.isSupport, 'Should NOT detect as support issue - upgrade alone is about trading');
});

test('isSupportIssue: single generic keyword does not trigger support', () => {
  const result = isSupportIssue("I have a question about subscription options");
  // subscription alone with no other billing context should not trigger
  assertTrue(!result.isSupport, 'Should NOT detect single generic keyword as support');
});

console.log('\n=== isSupportIssue Tests (Edge Cases) ===\n');

test('isSupportIssue: empty string returns false', () => {
  const result = isSupportIssue('');
  assertTrue(!result.isSupport, 'Empty string should not be support');
});

test('isSupportIssue: very long message with high-confidence keyword still works', () => {
  const longMessage = 'This is a very long message '.repeat(100) + ' and I have a bug in the dashboard';
  const result = isSupportIssue(longMessage);
  assertTrue(result.isSupport, 'Long message with high-confidence keyword should detect');
});

test('isSupportIssue: handles null gracefully', () => {
  const result = isSupportIssue(null as any);
  assertTrue(!result.isSupport, 'Null should return false');
});

test('isSupportIssue: handles undefined gracefully', () => {
  const result = isSupportIssue(undefined as any);
  assertTrue(!result.isSupport, 'Undefined should return false');
});

console.log('\n=== generateSupportGuidance Tests ===\n');

test('generateSupportGuidance: includes /ticket recommendation', () => {
  const result = isSupportIssue("I have a bug in my account");
  const guidance = generateSupportGuidance(result);
  assertTrue(guidance.includes('/ticket'), 'Should recommend /ticket command');
});

test('generateSupportGuidance: includes portal URL', () => {
  const result = isSupportIssue("I have a bug in my account");
  const guidance = generateSupportGuidance(result);
  assertTrue(guidance.includes(SUPPORT_PORTAL_URL), 'Should include support portal URL');
});

test('generateSupportGuidance: returns empty for non-support', () => {
  const result = isSupportIssue("What is RSI?");
  const guidance = generateSupportGuidance(result);
  assertEqual(guidance, '', 'Should return empty string for non-support');
});

console.log('\n=== getTicketCreationErrorMessage Tests ===\n');

test('getTicketCreationErrorMessage: includes portal URL', () => {
  const message = getTicketCreationErrorMessage();
  assertTrue(message.includes(SUPPORT_PORTAL_URL), 'Should include support portal URL');
});

// Summary
console.log('\n=== Test Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nAll tests passed!');
  process.exit(0);
}
