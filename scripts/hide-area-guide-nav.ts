// One-off remediation script: hide the "/area-guide" nav item + page for a
// property until real area-guide content is written (see PR fix/website-content-ux).
//
// The page currently renders template placeholder text ("Page Title" / "Page
// description goes here" — "Titlul paginii" / "Descrierea paginii" in RO)
// because propertyOverrides/<slug> has no "area-guide" content block, only a
// visiblePages entry + a menuItems nav link. This script removes just those
// two array entries via a targeted field update (re-reads the doc immediately
// before writing, and only ever removes the known "area-guide" entries — it
// never overwrites the document, so it cannot clobber other admin edits).
//
// NOT executed as part of the audit-fix PR — the operator should run this
// (or the admin UI equivalent) only after confirming there's no near-term
// plan to populate real area-guide content.
//
// Usage:
//   npx tsx scripts/hide-area-guide-nav.ts <slug> --dry-run   (default, prints the diff only)
//   npx tsx scripts/hide-area-guide-nav.ts <slug> --apply     (writes the change)
//
// Example:
//   npx tsx scripts/hide-area-guide-nav.ts prahova-mountain-chalet --apply

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');

  if (!slug) {
    console.error('Usage: npx tsx scripts/hide-area-guide-nav.ts <slug> [--apply]');
    process.exit(1);
  }

  const docRef = db.collection('propertyOverrides').doc(slug);
  const doc = await docRef.get();
  if (!doc.exists) {
    console.error(`propertyOverrides/${slug} not found`);
    process.exit(1);
  }

  const data = doc.data()!;
  const visiblePages: string[] = data.visiblePages || [];
  const menuItems: Array<{ url?: string; label?: unknown }> = data.menuItems || [];

  if (!visiblePages.includes('area-guide') && !menuItems.some((m) => m.url === '/area-guide')) {
    console.log(`propertyOverrides/${slug}: "area-guide" is not present in visiblePages or menuItems — nothing to do.`);
    process.exit(0);
  }

  const newVisiblePages = visiblePages.filter((p) => p !== 'area-guide');
  const newMenuItems = menuItems.filter((m) => m.url !== '/area-guide');

  console.log(`propertyOverrides/${slug}:`);
  console.log(`  visiblePages: ${visiblePages.length} -> ${newVisiblePages.length} (removing "area-guide")`);
  console.log(`  menuItems:    ${menuItems.length} -> ${newMenuItems.length} (removing "/area-guide" nav link)`);
  console.log('\nNote: this only hides the nav link and blocks direct page access via visiblePages.');
  console.log('The /area-guide route itself still exists in code — this is a content-level, not a code-level, hide.');

  if (!apply) {
    console.log('\nDry run only — nothing written. Re-run with --apply to write this change.');
    process.exit(0);
  }

  await docRef.update({
    visiblePages: newVisiblePages,
    menuItems: newMenuItems,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('\nWritten.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
