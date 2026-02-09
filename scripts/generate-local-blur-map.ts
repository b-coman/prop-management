/**
 * Generate blur placeholder map for local images in /public/images/.
 * Outputs a JSON map: { "/images/path/file.jpg": "data:image/jpeg;base64,..." }
 * Usage: npx tsx scripts/generate-local-blur-map.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const OUTPUT_FILE = path.resolve(process.cwd(), 'src', 'data', 'blur-map.json');

// Recursively find all image files
function findImages(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findImages(fullPath));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function generateBlurDataURL(filePath: string): Promise<string> {
  const blurred = await sharp(filePath)
    .resize(10, undefined, { fit: 'inside' })
    .blur(2)
    .jpeg({ quality: 40 })
    .toBuffer();

  return `data:image/jpeg;base64,${blurred.toString('base64')}`;
}

async function main() {
  const imagesDir = path.join(PUBLIC_DIR, 'images');
  if (!fs.existsSync(imagesDir)) {
    console.error('No public/images directory found');
    process.exit(1);
  }

  const imageFiles = findImages(imagesDir);
  console.log(`Found ${imageFiles.length} local images\n`);

  const blurMap: Record<string, string> = {};

  for (const filePath of imageFiles) {
    // Convert absolute path to public URL path
    const publicPath = '/' + path.relative(PUBLIC_DIR, filePath);
    try {
      const blurDataURL = await generateBlurDataURL(filePath);
      blurMap[publicPath] = blurDataURL;
      console.log(`${publicPath}: generated (${blurDataURL.length} chars)`);
    } catch (e: any) {
      console.error(`${publicPath}: FAILED - ${e.message}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(blurMap, null, 2));
  console.log(`\nWrote ${Object.keys(blurMap).length} entries to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
