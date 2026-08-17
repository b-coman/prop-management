#!/usr/bin/env npx tsx
/**
 * apply-direct-parity-pricing — make the direct site the cheapest place to book.
 *
 * WHY
 * ---
 * A parity run on 2026-08-17 measured 21 windows against Airbnb, Booking.com and VRBO
 * (logged in, promo-inclusive). The direct site was the MOST EXPENSIVE channel on 16 of them.
 * The cause is structural, not a mispriced weekend: the owner runs 12-30% promotions on the
 * OTAs and direct has no equivalent instrument for stays under 7 nights.
 *
 * Two defects, both fixed here:
 *
 *   1. A HOLE IN THE CALENDAR. "Summer" ends 2026-08-31 and "Fall" starts 2026-09-09, so
 *      2026-09-01..08 matched no period and silently fell back to tier `base` (1.0). That is
 *      why 4-7 Sep priced 9% above 25-28 Sep for an identical Fri-Sun shape.
 *
 *   2. NO SHORT-STAY DISCOUNT. The 7-night tier is 25%, which is why the only healthy window
 *      measured was the 7-night one. Stays of 3-4 nights had nothing, and every single losing
 *      window was a 3-5 night stay.
 *
 * DELIBERATELY NOT CHANGED (owner decision, 2026-08-17)
 * ----------------------------------------------------
 * The holiday overrides keep `flatRate: true`, so Christmas/New Year still charge six guests
 * the same as three. Known consequence, accepted by the owner: two 6-guest holiday windows sit
 * below `indifferencePrice` (28-31 Dec ~3988 vs floor ~4254; 30 Dec-2 Jan ~5258 vs floor ~5911),
 * i.e. the owner nets less than letting Airbnb take those two bookings. Revisit separately.
 *
 * WHY NOT A BASE-RATE CUT
 * -----------------------
 * Simulated and rejected. `pricePerNight` compounds with the 25% length-of-stay discount, so a
 * cut deep enough to move the 3-4 night windows drives the 7-night window below indifference,
 * and it cannot touch the holidays at all (they are fixed-price overrides that REPLACE the
 * computed price). A single global discount was also rejected: at the depth 14-18 Sep needs
 * (-22%), two other windows fall below indifference.
 *
 * ORDER MATTERS
 * -------------
 * pricingPeriods is the source of truth; seasonalPricing/dateOverrides are COMPILED artifacts.
 * Writing a season directly would be erased by the next compile. So: period -> compile -> calendars.
 * The length-of-stay tiers live on the property doc and are read live by /api/check-pricing,
 * so they take effect without a calendar regeneration.
 *
 * Usage:
 *   npx tsx scripts/apply-direct-parity-pricing.ts            # dry run
 *   npx tsx scripts/apply-direct-parity-pricing.ts --apply
 *
 * Run scripts/verify-period-identity.ts BEFORE and regenerate calendars AFTER.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getPeriods, upsertPeriods, compileAndWrite } from '@/services/periodService';
import type { PricingPeriod } from '@/lib/pricing/periods';

const P = 'prahova-mountain-chalet';
const APPLY = process.argv.includes('--apply');

/** The missing period. Tier `low` matches the adjacent Fall period and what the OTAs charge. */
const EARLY_SEPTEMBER: PricingPeriod = {
  id: `${P}_2026_early-september`,
  propertyId: P,
  year: 2026,
  slug: 'early-september',
  name: 'Early September',
  startDate: '2026-09-01',
  endDate: '2026-09-08',
  tier: 'low',
  priority: 0,
  fixedNightPrice: null,
  minStay: 2,
  status: 'active',
};

/**
 * 3n and 4n are new. 7/14/28 are unchanged — reproduced in full because this field is written
 * with a whole-array set, so omitting them would silently delete them.
 * calculateLengthOfStayDiscount picks the HIGHEST applicable tier, so a 7-night stay still gets
 * 25% rather than stacking.
 */
const LOS_TIERS = [
  { nightsThreshold: 3, discountPercentage: 10, enabled: true },
  { nightsThreshold: 4, discountPercentage: 15, enabled: true },
  { nightsThreshold: 7, discountPercentage: 25, enabled: true },
  { nightsThreshold: 14, discountPercentage: 30, enabled: true },
  { nightsThreshold: 28, discountPercentage: 35, enabled: true },
];

(async () => {
  const db = await getAdminDb();
  console.log(`\n=== apply-direct-parity-pricing — ${P} ===`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes to production Firestore)' : 'DRY RUN'}\n`);

  // ---- 1. the missing period ----
  const periods = await getPeriods(P);
  const existing = periods.find((p) => p.id === EARLY_SEPTEMBER.id);
  const overlapping = periods.filter(
    (p) => p.id !== EARLY_SEPTEMBER.id && p.status === 'active' &&
      p.startDate <= EARLY_SEPTEMBER.endDate && p.endDate >= EARLY_SEPTEMBER.startDate
  );
  console.log('1. pricingPeriods');
  console.log(`   ${existing ? 'UPDATE' : 'CREATE'}  ${EARLY_SEPTEMBER.startDate}→${EARLY_SEPTEMBER.endDate}  tier ${EARLY_SEPTEMBER.tier}  minStay ${EARLY_SEPTEMBER.minStay}  "${EARLY_SEPTEMBER.name}"`);
  if (overlapping.length) {
    console.log(`   ABORT: overlaps existing active period(s): ${overlapping.map((p) => `${p.name} ${p.startDate}→${p.endDate}`).join(', ')}`);
    process.exit(1);
  }
  console.log('   no overlap with any active period — safe');

  // ---- 2. length-of-stay tiers ----
  const prop = (await db.collection('properties').doc(P).get()).data() as any;
  const before = prop.pricingConfig?.lengthOfStayDiscounts ?? [];
  console.log('\n2. properties/%s.pricingConfig.lengthOfStayDiscounts', P);
  console.log(`   before: ${before.map((d: any) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join(', ') || '(none)'}`);
  console.log(`   after : ${LOS_TIERS.map((d) => `${d.nightsThreshold}n -${d.discountPercentage}%`).join(', ')}`);
  if (prop.pricingConfig?.weekendAdjustment == null) {
    console.log('   ABORT: pricingConfig missing — refusing to write a partial config');
    process.exit(1);
  }

  console.log('\n3. holidays: UNTOUCHED (flatRate stays on, fixed prices unchanged) — owner decision');

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply, then regenerate price calendars.\n');
    process.exit(0);
  }

  // ---- write ----
  await upsertPeriods([EARLY_SEPTEMBER], 'scripts/apply-direct-parity-pricing.ts');
  console.log('\n   period written');

  const res = await compileAndWrite(P, {
    defaultMinimumStay: prop.defaultMinimumStay ?? 1,
    dryRun: false,
  });
  console.log(`   compiled: ${res.seasons.length} seasons, ${res.overrides.length} overrides`);
  if (res.seasonsDeleted?.length) console.log(`   seasons deleted (compiler-owned): ${res.seasonsDeleted.join(', ')}`);
  if (res.seasonsPreserved?.length) console.log(`   seasons preserved (hand-made): ${res.seasonsPreserved.join(', ')}`);

  // Field-level update: never .set() the whole property doc.
  await db.collection('properties').doc(P).update({
    'pricingConfig.lengthOfStayDiscounts': LOS_TIERS,
  });
  console.log('   length-of-stay tiers written');

  console.log('\nDONE. Next: regenerate price calendars, then re-run the parity report.\n');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
