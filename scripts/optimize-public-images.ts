/**
 * Re-encode the hand-placed photos under public/images.
 *
 * These never went through the admin upload pipeline, so they are straight
 * camera output: comarnic-hero-1.jpg was 392 KB and sfinx.jpg 575 KB, both
 * shipped at full size to every phone because next/image is unoptimized on
 * Firebase App Hosting.
 *
 * Filenames and formats are preserved deliberately. Firestore override
 * documents reference these paths as bare strings, so renaming one or swapping
 * it to .webp would break the reference. Re-encoding in place keeps every
 * reference valid, and the long cache header added in next.config.ts means the
 * bytes are fetched once. If you ever edit an image after this, rename it, or
 * visitors will keep the cached copy for a year.
 *
 * Usage:
 *   npx tsx scripts/optimize-public-images.ts            # dry run
 *   npx tsx scripts/optimize-public-images.ts --apply
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd(), 'public/images');
const MAX_WIDTH = 1600;   // plenty for a full-bleed desktop hero
const QUALITY = 80;
const MIN_SAVING = 0.10;  // skip rewrites that gain less than 10%

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(jpe?g|png)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const files = (await walk(ROOT)).sort();

  console.log(`Root  : ${ROOT}`);
  console.log(`Mode  : ${apply ? 'APPLY (rewriting in place)' : 'DRY RUN'}`);
  console.log('');

  let before = 0;
  let after = 0;
  let rewritten = 0;
  let skipped = 0;

  for (const file of files) {
    const original = await fs.readFile(file);

    // public/images/themes/* are zero-byte placeholders; sharp throws on those.
    if (original.length === 0) {
      skipped++;
      continue;
    }

    let meta: sharp.Metadata;
    try {
      meta = await sharp(original).metadata();
    } catch {
      console.log(`  SKIP (not a readable image): ${path.relative(process.cwd(), file)}`);
      before += original.length;
      after += original.length;
      skipped++;
      continue;
    }
    const isPng = /\.png$/i.test(file);

    let pipeline = sharp(original).rotate();
    if ((meta.width || 0) > MAX_WIDTH) {
      pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    }
    const out = isPng
      ? await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer()
      : await pipeline.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();

    const saving = 1 - out.length / original.length;
    before += original.length;

    if (saving < MIN_SAVING) {
      after += original.length;
      skipped++;
      continue;
    }

    after += out.length;
    rewritten++;
    const rel = path.relative(process.cwd(), file);
    console.log(
      `  ${apply ? 'WROTE' : 'WOULD'} ${rel}  ${Math.round(original.length / 1024)} KB -> ${Math.round(out.length / 1024)} KB  (-${Math.round(saving * 100)}%)`
    );
    if (apply) await fs.writeFile(file, out);
  }

  console.log('\n--- summary ---');
  console.log(`  files scanned : ${files.length}`);
  console.log(`  rewritten     : ${rewritten}`);
  console.log(`  left alone    : ${skipped} (saving under ${MIN_SAVING * 100}%)`);
  console.log(`  before        : ${Math.round(before / 1024)} KB`);
  console.log(`  after         : ${Math.round(after / 1024)} KB`);
  console.log(`  reduction     : ${Math.round((1 - after / before) * 100)}%`);
  if (!apply) console.log('\nRe-run with --apply to write these.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
