// scripts/update-property-theme-schema.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { DEFAULT_THEME_ID } from '../src/lib/themes/theme-definitions';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
console.log('✅ Environment variables loaded.');
console.log(`Project ID from env: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
    console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local. Cannot initialize Admin SDK.');
    process.exit(1);
}

try {
  if (!admin.apps.length) {
      const serviceAccountFullPath = path.resolve(serviceAccountPath);
      console.log('🔑 Initializing Firebase Admin SDK with service account:', serviceAccountFullPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFullPath),
      });
      console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
       console.log('ℹ️ Firebase Admin SDK app already initialized.');
  }
} catch (error) {
   console.error('❌ Firebase Admin SDK initialization failed:', error);
   console.error('   Check if the service account key path is correct and the file is valid JSON.');
   process.exit(1);
}

const db = admin.firestore();

async function updatePropertySchema() {
    console.log('Updating property schema to include themeId field...');
    
    try {
        // Get all properties
        const propertiesSnapshot = await db.collection('properties').get();
        
        if (propertiesSnapshot.empty) {
            console.log('No properties found in the database.');
            return;
        }
        
        // Counter for properties updated
        let updatedCount = 0;
        
        // Batch updates to properties
        for (const doc of propertiesSnapshot.docs) {
            const property = doc.data();
            
            // Only update if themeId doesn't exist
            if (!property.themeId) {
                console.log(`Updating property ${doc.id} to include themeId...`);
                
                // Assign a default theme ID
                await doc.ref.update({
                    themeId: DEFAULT_THEME_ID,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                updatedCount++;
                console.log(`✅ Added themeId to property ${doc.id}`);
            } else {
                console.log(`Property ${doc.id} already has themeId: ${property.themeId}`);
            }
        }
        
        console.log(`Schema update complete. Updated ${updatedCount} out of ${propertiesSnapshot.size} properties.`);
    } catch (error) {
        console.error('❌ Error updating property schema:', error);
        throw error;
    }
}

async function main() {
    console.log('--- Starting Property Schema Update Script ---');
    try {
        await updatePropertySchema();
        console.log('--- Schema update completed successfully ---');
    } catch (error) {
        console.error('--- Schema update failed ---');
        process.exit(1);
    }
}

main();