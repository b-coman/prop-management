#!/usr/bin/env npx tsx
/**
 * preview-guest-emails — render every guest email for a REAL booking, in both languages,
 * without sending anything.
 *
 * Exists because the only way anyone found out what guests actually receive was to make a booking
 * and read the owner's copy. These templates have conditional blocks that vanish silently when
 * their data is missing — that is how every confirmation went out for a year with no phone number.
 *
 * It renders through `loadGuestEmailContext` + the same pure payload builders the send path uses,
 * so it CANNOT drift. An earlier version rebuilt the payload by hand and drifted three times in
 * one evening (the guide token secret, the clock format, the phone display), each time showing
 * something no guest would ever receive. A preview that lies is worse than no preview, because
 * it is trusted.
 *
 *   npx tsx scripts/preview-guest-emails.ts <bookingId> [--lang=ro|en]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ALWAYS override with the production secret, never `if (!set)`. `.env.local` carries a DIFFERENT
// REVIEW_TOKEN_SECRET, and dotenv wins over an unset variable — so the conditional version of this
// silently produced guide links the live site rejects, rendering the public tier with no
// directions, no gate number and no Wi-Fi.
//
// NOT trimmed, on purpose: the stored value ends with a newline and production uses it as stored.
// The token is an HMAC over that exact string, so trimming also produces rejected links.
process.env.REVIEW_TOKEN_SECRET = execSync(
  'gcloud secrets versions access latest --secret=REVIEW_TOKEN_SECRET --project=rentalspot-fzwom',
  { encoding: 'utf8' }
);

// Imported DYNAMICALLY, below, on purpose. `import` statements are hoisted and run before
// dotenv.config() above, and emailService reaches property-utils which initialises the CLIENT
// Firebase SDK at module load — so a static import here dies with "Firebase app is not
// initialised" before a single line of this file runs.

const BOOKING = process.argv[2];
const ONLY = process.argv.find((a) => a.startsWith('--lang='))?.split('=')[1];
if (!BOOKING) {
  console.error('usage: preview-guest-emails <bookingId> [--lang=ro|en]');
  process.exit(1);
}

const OUT = '/tmp/prahova-emails';

(async () => {
  const { loadGuestEmailContext } = await import('@/services/emailService');
  const { buildConfirmationPayload, buildPreArrivalPayload } =
    await import('@/services/guestEmailPayloads');
  const { createBookingConfirmationTemplate, createPreArrivalTemplate } =
    await import('@/services/emailTemplates');

  fs.mkdirSync(OUT, { recursive: true });
  const langs = (ONLY ? [ONLY] : ['ro', 'en']) as any[];

  for (const lang of langs) {
    const ctx = await loadGuestEmailContext(BOOKING, undefined, lang);
    if (!ctx) {
      console.error(`booking ${BOOKING} not found, or it has no guest email`);
      process.exit(1);
    }

    const rendered = [
      ['confirmation', createBookingConfirmationTemplate(buildConfirmationPayload(ctx), ctx.language)],
      ['pre-arrival', createPreArrivalTemplate(buildPreArrivalPayload(ctx), ctx.language)],
    ] as const;

    for (const [name, out] of rendered) {
      fs.writeFileSync(`${OUT}/${name}.${lang}.html`, out.html);
      fs.writeFileSync(`${OUT}/${name}.${lang}.txt`, out.text.replace(/\n{3,}/g, '\n\n'));
      console.log(`${OUT}/${name}.${lang}.html   subject: ${out.subject}`);
    }
    if (lang === langs[0]) console.log(`\nguide link: ${ctx.guideUrl ?? '(could not build)'}\n`);
  }

  console.log('\nNothing was sent.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
