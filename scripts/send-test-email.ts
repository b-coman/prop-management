#!/usr/bin/env npx tsx
/**
 * send-test-email — send ONE guest email, for a real booking, to an address you choose.
 *
 * Renders through the same `loadGuestEmailContext` + pure payload builders as the live send path,
 * so what lands in the inbox is what a guest would receive. Nothing is written to the booking:
 * no `preArrivalSentAt` stamp, no review-request record.
 *
 *   npx tsx scripts/send-test-email.ts <bookingId> <which> <toEmail> [--lang=ro|en]
 *
 *   which: confirmation | pre-arrival | review | return-incentive | seasonal
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const secret = (name: string) =>
  execSync(`gcloud secrets versions access latest --secret=${name} --project=rentalspot-fzwom`, {
    encoding: 'utf8',
  });

// Same reasoning as preview-guest-emails: always take production's value, and do NOT trim it.
// The stored secret ends with a newline and production HMACs over that exact string.
process.env.REVIEW_TOKEN_SECRET = secret('REVIEW_TOKEN_SECRET');
if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = secret('RESEND_API_KEY').trim();

// Match production's sender. Without this a local run falls back to `onboarding@resend.dev`, and
// the From line is part of what is being reviewed - it is the first thing a guest reads.
// Kept in step with RESEND_FROM_EMAIL in apphosting.yaml.
process.env.RESEND_FROM_EMAIL ||= 'Prahova Mountain Chalet <rezervari@prahova-chalet.ro>';

const [BOOKING, WHICH, TO] = process.argv.slice(2);
const LANG = (process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1] ?? 'ro') as any;
if (!BOOKING || !WHICH || !TO) {
  console.error('usage: send-test-email <bookingId> <confirmation|pre-arrival|review|return-incentive|seasonal> <toEmail> [--lang=ro|en]');
  process.exit(1);
}

(async () => {
  const svc = await import('@/services/emailService');

  // Deliberately the REAL senders, each of which takes a recipient override. Rendering the
  // template here instead would be a second copy of the send path - the exact drift that made the
  // preview lie three times. Nothing is stamped on the booking by any of these.
  const senders: Record<string, () => Promise<{ success: boolean; error?: string }>> = {
    'confirmation':     () => svc.sendBookingConfirmationEmail(BOOKING, TO),
    'pre-arrival':      () => svc.sendPreArrivalEmail(BOOKING, TO),
    'review':           () => svc.sendReviewRequestEmail(BOOKING, TO),
    'return-incentive': () => svc.sendReturnIncentiveEmail(BOOKING, 'RETURN-SAMPLE', 10, '29 decembrie 2026', TO),
    'seasonal':         () => svc.sendSeasonalReminderEmail(BOOKING, TO),
  };

  const send = senders[WHICH];
  if (!send) {
    console.error(`unknown email: ${WHICH}. one of: ${Object.keys(senders).join(', ')}`);
    process.exit(1);
  }

  // The language a guest would get is the one on the booking. --lang only overrides it for a look.
  const res = await send();
  console.log(res.success ? `sent ${WHICH} to ${TO}` : `FAILED: ${res.error}`);
  process.exit(res.success ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
