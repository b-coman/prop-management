#!/usr/bin/env node

/**
 * Script to migrate Firestore collections to multilingual format
 * This uploads the migrated JSON files to Firestore
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from the correct directory
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
// Also try .env as fallback
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

// Function to upload property files
async function uploadProperties(): Promise<void> {
  console.log('Uploading properties...');
  const propertiesDir = path.join(__dirname, '..', 'firestore', 'properties');
  const files = fs.readdirSync(propertiesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(propertiesDir, file), 'utf8'));
      const docId = path.basename(file, '.json');
      
      await db.collection('properties').doc(docId).set(content);
      console.log(`✓ Uploaded property: ${docId}`);
    } catch (error) {
      console.error(`✗ Error uploading ${file}:`, error);
    }
  }
}

// Function to upload property overrides
async function uploadPropertyOverrides(): Promise<void> {
  console.log('\nUploading property overrides...');
  const overridesDir = path.join(__dirname, '..', 'firestore', 'propertyOverrides');
  const files = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(overridesDir, file), 'utf8'));
      const docId = path.basename(file, '.json');
      
      await db.collection('propertyOverrides').doc(docId).set(content);
      console.log(`✓ Uploaded override: ${docId}`);
    } catch (error) {
      console.error(`✗ Error uploading ${file}:`, error);
    }
  }
}

// Function to upload website templates
async function uploadWebsiteTemplates(): Promise<void> {
  console.log('\nUploading website templates...');
  const templatesDir = path.join(__dirname, '..', 'firestore', 'websiteTemplates');
  const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(templatesDir, file), 'utf8'));
      const docId = path.basename(file, '.json');
      
      await db.collection('websiteTemplates').doc(docId).set(content);
      console.log(`✓ Uploaded template: ${docId}`);
    } catch (error) {
      console.error(`✗ Error uploading ${file}:`, error);
    }
  }
}

// Function to upload pricing templates if they exist
async function uploadPricingTemplates(): Promise<void> {
  const pricingTemplatesDir = path.join(__dirname, '..', 'firestore', 'pricingTemplates');
  
  if (!fs.existsSync(pricingTemplatesDir)) {
    console.log('\nNo pricing templates directory found, skipping...');
    return;
  }
  
  console.log('\nUploading pricing templates...');
  const files = fs.readdirSync(pricingTemplatesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(pricingTemplatesDir, file), 'utf8'));
      const docId = path.basename(file, '.json');
      
      await db.collection('pricingTemplates').doc(docId).set(content);
      console.log(`✓ Uploaded pricing template: ${docId}`);
    } catch (error) {
      console.error(`✗ Error uploading ${file}:`, error);
    }
  }
}

// Main migration function
async function runMigration(): Promise<void> {
  console.log('Starting Firestore multilingual migration...\n');
  
  try {
    await uploadProperties();
    await uploadPropertyOverrides();
    await uploadWebsiteTemplates();
    await uploadPricingTemplates();
    
    console.log('\n✓ Firestore migration completed successfully!');
    console.log('\nIMPORTANT: Remember to:');
    console.log('1. Review the uploaded documents in Firebase Console');
    console.log('2. Test the multilanguage functionality in your application');
    console.log('3. Manually translate Romanian content where needed');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { uploadProperties, uploadPropertyOverrides, uploadWebsiteTemplates };