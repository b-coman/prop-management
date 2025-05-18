// Migration script to convert legacy amenities array to amenityRefs
// This script:
// 1. Reads all properties with old "amenities" field
// 2. Converts them to use "amenityRefs" 
// 3. Removes the old "amenities" field
// 4. Saves the updated properties

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(path.resolve(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function migrateAmenitiesToRefs() {
  console.log('🚀 Starting amenities migration...');
  
  try {
    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const doc of propertiesSnapshot.docs) {
      const property = doc.data();
      
      // Check if property has old amenities field
      if (property.amenities && Array.isArray(property.amenities)) {
        console.log(`\nMigrating property: ${doc.id}`);
        console.log(`  Old amenities: ${property.amenities.join(', ')}`);
        
        // Create update object
        const updateData: any = {
          amenityRefs: property.amenities,  // Copy amenities to amenityRefs
          amenities: admin.firestore.FieldValue.delete()  // Delete old field
        };
        
        // Update the document
        await db.collection('properties').doc(doc.id).update(updateData);
        console.log(`  ✅ Migrated to amenityRefs`);
        migratedCount++;
      } else if (property.amenityRefs) {
        console.log(`\nSkipping property: ${doc.id} (already has amenityRefs)`);
        skippedCount++;
      } else {
        console.log(`\nSkipping property: ${doc.id} (no amenities found)`);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Migration completed!');
    console.log(`  Migrated: ${migratedCount} properties`);
    console.log(`  Skipped: ${skippedCount} properties`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateAmenitiesToRefs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });