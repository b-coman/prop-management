#!/usr/bin/env npx tsx
/** page-post — draft an organic FB page post (manual-post v1). Prints the caption + chosen photo for
 *  the operator to post by hand. Never publishes. Tokens from Secret Manager. */
import * as dotenv from 'dotenv'; import * as path from 'path'; import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const secret = (n: string) => execSync(`gcloud secrets versions access latest --secret=${n} --project=rentalspot-fzwom`, { encoding: 'utf8' }).trim();
process.env.ANTHROPIC_API_KEY = secret('ANTHROPIC_API_KEY');
import { generatePagePost } from '@/services/growth/pagePostWriter';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { serverTranslateContent } from '@/lib/server-language-utils';
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const property = arg('property', 'prahova-mountain-chalet')!;
const prompt = arg('prompt', 'A warm early-autumn hello from the mountains — golden leaves, quiet mornings, and the fire pit ready for cool evenings.')!;
const framing = { goal: arg('goal'), audience: arg('audience') };
(async () => {
  const db = await getAdminDb();
  const doc = await db.collection('properties').doc(property).get();
  const images = ((doc.data()?.images ?? []) as Array<{storagePath?:string; alt?:unknown; tags?:string[]}>)
    .filter((i) => i.storagePath?.startsWith(`properties/${property}/`))
    .map((i) => ({ storagePath: i.storagePath as string, alt: serverTranslateContent(i.alt as never, 'en'), tags: i.tags ?? [] }));
  const res = await generatePagePost({ propertyId: property, prompt, assets: images, framing });
  console.log(`\n=== page post — ${res.ok ? 'VALID' : 'REJECTED'} (${res.attempts} attempt(s)) ===`);
  if (res.post) { console.log(`\n${res.post.message}\n\nphoto: ${res.post.assetPath.split('/').pop()}`); if (res.post.notes) console.log(`notes: ${res.post.notes}`); }
  if (res.warnings.length) console.log(`\n⚠ ${res.warnings.join(' · ')}`);
  if (!res.ok) console.log(`\n✖ ${res.errors.join(' · ')}`);
  process.exit(res.ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
