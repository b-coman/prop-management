#!/usr/bin/env node

/**
 * Script to check what documents are currently in Firestore
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

async function checkCollection(collectionName: string): Promise<void> {
  console.log(`\nChecking ${collectionName}:`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log('  (empty collection)');
      return;
    }
    
    snapshot.forEach(doc => {
      console.log(`  - ${doc.id}`);
      
      // Check if it has multilingual structure
      const data = doc.data();
      const hasMultilingual = Object.keys(data).some(key => {
        const value = data[key];
        return typeof value === 'object' && value !== null && 'en' in value && 'ro' in value;
      });
      
      if (hasMultilingual) {
        console.log('    ✓ Has multilingual content');
      } else {
        console.log('    ✗ No multilingual content detected');
      }
    });
  } catch (error) {
    console.error(`  Error checking collection:`, error);
  }
}

async function main() {
  console.log('Checking Firestore documents...\n');
  
  await checkCollection('properties');
  await checkCollection('propertyOverrides');
  await checkCollection('websiteTemplates');
  await checkCollection('pricingTemplates');
  await checkCollection('priceCalendars');
  await checkCollection('seasonalPricing');
  await checkCollection('dateOverrides');
  
  console.log('\nDone checking Firestore documents.');
}

main().catch(console.error);