import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error('REVIEW_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate an HMAC-SHA256 token for an unsubscribe URL.
 * Uses 'unsubscribe:' prefix to avoid collision with review tokens.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = getSecret();
  const payload = `unsubscribe:${email.toLowerCase().trim()}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validate an unsubscribe token using timing-safe comparison.
 */
export function validateUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  if (expected.length !== token.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Get the full unsubscribe URL for an email address.
 */
export function getUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(email.toLowerCase().trim())}&token=${token}`;
}
