#!/usr/bin/env npx tsx
/**
 * strip-legacy-pricing-block — remove the dead `property.pricing.*` map.
 *
 * WHAT IT IS. When Prahova was first seeded in 2025 its pricing lived under a `pricing` map:
 *
 *   pricing.occupancyPricing      { enabled: true, baseOccupancy: 4, extraGuestFeePerNight: 25 }
 *   pricing.lengthOfStayDiscounts [ 7n -5%, 14n -10%, 28n -15% ]
 *   pricing.weekendPricing        { friday+saturday, priceMultiplier: 1.3155 }
 *   pricing.pricingTemplateId, pricing.useDynamicPricing
 *
 * Prices are now edited in the admin UI, which writes the TOP-LEVEL fields (`pricePerNight`,
 * `baseOccupancy`, `extraGuestFee`). Nothing ever wrote back to the `pricing` map, so it froze at
 * 2025: it still claims 4 guests included at 25/night against a live 3 at 75, and length-of-stay
 * discounts a third the size of the real ones. Coltei, created later, has never had the map at all.
 *
 * WHY IT IS SAFE. Nothing in `src/` reads any of it. `pricing.weekendPricing` is referenced in three
 * places, always as `property.pricingConfig || { ...fallback... }` — the fallback is only reached
 * when `pricingConfig` is absent as a whole, and it is present on both properties. The script
 * refuses to run if that stops being true.
 *
 *   npx tsx scripts/strip-legacy-pricing-block.ts              # dry run, writes nothing
 *   npx tsx scripts/strip-legacy-pricing-block.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { FieldValue } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SLUGS = ['prahova-mountain-chalet', 'coltei-apartment-bucharest'];

(async () => {
  const db = await getAdminDb();
  if (!APPLY) console.log('DRY RUN — nothing will be written. Re-run with --apply.\n');

  for (const slug of SLUGS) {
    const ref = db.collection('properties').doc(slug);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`${slug}: NOT FOUND, skipping`); continue; }
    const d = snap.data() as Record<string, unknown>;

    if (d.pricing === undefined) { console.log(`${slug}: no legacy pricing map, nothing to do`); continue; }

    // The precondition the safety argument rests on. Without pricingConfig the legacy weekend
    // multiplier is genuinely load-bearing, and removing it would silently flatten weekend prices.
    const cfg = d.pricingConfig as { weekendAdjustment?: number } | undefined;
    if (!cfg || typeof cfg.weekendAdjustment !== 'number') {
      console.log(`${slug}: REFUSING — pricingConfig.weekendAdjustment is missing, so ` +
                  `pricing.weekendPricing is still the live fallback. Set pricingConfig first.`);
      process.exitCode = 1;
      continue;
    }

    console.log(`${slug}:`);
    console.log(`  removing pricing.{${Object.keys(d.pricing as object).join(', ')}}`);
    console.log(`  keeping  pricePerNight ${d.pricePerNight} · baseOccupancy ${d.baseOccupancy} · ` +
                `extraGuestFee ${d.extraGuestFee} · maxGuests ${d.maxGuests}`);
    console.log(`  keeping  pricingConfig.weekendAdjustment ${cfg.weekendAdjustment}`);

    if (APPLY) {
      const backup = path.resolve(process.cwd(), `backup-${slug}-pricing-${Date.now()}.json`);
      fs.writeFileSync(backup, JSON.stringify({ pricing: d.pricing }, null, 2));
      await ref.update({ pricing: FieldValue.delete() });
      console.log(`  REMOVED. Backup of the deleted map: ${backup}`);
    }
  }

  if (!APPLY) console.log('\nNothing written. Re-run with --apply to make the change.');
})().catch((e) => { console.error(e); process.exit(1); });
