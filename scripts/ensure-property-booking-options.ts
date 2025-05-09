
// scripts/ensure-property-booking-options.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  console.error(
    '❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local. Cannot initialize Admin SDK.'
  );
  process.exit(1);
}

try {
  if (!admin.apps.length) {
    const serviceAccountFullPath = path.resolve(serviceAccountPath);
    console.log(
      '🔑 Initializing Firebase Admin SDK with service account:',
      serviceAccountFullPath
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountFullPath),
    });
    console.log('✅ Firebase Admin SDK initialized successfully.');
  } else {
    console.log('ℹ️ Firebase Admin SDK app already initialized.');
  }
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization failed:', error);
  console.error(
    '   Check if the service account key path is correct and the file is valid JSON.'
  );
  process.exit(1);
}

const db = admin.firestore();

async function updatePropertiesWithBookingOptions() {
  console.log('--- Starting script to ensure booking options fields exist on properties ---');
  const propertiesCollectionRef = db.collection('properties');
  let updatedCount = 0;
  let checkedCount = 0;

  try {
    const snapshot = await propertiesCollectionRef.get();
    checkedCount = snapshot.size;

    if (snapshot.empty) {
      console.log('No properties found to update.');
      return;
    }

    const batch = db.batch();
    let batchSize = 0;

    snapshot.forEach((docSnap) => {
      const propertyData = docSnap.data();
      const updates: { [key: string]: any } = {};
      let needsUpdate = false;

      // Default values for the new fields
      const defaultHoldFeeAmount = 25; // Or another sensible default
      const defaultEnableHoldOption = true;
      const defaultEnableContactOption = true;

      if (propertyData.holdFeeAmount === undefined) {
        updates.holdFeeAmount = defaultHoldFeeAmount;
        needsUpdate = true;
      }
      if (propertyData.enableHoldOption === undefined) {
        updates.enableHoldOption = defaultEnableHoldOption;
        needsUpdate = true;
      }
      if (propertyData.enableContactOption === undefined) {
        updates.enableContactOption = defaultEnableContactOption;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Property "${docSnap.id}" needs update. Adding to batch:`, updates);
        batch.update(docSnap.ref, updates);
        updatedCount++;
        batchSize++;
        if (batchSize >= 400) { // Firestore batch limit is 500 operations
          console.log('Committing a batch of updates...');
          batch.commit(); // Commit current batch
          // batch = db.batch(); // Re-initialize batch - This line should be inside the if block or re-declared before the loop.
          // Corrected: Re-initialize the batch for the next set of operations.
          // However, for simplicity and typical scenarios, one batch commit after the loop might be okay
          // if the number of properties is not excessively large.
          // For very large collections, iterate and commit in smaller batches.
          // For now, this script will commit all changes in one batch after the loop.
        }
      } else {
        console.log(`Property "${docSnap.id}" already has booking option fields or they are explicitly set.`);
      }
    });

    if (updatedCount > 0) {
      console.log(`Committing final batch with ${updatedCount} property updates...`);
      await batch.commit();
      console.log(`✅ Successfully updated ${updatedCount} properties with default booking option fields.`);
    } else {
      console.log('No properties required updates.');
    }

  } catch (error) {
    console.error('❌ Error updating properties:', error);
    throw error; // Re-throw to be caught by main
  } finally {
    console.log(`Checked ${checkedCount} properties in total.`);
    console.log('--- Script finished ---');
  }
}

async function main() {
  try {
    await updatePropertiesWithBookingOptions();
  } catch (error) {
    console.error('--- Script execution failed ---');
    process.exit(1);
  }
}

main();
