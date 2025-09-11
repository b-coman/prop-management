#!/usr/bin/env node

/**
 * Script to update features structure in property overrides
 * Wraps existing features array with title and description
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
  fs.readFileSync(serviceAccountPath, 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateFeaturesStructure() {
  console.log('Updating features structure in property overrides...\n');
  
  const propertyId = 'prahova-mountain-chalet';
  console.log(`Updating ${propertyId}...`);
  
  // Get current document
  const docRef = db.collection('propertyOverrides').doc(propertyId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    console.error(`Document ${propertyId} not found`);
    return;
  }
  
  const data = doc.data();
  const currentFeatures = data?.homepage?.features;
  
  if (!currentFeatures || !Array.isArray(currentFeatures)) {
    console.error('Current features not found or not an array');
    return;
  }
  
  console.log(`Found ${currentFeatures.length} features to wrap`);
  
  // Create new structure with title and description
  const newFeaturesStructure = {
    title: {
      en: "Unique Features",
      ro: "Caracteristici Unice"
    },
    description: {
      en: "Discover what makes this chalet special",
      ro: "Descoperă ce face această cabană specială"
    },
    features: currentFeatures
  };
  
  // Update only the features field
  await docRef.update({
    'homepage.features': newFeaturesStructure
  });
  
  console.log(`✓ Updated ${propertyId} features structure`);
  console.log('New structure:');
  console.log('- Added title in English and Romanian');
  console.log('- Added description in English and Romanian');  
  console.log(`- Preserved ${currentFeatures.length} existing features`);
  
  console.log('\n✓ Features structure updated successfully!');
}

updateFeaturesStructure().catch(console.error);