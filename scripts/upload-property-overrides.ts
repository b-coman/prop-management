#!/usr/bin/env node

/**
 * Targeted script to upload a single propertyOverrides document to Firestore.
 * Unlike migrate-firestore-to-multilingual.ts, this ONLY touches propertyOverrides
 * and does NOT affect properties, websiteTemplates, or other collections.
 *
 * Usage:
 *   npx tsx scripts/upload-property-overrides.ts <slug>
 *   npx tsx scripts/upload-property-overrides.ts prahova-mountain-chalet
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: npx tsx scripts/upload-property-overrides.ts <property-slug>');
  console.error('Example: npx tsx scripts/upload-property-overrides.ts prahova-mountain-chalet');
  process.exit(1);
}

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Error: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH environment variable not set');
  process.exit(1);
}

const filePath = path.join(__dirname, '..', 'firestore', 'propertyOverrides', `${slug}.json`);
if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found: ${filePath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function main() {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`Uploading propertyOverrides/${slug}...`);
  console.log(`Source: ${filePath}`);
  console.log(`Document size: ${JSON.stringify(content).length} bytes`);

  await db.collection('propertyOverrides').doc(slug).set(content);

  console.log(`\nDone. propertyOverrides/${slug} has been updated in Firestore.`);
  console.log('No other collections were touched.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Upload failed:', error);
    process.exit(1);
  });
