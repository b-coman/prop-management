/**
 * Growth Engine — preview reachable audiences against LIVE Firestore.
 * Read-only: exercises the real segmentService (previewAudience) so we can
 * validate the dark-launched foundation before any send is ever enabled.
 * Usage: npx tsx scripts/growth-preview-audiences.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { previewAudience, PREDEFINED_SEGMENTS } from '@/services/segmentService';

const P = 'prahova-mountain-chalet';

async function show(label: string, def: Parameters<typeof previewAudience>[0]) {
  const a = await previewAudience(def);
  console.log(`\n${label}`);
  console.log(`  total: ${a.count} | reachable: ${a.reachable} | suppressed: ${a.suppressed} | lang: RO ${a.byLanguage.ro} / EN ${a.byLanguage.en} | channels ${JSON.stringify(a.byChannel)}`);
  if (a.sample.length) {
    console.log(`  sample: ${a.sample.slice(0, 3).map((s) => `${s.name || '(no name)'}[${s.channel ?? '—'}]`).join(', ')}`);
  }
}

(async () => {
  console.log('=== Growth Engine audience preview (live Firestore, dry data only) ===');
  await show('All guests for property', { propertyId: P });
  await show('WhatsApp-reachable', PREDEFINED_SEGMENTS.whatsappReachable(P));
  await show('Repeat guests (>=2 stays)', PREDEFINED_SEGMENTS.repeatGuests(P));
  await show('Last stayed in WINTER', PREDEFINED_SEGMENTS.lastStayedInSeason('winter', P));
  await show('No booking in 12+ months', PREDEFINED_SEGMENTS.noBookingInMonths(12, P));
  await show('Romanian guests', PREDEFINED_SEGMENTS.romanian(P));
  await show('Foreign guests', PREDEFINED_SEGMENTS.foreign(P));
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
