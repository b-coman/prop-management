// Utility script to query live Firestore data
// Usage: npx tsx scripts/query-firestore.ts <collection> [docId] [fields...]
// Examples:
//   npx tsx scripts/query-firestore.ts properties
//   npx tsx scripts/query-firestore.ts properties prahova-mountain-chalet
//   npx tsx scripts/query-firestore.ts properties -- baseCurrency pricePerNight status
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
  const collection = args[0];

  if (!collection) {
    console.error('Usage: npx tsx scripts/query-firestore.ts <collection> [docId] [-- field1 field2 ...]');
    process.exit(1);
  }

  // Parse args: collection [docId] [-- field1 field2 ...]
  let docId: string | undefined;
  let fields: string[] = [];

  const dashIndex = args.indexOf('--');
  if (dashIndex > 0) {
    fields = args.slice(dashIndex + 1);
    docId = dashIndex > 1 ? args[1] : undefined;
  } else {
    docId = args[1];
  }

  if (docId) {
    // Single document
    const doc = await db.collection(collection).doc(docId).get();
    if (!doc.exists) {
      console.error(`Document ${collection}/${docId} not found`);
      process.exit(1);
    }
    const data = doc.data()!;
    if (fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      for (const f of fields) {
        filtered[f] = data[f];
      }
      console.log(JSON.stringify(filtered, null, 2));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } else {
    // All documents in collection
    const snap = await db.collection(collection).get();
    console.log(`Found ${snap.size} documents in '${collection}':\n`);
    snap.forEach((doc) => {
      const data = doc.data();
      console.log(`--- ${doc.id} ---`);
      if (fields.length > 0) {
        for (const f of fields) {
          console.log(`  ${f}: ${JSON.stringify(data[f])}`);
        }
      } else {
        console.log(JSON.stringify(data, null, 2).substring(0, 500));
        if (JSON.stringify(data).length > 500) console.log('  ... (truncated)');
      }
      console.log('');
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
