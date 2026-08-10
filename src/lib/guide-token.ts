import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Guest guide link tokens.
 *
 * Same stateless scheme as `review-token.ts`: the token is derived from the
 * booking, never stored. Nothing to generate up front, nothing to rotate, and
 * every existing booking gets a working link retroactively.
 *
 * Shares REVIEW_TOKEN_SECRET but prefixes the payload with a domain label, so a
 * review token can never be replayed as a guide token (or the reverse) even
 * though both derive from the same booking.
 *
 * Unlike the review token, the guest identity is OPTIONAL here. Nearly every
 * booking on this platform arrives as an Airbnb/Booking.com import with no email
 * address, and those guests need the guide most. Secrecy comes from the HMAC
 * secret, not from the identity — an identity-less payload is still a 256-bit
 * MAC over a booking id. When an email or phone does exist it gets mixed in, so
 * the link additionally dies if the booking is later re-keyed to another guest.
 */

const DOMAIN = 'guide';

function getSecret(): string {
  const secret = process.env.REVIEW_TOKEN_SECRET;
  if (!secret) {
    throw new Error('REVIEW_TOKEN_SECRET environment variable is not set');
  }
  return secret;
}

/**
 * Pick the identity component for a booking's token. Generation and validation
 * MUST agree, so both sides call this rather than reaching into guestInfo.
 */
export function guideIdentity(guestInfo?: { email?: string | null; phone?: string | null } | null): string {
  const raw = guestInfo?.email || guestInfo?.phone || '';
  return raw.toLowerCase().trim();
}

/**
 * Generate an HMAC-SHA256 token for a guest guide URL.
 */
export function generateGuideToken(bookingId: string, identity = ''): string {
  const secret = getSecret();
  const payload = `${DOMAIN}:${bookingId}:${identity.toLowerCase().trim()}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validate a guide token using timing-safe comparison.
 */
export function validateGuideToken(bookingId: string, identity: string, token: string): boolean {
  const expected = generateGuideToken(bookingId, identity);
  if (expected.length !== token.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Build the guest guide path. Callers supply their own origin — in the browser
 * use `window.location.origin`; on the server prefer the request host over
 * NEXT_PUBLIC_APP_URL, which is not provisioned in App Hosting.
 */
export function guidePath(bookingId: string, token: string): string {
  return `/guide/${bookingId}?t=${token}`;
}
