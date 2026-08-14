/**
 * Generate responsive WebP variants for the hand-placed photos under
 * public/images, and write a manifest keyed by the original path.
 *
 * Why a manifest rather than re-encoding in place: these files are referenced
 * from Firestore as bare strings (propertyOverrides `backgroundImage`, `image`
 * and friends), and comarnic-hero-1.jpg alone is referenced twice live. Adding
 * variants beside the original leaves every existing reference valid, and any
 * image with no variants simply renders as it does today.
 *
 * Why variants rather than one smaller file: the hero is full-bleed. A 390px
 * viewport at DPR 3 genuinely needs ~1170px, so shrinking the single file would
 * either bloat DPR-2 phones or soften desktop. srcset lets each device take
 * what it actually needs and leaves quality alone everywhere.
 *
 * The originals are never modified. Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/generate-public-image-variants.ts            # dry run
 *   npx tsx scripts/generate-public-image-variants.ts --apply
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import sharp from 'sharp';

const PUBLIC_IMAGES = path.resolve(process.cwd(), 'public/images');
const MANIFEST = path.resolve(process.cwd(), 'src/data/image-variants.json');
const WIDTHS = [640, 828, 1200, 1600, 2048];
const QUALITY = 80;
const VARIANT_DIR = '_v'; // sits beside the original, e.g. .../\_v/comarnic-hero-1-1200.webp

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === VARIANT_DIR) continue; // never recurse into our own output
      out.push(...(await walk(path.join(dir, entry.name))));
    } else if (/\.(jpe?g|png)$/i.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const files = (await walk(PUBLIC_IMAGES)).sort();
  const manifest: Record<
    string,
    { widths: number[]; pattern: string; originalWidth: number; blurDataURL?: string }
  > = {};

  console.log(`Source : ${PUBLIC_IMAGES}`);
  console.log(`Widths : ${WIDTHS.join(', ')}  (WebP q${QUALITY})`);
  console.log(`Mode   : ${apply ? 'APPLY' : 'DRY RUN'}\n`);

  let made = 0;
  let skippedSmall = 0;
  let originalBytes = 0;
  let variantBytes = 0;

  for (const file of files) {
    const buf = await fs.readFile(file);
    if (buf.length === 0) continue;

    let meta: sharp.Metadata;
    try {
      meta = await sharp(buf).metadata();
    } catch {
      continue; // not a readable image
    }
    const srcWidth = meta.width || 0;
    if (srcWidth < 400) {
      skippedSmall++;
      continue; // icons and placeholders gain nothing
    }

    const rel = '/' + path.relative(path.resolve(process.cwd(), 'public'), file).split(path.sep).join('/');
    const base = path.basename(file).replace(/\.[^.]+$/, '');
    const outDir = path.join(path.dirname(file), VARIANT_DIR);
    // Only emit widths at or below the source; upscaling invents detail.
    const widths = WIDTHS.filter((w) => w <= srcWidth);
    if (widths.length === 0) widths.push(srcWidth);

    originalBytes += buf.length;

    if (apply) await fs.mkdir(outDir, { recursive: true });

    // A variant is only worth having if it is genuinely smaller than the
    // original. Dense foliage in particular can encode LARGER as WebP at the
    // top width than the already well-compressed source JPEG, and shipping
    // that would make desktop slower for no gain. The original stays in the
    // srcset as the widest candidate, so full-size quality is never reduced.
    const kept: number[] = [];
    for (const w of widths) {
      const out = await sharp(buf)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: QUALITY, effort: 6 })
        .toBuffer();
      if (out.length >= buf.length) {
        console.log(`      skip ${w}w (${Math.round(out.length / 1024)}KB >= original ${Math.round(buf.length / 1024)}KB)`);
        continue;
      }
      kept.push(w);
      variantBytes += out.length;
      if (apply) await fs.writeFile(path.join(outDir, `${base}-${w}.webp`), out);
      made++;
    }

    const blur = await sharp(buf).rotate().resize({ width: 20 }).webp({ quality: 40 }).toBuffer();

    if (kept.length === 0) {
      console.log(`  ${rel.split('/').pop()}  no variant beat the original, left alone`);
      continue;
    }

    manifest[rel] = {
      widths: kept,
      pattern: `${path.dirname(rel)}/${VARIANT_DIR}/${base}-{w}.webp`,
      originalWidth: srcWidth,
      blurDataURL: `data:image/webp;base64,${blur.toString('base64')}`,
    };

    console.log(
      `  ${rel.split('/').pop()}  ${srcWidth}px ${Math.round(buf.length / 1024)}KB  ->  variants ${kept.join('/')} + original @${srcWidth}w`
    );
  }

  if (apply) {
    await fs.mkdir(path.dirname(MANIFEST), { recursive: true });
    await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  }

  console.log('\n--- summary ---');
  console.log(`  source images    : ${files.length} (${skippedSmall} too small to bother)`);
  console.log(`  variants written : ${made}`);
  console.log(`  manifest entries : ${Object.keys(manifest).length}`);
  console.log(`  originals        : ${Math.round(originalBytes / 1024)} KB (untouched)`);
  console.log(`  variants total   : ${Math.round(variantBytes / 1024)} KB on disk`);
  if (!apply) console.log('\nRe-run with --apply to write these.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
