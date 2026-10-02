// Move calendar/iCal tokens off the public `properties` docs into `propertySecrets`.
//
// The `properties` collection is publicly readable (Firestore rules) and is serialized into every
// guest page, so these tokens were readable by anyone. See src/lib/property-secrets.ts.
//
// Order matters:
//   1. --copy   BEFORE deploying the code that reads propertySecrets (otherwise links break)
//   2. deploy
//   3. --strip  AFTER the deploy is serving, removes the fields from the public docs
//
// Usage:
//   npx tsx scripts/migrate-property-secrets.ts            # dry run, reports state only
//   npx tsx scripts/migrate-property-secrets.ts --copy
//   npx tsx scripts/migrate-property-secrets.ts --strip
//
// Token values are never printed.

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(path.resolve(serviceAccountPath)) });
const db = admin.firestore();

const FIELDS = ['shareCalendarToken', 'guestCalendarToken', 'icalExportToken'] as const;
const mode = process.argv.includes('--copy') ? 'copy' : process.argv.includes('--strip') ? 'strip' : 'dry-run';

async function main() {
  console.log(`Mode: ${mode}`);
  const props = await db.collection('properties').get();

  for (const prop of props.docs) {
    const data = prop.data();
    const secretRef = db.collection('propertySecrets').doc(prop.id);
    const secrets = (await secretRef.get()).data() || {};

    const status = FIELDS.map((f) => {
      const onPublic = typeof data[f] === 'string' && data[f].length > 0;
      const inSecrets = typeof secrets[f] === 'string' && secrets[f].length > 0;
      const same = onPublic && inSecrets && data[f] === secrets[f];
      return { f, onPublic, inSecrets, same };
    });
    console.log(`\n${prop.id}`);
    for (const s of status) {
      console.log(`  ${s.f.padEnd(20)} public:${s.onPublic ? 'yes' : 'no '}  secrets:${s.inSecrets ? 'yes' : 'no '}${s.onPublic && s.inSecrets ? (s.same ? '  (same value)' : '  (DIFFERENT value)') : ''}`);
    }

    if (mode === 'copy') {
      // Copy only what secrets doesn't have yet, so a token regenerated after deploy is never overwritten.
      const toCopy: Record<string, string> = {};
      for (const s of status) if (s.onPublic && !s.inSecrets) toCopy[s.f] = data[s.f];
      if (Object.keys(toCopy).length) {
        await secretRef.set({ propertyId: prop.id, ...toCopy, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        console.log(`  copied: ${Object.keys(toCopy).join(', ')}`);
      } else {
        console.log('  nothing to copy');
      }
    }

    if (mode === 'strip') {
      // Remove from the public doc only when the secrets doc holds a token for that field,
      // so a link can never end up with no token anywhere.
      const toStrip = status.filter((s) => s.onPublic && s.inSecrets).map((s) => s.f);
      const blocked = status.filter((s) => s.onPublic && !s.inSecrets).map((s) => s.f);
      if (blocked.length) console.log(`  NOT stripping ${blocked.join(', ')}: missing in propertySecrets, run --copy first`);
      if (toStrip.length) {
        const update: Record<string, admin.firestore.FieldValue> = {};
        for (const f of toStrip) update[f] = admin.firestore.FieldValue.delete();
        await prop.ref.update(update);
        console.log(`  stripped from public doc: ${toStrip.join(', ')}`);
      } else {
        console.log('  nothing to strip');
      }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
