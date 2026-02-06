import { createHmac, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error('REVIEW_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Generate an HMAC-SHA256 token for a review URL.
 * Token is derived from bookingId + normalized email, ensuring
 * only the original guest can access the review form.
 */
export function generateReviewToken(bookingId: string, email: string): string {
  const secret = getSecret();
  const payload = `${bookingId}:${email.toLowerCase().trim()}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validate a review token using timing-safe comparison.
 */
export function validateReviewToken(bookingId: string, email: string, token: string): boolean {
  const expected = generateReviewToken(bookingId, email);
  if (expected.length !== token.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
