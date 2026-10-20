/**
 * Puts the free periods widget (block type `openStays`, id `open-stays`) on a property's website.
 *
 *   npx tsx scripts/setup-open-stays.ts <propertyId>            # dry run: prints what would change
 *   npx tsx scripts/setup-open-stays.ts <propertyId> --write    # writes, after a backup in /tmp
 *
 * Two writes:
 *   1. The property's website template gets the block on homepage (after `hero`), gallery (after
 *      `full-gallery`) and details (after `rooms`). The template is shared, but the block renders only
 *      for a property whose overrides carry settings for it, so other properties are unaffected.
 *   2. The property's overrides: `open-stays` added to each page's visibleBlocks, with settings.
 *      Field-level updates, never a whole-document write.
 * Safe before the code is deployed: the old renderer skips a block type it has no component for.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb, FieldPath } from '@/lib/firebaseAdminSafe';

const BLOCK = { id: 'open-stays', type: 'openStays' };
const PLACES: { page: string; after: string; settings: Record<string, unknown> }[] = [
  { page: 'homepage', after: 'hero', settings: { variant: 'section', maxRows: 4 } },
  { page: 'gallery', after: 'full-gallery', settings: { variant: 'inline', maxRows: 3, galleryAfter: 6 } },
  { page: 'details', after: 'rooms', settings: { variant: 'inline', maxRows: 3 } },
];

const insertAfter = <T>(list: T[], item: T, after: (x: T) => boolean): T[] => {
  const i = list.findIndex(after);
  return i < 0 ? [...list, item] : [...list.slice(0, i + 1), item, ...list.slice(i + 1)];
};

(async () => {
  const propertyId = process.argv[2];
  const write = process.argv.includes('--write');
  if (!propertyId || propertyId.startsWith('--')) throw new Error('usage: setup-open-stays.ts <propertyId> [--write]');

  const db = await getAdminDb();
  const property = (await db.collection('properties').doc(propertyId).get()).data();
  if (!property) throw new Error(`no property ${propertyId}`);
  const tplRef = db.collection('websiteTemplates').doc(property.templateId);
  const ovRef = db.collection('propertyOverrides').doc(propertyId);
  const [tpl, ov] = await Promise.all([tplRef.get(), ovRef.get()]);
  if (!tpl.exists || !ov.exists) throw new Error('template or overrides missing');
  const tplData = tpl.data() as any;
  const ovData = ov.data() as any;

  const backup = `${os.tmpdir()}/open-stays-backup-${propertyId}-${Date.now()}.json`;
  fs.writeFileSync(backup, JSON.stringify({ template: { id: tpl.id, pages: tplData.pages }, overrides: ovData }, null, 1));
  console.log('backup', backup);

  const tplUpdates: Record<string, unknown> = {};
  const ovUpdates: [FieldPath, unknown][] = [];
  for (const { page, after, settings } of PLACES) {
    const blocks: any[] = tplData.pages?.[page]?.blocks;
    if (!blocks) { console.log(`template has no ${page} page, skipped`); continue; }
    if (!blocks.some((b) => b.id === BLOCK.id)) {
      tplUpdates[`pages.${page}.blocks`] = insertAfter(blocks, BLOCK, (b: any) => b.id === after);
    }
    const visible: string[] | undefined = ovData?.[page]?.visibleBlocks;
    if (visible && !visible.includes(BLOCK.id)) {
      ovUpdates.push([new FieldPath(page, 'visibleBlocks'), insertAfter(visible, BLOCK.id, (x) => x === after)]);
    }
    if (!ovData?.[page]?.[BLOCK.id]) ovUpdates.push([new FieldPath(page, BLOCK.id), settings]);
  }

  console.log('\ntemplate', tpl.id);
  for (const [k, v] of Object.entries(tplUpdates)) console.log(' ', k, '=', (v as any[]).map((b) => b.id).join(' '));
  console.log('\noverrides', propertyId);
  for (const [k, v] of ovUpdates) console.log(' ', k.toString(), '=', JSON.stringify(v));
  if (!Object.keys(tplUpdates).length && !ovUpdates.length) { console.log('\nnothing to do'); process.exit(0); }
  if (!write) { console.log('\nDRY RUN. Add --write to apply.'); process.exit(0); }

  if (Object.keys(tplUpdates).length) await tplRef.update(tplUpdates);
  if (ovUpdates.length) await ovRef.update(...(ovUpdates.flat() as [FieldPath, unknown]));
  console.log('\nwritten');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
