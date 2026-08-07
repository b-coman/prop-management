/**
 * Lift `property.channelPricing` into the `channels` collection.
 *
 *   npx tsx scripts/migrate-channels.ts                  # dry run, all properties
 *   npx tsx scripts/migrate-channels.ts --write
 *   npx tsx scripts/migrate-channels.ts --property prahova-mountain-chalet --write
 *   npx tsx scripts/migrate-channels.ts --write --overwrite   # re-assert from channelPricing
 *
 * Safe to re-run: existing channel docs are skipped unless --overwrite, so a rate corrected in the
 * admin is never reverted by running this again.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { migrateChannelPricing, getChannels } from '@/services/channelService';
import { CHANNEL_LABELS } from '@/lib/channels';

const argv = process.argv.slice(2);
const WRITE = argv.includes('--write');
const OVERWRITE = argv.includes('--overwrite');
const only = argv.includes('--property') ? argv[argv.indexOf('--property') + 1] : null;

const pct = (n: number | undefined) => (n == null ? '—' : `${(n * 100).toFixed(3).replace(/\.?0+$/, '')}%`);

(async () => {
  const db = await getAdminDb();
  const props = only
    ? [await db.collection('properties').doc(only).get()]
    : (await db.collection('properties').get()).docs;

  console.log(WRITE ? '=== WRITING ===' : '=== DRY RUN (pass --write to apply) ===');

  for (const p of props) {
    if (!p.exists) { console.log(`\nproperty ${only}: NOT FOUND`); continue; }
    const data = p.data() as Record<string, any>;
    console.log(`\n## ${p.id}`);

    const res = await migrateChannelPricing(p.id, data.channelPricing, {
      overwrite: OVERWRITE, dryRun: !WRITE, updatedBy: 'migrate-channels.ts',
    });

    if (res.created.length) {
      console.log(`  ${WRITE ? 'created' : 'would create'}: ${res.created.join(', ')}`);
    }
    if (res.skippedExisting.length) {
      console.log(`  skipped (already exist, use --overwrite to replace): ${res.skippedExisting.join(', ')}`);
    }
    if (res.unrecognised.length) {
      console.log(`  UNRECOGNISED channel names — add an alias in src/lib/channels.ts: ${res.unrecognised.join(', ')}`);
    }
    if (res.noEconomics.length) {
      console.log(`  no commission stated: ${res.noEconomics.join(', ')}`);
    }
    res.notes.forEach((n) => console.log(`  note: ${n}`));

    if (WRITE) {
      const after = await getChannels(p.id);
      if (after.byId.size) {
        console.log('  --- persisted ---');
        for (const c of after.byId.values()) {
          const bits = [
            c.active ? 'active' : `inactive (${c.inactiveReason ?? 'no reason given'})`,
            c.economics ? `commission ${pct(c.economics.commissionPct)}` : '',
            c.directEconomics ? `card ${pct(c.directEconomics.paymentCostPct)}` : '',
            c.targetDirectDiscountPct != null ? `target discount ${pct(c.targetDirectDiscountPct)}` : '',
          ].filter(Boolean);
          console.log(`  ${CHANNEL_LABELS[c.channelId].padEnd(22)} ${bits.join(' · ')}`);
        }
      }
    }
  }

  if (!WRITE) console.log('\nNothing written. Re-run with --write once the plan above looks right.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
