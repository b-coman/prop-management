#!/usr/bin/env npx tsx
/**
 * set-channel-pricing — persist a property's channel economics + listing URLs.
 *
 * Until this exists on the property doc, the parity pack falls back to documented defaults and every
 * report has to carry a "RATES ARE DEFAULTS" caveat. The rates are owner-stated facts; record them.
 *
 * A DELISTED channel is recorded as excluded WITH A REASON rather than deleted. Leaving it in the
 * active list would make every run report a permanently-missing cell, and an "incomplete" status that
 * can never be cleared stops meaning anything. Deleting it silently would lose why.
 *
 * Uses update() with dot-paths, never set() — see the property-overrides lesson: a full-document
 * set() wipes admin-UI edits that aren't in the local file.
 *
 *   npx tsx scripts/set-channel-pricing.ts [propertySlug] [--dry-run]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const SLUG = process.argv[2]?.startsWith('--') ? 'prahova-mountain-chalet' : (process.argv[2] ?? 'prahova-mountain-chalet');
const DRY = process.argv.includes('--dry-run');

/** Owner-stated, 2026-08-07. */
const CHANNEL_PRICING = {
  channels: [
    { channel: 'airbnb', commissionPct: 0.185 },
    { channel: 'booking.com', commissionPct: 0.23 },
    { channel: 'vrbo', commissionPct: 0.20 },
  ],
  direct: { paymentCostPct: 0.029 },
  listingUrls: {
    airbnb: 'https://www.airbnb.com/rooms/43265214',
    'booking.com': 'https://www.booking.com/hotel/ro/mountain-family-chalet-on-prahova-valley.en-gb.html',
    vrbo: 'https://www.vrbo.com/3237734',
  },
  /**
   * The upper figure is a headcount every channel actually offers — NOT property.maxGuests (7). The
   * Airbnb listing advertises 6 guests, so a 7-guest probe gets no quote and the pair would be
   * incomparable.
   */
  compareOccupancies: [3, 6],
  /** Target band the owner set: direct 5-10% under the cheapest channel. */
  targetDiscountPct: 0.075,
  excludedChannels: [
    { channel: 'travelminit', reason: 'delisted 2026-08 — additional documents pending', since: '2026-08-07' },
  ],
  ratesStatedBy: 'owner',
  ratesStatedAt: '2026-08-07',
};

(async () => {
  const db = await getAdminDb();
  const ref = db.collection('properties').doc(SLUG);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`property ${SLUG} not found`);

  console.log(`${DRY ? '[dry run] would write' : 'writing'} channelPricing on ${SLUG}:`);
  console.log(JSON.stringify(CHANNEL_PRICING, null, 2));

  if (!DRY) {
    // Dot-path update: touches ONLY this field, leaves the rest of the property document alone.
    await ref.update({ channelPricing: CHANNEL_PRICING });
    const after = (await ref.get()).data() as any;
    console.log(`\nwritten. channels: ${after.channelPricing.channels.map((c: any) => `${c.channel} ${(c.commissionPct * 100).toFixed(1)}%`).join(' · ')}`);
    console.log(`excluded: ${after.channelPricing.excludedChannels.map((c: any) => `${c.channel} (${c.reason})`).join(', ')}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
