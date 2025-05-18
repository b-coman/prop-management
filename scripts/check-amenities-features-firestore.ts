#!/usr/bin/env node

/**
 * Script to check if amenities and features collections exist in Firestore
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

async function checkCollections() {
  console.log('Checking Firestore collections...\n');

  // Check amenities collection
  console.log('Checking amenities collection:');
  try {
    const amenitiesSnapshot = await db.collection('amenities').get();
    console.log(`Found ${amenitiesSnapshot.size} documents in amenities collection`);
    
    if (amenitiesSnapshot.size > 0) {
      console.log('Sample amenities:');
      let count = 0;
      amenitiesSnapshot.forEach(doc => {
        if (count < 5) {
          console.log(`  - ${doc.id}`);
          count++;
        }
      });
    }
  } catch (error) {
    console.error('Error accessing amenities collection:', error);
  }

  console.log('\nChecking features collection:');
  try {
    const featuresSnapshot = await db.collection('features').get();
    console.log(`Found ${featuresSnapshot.size} documents in features collection`);
    
    if (featuresSnapshot.size > 0) {
      console.log('Sample features:');
      let count = 0;
      featuresSnapshot.forEach(doc => {
        if (count < 5) {
          console.log(`  - ${doc.id}`);
          count++;
        }
      });
    }
  } catch (error) {
    console.error('Error accessing features collection:', error);
  }

  // Check if properties are using references
  console.log('\nChecking property amenity references:');
  const propsSnapshot = await db.collection('properties').get();
  propsSnapshot.forEach(doc => {
    const data = doc.data();
    if (Array.isArray(data.amenities)) {
      console.log(`${doc.id}: ${data.amenities.join(', ')}`);
    }
  });
}

checkCollections().catch(console.error);