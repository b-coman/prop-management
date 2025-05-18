#!/usr/bin/env node

/**
 * Script to backup Firestore data and then migrate to multilingual format
 * This creates a backup before uploading the migrated JSON files
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

// Create backup directory with timestamp
const backupDir = path.join(__dirname, '..', 'firestore-backup', new Date().toISOString().replace(/:/g, '-'));

// Function to backup a collection
async function backupCollection(collectionName: string): Promise<void> {
  console.log(`Backing up ${collectionName}...`);
  
  const collectionBackupDir = path.join(backupDir, collectionName);
  if (!fs.existsSync(collectionBackupDir)) {
    fs.mkdirSync(collectionBackupDir, { recursive: true });
  }
  
  try {
    const snapshot = await db.collection(collectionName).get();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const filePath = path.join(collectionBackupDir, `${doc.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  ✓ Backed up: ${doc.id}`);
    }
    
    console.log(`✓ Backed up ${snapshot.docs.length} documents from ${collectionName}\n`);
  } catch (error) {
    console.error(`✗ Error backing up ${collectionName}:`, error);
    throw error;
  }
}

// Function to backup all collections
async function backupAllCollections(): Promise<void> {
  console.log(`Creating backup in: ${backupDir}\n`);
  
  const collections = [
    'properties',
    'propertyOverrides', 
    'websiteTemplates',
    'pricingTemplates'
  ];
  
  for (const collection of collections) {
    try {
      await backupCollection(collection);
    } catch (error) {
      // Continue with other collections even if one fails
      console.warn(`Warning: Could not backup ${collection}, continuing...`);
    }
  }
}

// Function to upload migrated data
async function uploadMigratedData(collectionName: string, dirName: string): Promise<void> {
  console.log(`Uploading ${collectionName}...`);
  
  const dataDir = path.join(__dirname, '..', 'firestore', dirName);
  if (!fs.existsSync(dataDir)) {
    console.log(`  No ${dirName} directory found, skipping...`);
    return;
  }
  
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
      const docId = path.basename(file, '.json');
      
      await db.collection(collectionName).doc(docId).set(content);
      console.log(`  ✓ Uploaded: ${docId}`);
    } catch (error) {
      console.error(`  ✗ Error uploading ${file}:`, error);
    }
  }
  
  console.log(`✓ Uploaded ${files.length} documents to ${collectionName}\n`);
}

// Main migration function
async function runMigration(): Promise<void> {
  console.log('Starting Firestore backup and migration...\n');
  
  try {
    // First, backup all existing data
    console.log('Phase 1: Backing up existing data...\n');
    await backupAllCollections();
    
    console.log('Phase 2: Uploading migrated multilingual data...\n');
    
    // Then upload the migrated data
    await uploadMigratedData('properties', 'properties');
    await uploadMigratedData('propertyOverrides', 'propertyOverrides');
    await uploadMigratedData('websiteTemplates', 'websiteTemplates');
    await uploadMigratedData('pricingTemplates', 'pricingTemplates');
    
    console.log('✓ Firestore migration completed successfully!');
    console.log(`\nBackup saved to: ${backupDir}`);
    console.log('\nIMPORTANT: Remember to:');
    console.log('1. Review the uploaded documents in Firebase Console');
    console.log('2. Test the multilanguage functionality in your application');
    console.log('3. Keep the backup directory in case you need to rollback');
    console.log('4. Manually translate Romanian content where needed');
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    console.log(`\nBackup saved to: ${backupDir}`);
    console.log('You can restore from this backup if needed.');
    process.exit(1);
  }
}

// Add restore function for emergencies
export async function restoreFromBackup(backupPath: string): Promise<void> {
  console.log(`Restoring from backup: ${backupPath}\n`);
  
  const collections = fs.readdirSync(backupPath);
  
  for (const collection of collections) {
    const collectionPath = path.join(backupPath, collection);
    const files = fs.readdirSync(collectionPath).filter(f => f.endsWith('.json'));
    
    console.log(`Restoring ${collection}...`);
    
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(collectionPath, file), 'utf8'));
        const docId = path.basename(file, '.json');
        
        await db.collection(collection).doc(docId).set(content);
        console.log(`  ✓ Restored: ${docId}`);
      } catch (error) {
        console.error(`  ✗ Error restoring ${file}:`, error);
      }
    }
    
    console.log(`✓ Restored ${files.length} documents to ${collection}\n`);
  }
  
  console.log('✓ Restore completed!');
}

// Run the migration
if (require.main === module) {
  // Check if we're in restore mode
  if (process.argv[2] === '--restore' && process.argv[3]) {
    restoreFromBackup(process.argv[3])
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Restore failed:', error);
        process.exit(1);
      });
  } else {
    runMigration()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
      });
  }
}