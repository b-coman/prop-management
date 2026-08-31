/**
 * Record what each platform discounts a longer stay by, from the owner's own settings screens.
 *
 * These are FETCHED FACTS, exactly like the holidays collection: read off Airbnb's and Booking's
 * settings on 2026-09-01 and written down with their plan names, never derived from captured prices.
 * Inferring them from captures was tried and gave the wrong answer, because captures mix channels,
 * party sizes and live promotions together.
 *
 * Re-run after changing a discount on either platform. Idempotent; writes with merge.
 */
import { getAdminDb, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { config } from 'dotenv';
config({ path: '.env.local' });

const PROPERTY = process.argv[2] ?? 'prahova-mountain-chalet';
const WRITE = process.argv.includes('--write');

const DATA: Record<string, {
  lengthOfStayDiscounts: Array<{ nightsThreshold: number; discountPercentage: number; label?: string; nonRefundable?: boolean }>;
  standingDeals: Array<{ label: string; discountPercentage: number; condition?: string }>;
}> = {
  airbnb: {
    lengthOfStayDiscounts: [
      { nightsThreshold: 4, discountPercentage: 10, label: 'Trip length, 4 nights' },
      { nightsThreshold: 5, discountPercentage: 15, label: 'Trip length, 5 nights' },
      { nightsThreshold: 7, discountPercentage: 20, label: 'Weekly' },
      { nightsThreshold: 28, discountPercentage: 35, label: 'Monthly' },
    ],
    standingDeals: [
      { label: 'Top-rated guests', discountPercentage: 15, condition: 'guests rated 4.8+ with 3+ reviews — invisible to any capture' },
      { label: 'Last minute', discountPercentage: 5, condition: 'booked 0-7 days before arrival' },
      { label: 'Early bird', discountPercentage: 5, condition: 'booked 2+ months before arrival' },
    ],
  },
  'booking.com': {
    lengthOfStayDiscounts: [
      { nightsThreshold: 4, discountPercentage: 5, label: '4 day stay rate (flexible)' },
      { nightsThreshold: 7, discountPercentage: 30, label: 'Weekly rate (flexible)' },
      { nightsThreshold: 28, discountPercentage: 45, label: 'Monthly rate (NON-refundable)', nonRefundable: true },
    ],
    standingDeals: [
      { label: 'Getaway Deal', discountPercentage: 20, condition: 'campaign, stays to 30 Sep 2026 — 3 bookings, 7 room nights, 4,776 lei to date' },
      { label: 'Early Booker Deal', discountPercentage: 5, condition: '90+ days before check-in — no bookings yet' },
      { label: 'Last Minute Deal', discountPercentage: 10, condition: '0-3 days before check-in — no bookings yet' },
    ],
  },
};

(async () => {
  const db = await getAdminDb();
  for (const [channelId, payload] of Object.entries(DATA)) {
    const id = `${PROPERTY}_${channelId}`;
    console.log(`\n${channelId}`);
    for (const d of payload.lengthOfStayDiscounts) {
      console.log(`  ${d.nightsThreshold}n  -${d.discountPercentage}%  ${d.label}${d.nonRefundable ? '  [non-refundable, a different product]' : ''}`);
    }
    for (const d of payload.standingDeals) console.log(`  deal: ${d.label} -${d.discountPercentage}%  (${d.condition})`);
    if (WRITE) {
      await db.collection('channels').doc(id).set({
        ...payload,
        discountsRecordedAt: '2026-09-01',
        discountsSource: "owner's own Airbnb and Booking.com settings screens",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'scripts/seed-channel-discounts.ts',
      }, { merge: true });
      console.log(`  -> written to channels/${id}`);
    }
  }
  if (!WRITE) console.log('\nDry run. Re-run with --write to save.');
  loggers.pricing.info('Channel length-of-stay discounts recorded', { property: PROPERTY, write: WRITE });
  process.exit(0);
})();
