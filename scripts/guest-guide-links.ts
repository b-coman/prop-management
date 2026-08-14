// List guest guide links for bookings whose links currently work.
//
// Usage: npx tsx scripts/guest-guide-links.ts [propertySlug]
//
// Tokens are derived from REVIEW_TOKEN_SECRET, and the local .env.local value
// does NOT match production - a link built with the wrong secret silently falls
// back to the public tier instead of failing loudly. So this pulls the real
// secret from Secret Manager and only falls back to the environment with a
// warning. The secret itself is never printed.
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { execFileSync } from 'child_process';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PROJECT = 'rentalspot-fzwom';
const GRACE_DAYS = 14;

function productionSecret(): { secret: string; source: string } {
  try {
    const out = execFileSync(
      'gcloud',
      ['secrets', 'versions', 'access', 'latest', '--secret=REVIEW_TOKEN_SECRET', `--project=${PROJECT}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    if (out) return { secret: out, source: 'Secret Manager (production)' };
  } catch {
    // gcloud missing or not authorised - fall through.
  }
  const env = process.env.REVIEW_TOKEN_SECRET;
  if (!env) throw new Error('No secret available from gcloud or REVIEW_TOKEN_SECRET');
  return { secret: env, source: 'LOCAL .env.local - links may NOT work in production' };
}

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (raw._seconds) return new Date(raw._seconds * 1000);
  if (typeof raw.toDate === 'function') return raw.toDate();
  return null;
}

async function main() {
  const slug = process.argv[2] || 'prahova-mountain-chalet';

  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(path.resolve(serviceAccountPath)) });

  const { secret, source } = productionSecret();
  process.env.REVIEW_TOKEN_SECRET = secret;

  // Imported after the secret is in place: the module reads it on first use.
  const { generateGuideToken, guideIdentity, guidePath } = await import('../src/lib/guide-token');
  const { publicOriginForProperty } = await import('../src/lib/domain-map');

  const origin = publicOriginForProperty(slug) ?? 'https://prop-management--rentalspot-fzwom.europe-west4.hosted.app';

  const snap = await admin
    .firestore()
    .collection('bookings')
    .where('propertyId', '==', slug)
    .where('status', 'in', ['confirmed', 'completed'])
    .get();

  const now = Date.now();
  const rows = snap.docs
    .map((d) => {
      const b = d.data();
      return { id: d.id, b, checkIn: parseDate(b.checkInDate), checkOut: parseDate(b.checkOutDate) };
    })
    .filter((r) => r.checkOut && r.checkOut.getTime() + GRACE_DAYS * 864e5 > now)
    .sort((a, b) => (a.checkIn?.getTime() ?? 0) - (b.checkIn?.getTime() ?? 0));

  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '?');

  console.log(`\nSecret source: ${source}`);
  console.log(`Property: ${slug}   Links that currently work: ${rows.length}\n`);

  for (const r of rows) {
    const link = origin + guidePath(r.id, generateGuideToken(r.id, guideIdentity(r.b.guestInfo)));
    const name = (r.b.guestInfo?.firstName ?? '?').trim();
    const when = r.checkIn && r.checkIn.getTime() > now ? 'upcoming' : 'in progress / recent';
    console.log(`${name.padEnd(12)} ${iso(r.checkIn)} -> ${iso(r.checkOut)}  ${when}`);
    console.log(`  ${link}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
