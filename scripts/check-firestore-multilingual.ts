#!/usr/bin/env node

/**
 * Script to check what documents are currently in Firestore and their multilingual content
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('Error: FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH environment variable not set');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  require('fs').readFileSync(serviceAccountPath, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

function checkMultilingual(obj: any, path = ''): string[] {
  const multilingualFields: string[] = [];
  
  if (!obj || typeof obj !== 'object') return multilingualFields;
  
  // Check if this object itself is a multilingual field
  if ('en' in obj && 'ro' in obj) {
    multilingualFields.push(path || 'root');
    return multilingualFields;
  }
  
  // Recursively check nested objects
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object') {
      const nestedPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        // Check each item in array
        value.forEach((item, index) => {
          multilingualFields.push(...checkMultilingual(item, `${nestedPath}[${index}]`));
        });
      } else {
        multilingualFields.push(...checkMultilingual(value, nestedPath));
      }
    }
  }
  
  return multilingualFields;
}

async function checkCollection(collectionName: string): Promise<void> {
  console.log(`\n=== ${collectionName} ===`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log('  (empty collection)');
      return;
    }
    
    snapshot.forEach(doc => {
      console.log(`\n📄 ${doc.id}`);
      
      const data = doc.data();
      const multilingualFields = checkMultilingual(data);
      
      if (multilingualFields.length > 0) {
        console.log('  ✓ Has multilingual content:');
        multilingualFields.forEach(field => {
          console.log(`    - ${field}`);
        });
      } else {
        console.log('  ✗ No multilingual content detected');
      }
    });
  } catch (error) {
    console.error(`  Error checking collection:`, error);
  }
}

async function main() {
  console.log('Checking Firestore documents for multilingual content...\n');
  
  await checkCollection('properties');
  await checkCollection('propertyOverrides');
  await checkCollection('websiteTemplates');
  await checkCollection('pricingTemplates');
  await checkCollection('seasonalPricing');
  await checkCollection('dateOverrides');
  
  console.log('\n\n✅ Done checking Firestore documents.');
}

main().catch(console.error);