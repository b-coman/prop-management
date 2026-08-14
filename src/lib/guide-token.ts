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

// Base62 rather than hex: 5.95 bits per character instead of 4, so eight
// characters carry the same ~48 bits that twelve hex characters would. That is
// far more than this needs - an attacker must already hold the booking's
// 20-character random id before a token is worth guessing at all - and it keeps
// the whole link short enough to sit on one line of a WhatsApp message.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const TOKEN_LENGTH = 8;

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

function digest(bookingId: string, identity: string): Buffer {
  const payload = `${DOMAIN}:${bookingId}:${identity.toLowerCase().trim()}`;
  return createHmac('sha256', getSecret()).update(payload).digest();
}

function digestHex(bookingId: string, identity: string): string {
  return digest(bookingId, identity).toString('hex');
}

/**
 * Generate the token for a guest guide URL.
 */
export function generateGuideToken(bookingId: string, identity = ''): string {
  // Six bytes of the digest is 48 bits, which stays exact in a double (< 2^53),
  // so this needs no BigInt and works on the project's ES2017 target.
  const bytes = digest(bookingId, identity);
  let n = 0;
  for (let i = 0; i < 6; i++) n = n * 256 + bytes[i];

  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out = ALPHABET[n % 62] + out;
    n = Math.floor(n / 62);
  }
  return out;
}

function matches(expected: string, token: string): boolean {
  if (expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

/**
 * Validate a guide token using timing-safe comparison.
 *
 * Accepts the full 64-character hex token as well, so links already sent to
 * guests keep working. Old links stay valid until they expire on their own.
 */
export function validateGuideToken(bookingId: string, identity: string, token: string): boolean {
  if (!token) return false;
  if (matches(generateGuideToken(bookingId, identity), token)) return true;
  return matches(digestHex(bookingId, identity), token);
}

/**
 * Build the guest guide path. Callers supply their own origin — in the browser
 * use `window.location.origin`; on the server prefer the request host over
 * NEXT_PUBLIC_APP_URL, which is not provisioned in App Hosting.
 */
export function guidePath(bookingId: string, token: string): string {
  return `/g/${bookingId}?t=${token}`;
}
