#!/usr/bin/env node

/**
 * Script to fix Firestore migration after file renames
 * This will:
 * 1. Delete the -multipage documents
 * 2. Re-upload the correct multilingual files
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

// Delete multipage documents
async function deleteMultipageDocuments(): Promise<void> {
  console.log('Deleting -multipage documents...\n');
  
  // Delete from propertyOverrides
  try {
    await db.collection('propertyOverrides').doc('prahova-mountain-chalet-multipage').delete();
    console.log('✓ Deleted propertyOverrides/prahova-mountain-chalet-multipage');
  } catch (error) {
    console.log('✗ Error deleting propertyOverrides/prahova-mountain-chalet-multipage:', error);
  }
  
  // Delete from websiteTemplates
  try {
    await db.collection('websiteTemplates').doc('holiday-house-multipage').delete();
    console.log('✓ Deleted websiteTemplates/holiday-house-multipage');
  } catch (error) {
    console.log('✗ Error deleting websiteTemplates/holiday-house-multipage:', error);
  }
  
  console.log();
}

// Re-upload the correct files
async function reuploadCorrectFiles(): Promise<void> {
  console.log('Re-uploading correct multilingual files...\n');
  
  // Upload propertyOverrides
  const propertyOverridePath = path.join(__dirname, '..', 'firestore', 'propertyOverrides', 'prahova-mountain-chalet.json');
  if (fs.existsSync(propertyOverridePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(propertyOverridePath, 'utf8'));
      await db.collection('propertyOverrides').doc('prahova-mountain-chalet').set(content);
      console.log('✓ Uploaded propertyOverrides/prahova-mountain-chalet');
    } catch (error) {
      console.error('✗ Error uploading propertyOverrides:', error);
    }
  }
  
  // Upload websiteTemplates
  const templatePath = path.join(__dirname, '..', 'firestore', 'websiteTemplates', 'holiday-house.json');
  if (fs.existsSync(templatePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
      await db.collection('websiteTemplates').doc('holiday-house').set(content);
      console.log('✓ Uploaded websiteTemplates/holiday-house');
    } catch (error) {
      console.error('✗ Error uploading websiteTemplates:', error);
    }
  }
  
  // Upload other collections that might need multilingual content
  const collections = [
    { name: 'pricingTemplates', files: ['default.json'] },
    { name: 'seasonalPricing', files: ['summer-season-2024.json', 'winter-season-2023.json'] },
    { name: 'dateOverrides', files: ['christmas-2023.json', 'easter-2024.json', 'new-years-eve-2023.json'] }
  ];
  
  for (const collection of collections) {
    console.log(`\nUpdating ${collection.name}...`);
    
    for (const file of collection.files) {
      const filePath = path.join(__dirname, '..', 'firestore', collection.name, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const docId = path.basename(file, '.json');
          await db.collection(collection.name).doc(docId).set(content);
          console.log(`✓ Uploaded ${collection.name}/${docId}`);
        } catch (error) {
          console.error(`✗ Error uploading ${collection.name}/${file}:`, error);
        }
      }
    }
  }
  
  console.log('\n✓ Re-upload completed!');
}

// Main function
async function main() {
  console.log('Fixing Firestore migration...\n');
  
  // Step 1: Delete multipage documents
  await deleteMultipageDocuments();
  
  // Step 2: Re-upload correct files
  await reuploadCorrectFiles();
  
  console.log('\n✓ Migration fix completed!');
  console.log('\nNext steps:');
  console.log('1. Check Firebase Console to verify the documents');
  console.log('2. Test the multilingual functionality in your app');
  console.log('3. Manually translate Romanian content where needed');
}

main().catch(console.error);