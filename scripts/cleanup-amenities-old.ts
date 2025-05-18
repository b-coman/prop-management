#!/usr/bin/env node

/**
 * Script to remove amenitiesOld fields from properties and propertyOverrides
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

async function cleanupProperties() {
  console.log('Cleaning up amenitiesOld from properties...\n');
  
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const propertyFiles = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of propertyFiles) {
    const propertyId = path.basename(file, '.json');
    const filePath = path.join(propertiesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if ('amenitiesOld' in content) {
      delete content.amenitiesOld;
      
      // Save updated file
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      
      // Update in Firestore
      await db.collection('properties').doc(propertyId).set(content);
      console.log(`✓ Cleaned up ${propertyId}`);
    } else {
      console.log(`- ${propertyId} (no amenitiesOld found)`);
    }
  }
}

async function cleanupPropertyOverrides() {
  console.log('\nCleaning up amenitiesOld from property overrides...\n');
  
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const overrideFiles = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json') && !f.endsWith('.obsolete'));
  
  for (const file of overrideFiles) {
    const propertyId = path.basename(file, '.json');
    const filePath = path.join(overridesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let cleaned = false;
    
    // Check details.amenities.categories
    if (content.details?.amenities?.categories) {
      for (const category of content.details.amenities.categories) {
        if ('amenitiesOld' in category) {
          delete category.amenitiesOld;
          cleaned = true;
        }
      }
    }
    
    if (cleaned) {
      // Save updated file
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      
      // Update in Firestore
      await db.collection('propertyOverrides').doc(propertyId).set(content);
      console.log(`✓ Cleaned up ${propertyId}`);
    } else {
      console.log(`- ${propertyId} (no amenitiesOld found)`);
    }
  }
}

async function main() {
  console.log('Starting cleanup of amenitiesOld fields...\n');
  
  try {
    await cleanupProperties();
    await cleanupPropertyOverrides();
    
    console.log('\n✓ Cleanup completed successfully!');
  } catch (error) {
    console.error('\n✗ Error during cleanup:', error);
    process.exit(1);
  }
}

main().catch(console.error);