/**
 * Initialize missing availability documents for prahova-mountain-chalet
 * Addresses the missing future months for the main development property
 */

import { getFirestoreForPricing } from '../src/lib/firebaseAdminPricing';
import { format, addMonths } from 'date-fns';

async function initializePrahovaAvailability() {
  console.log('Initializing missing availability documents for prahova-mountain-chalet');
  console.log('===================================================================');
  
  const db = await getFirestoreForPricing();
  if (!db) {
    throw new Error('Failed to connect to Firestore');
  }

  const propertyId = 'prahova-mountain-chalet';
  
  // Check months from July 2025 onwards
  const months = [];
  const today = new Date();
  for (let i = 1; i <= 6; i++) {
    const date = addMonths(today, i);
    months.push(format(date, 'yyyy-MM'));
  }
  
  console.log(`Checking ${months.length} months: ${months.join(', ')}`);
  
  const batch = db.batch();
  let operationsCount = 0;
  
  for (const month of months) {
    const docId = `${propertyId}_${month}`;
    
    // Check if documents exist
    const [availabilityDoc, priceCalendarDoc] = await Promise.all([
      db.collection('availability').doc(docId).get(),
      db.collection('priceCalendars').doc(docId).get()
    ]);
    
    // If priceCalendars exists but availability doesn't
    if (priceCalendarDoc.exists && !availabilityDoc.exists) {
      const priceData = priceCalendarDoc.data();
      const days = priceData?.days || {};
      
      // Create availability document
      const availabilityData = {
        propertyId,
        month,
        available: {} as Record<string, boolean>,
        holds: {} as Record<string, string | null>,
        createdAt: new Date(),
        updatedAt: new Date(),
        migratedFrom: 'priceCalendars',
        migrationTimestamp: new Date().toISOString()
      };
      
      // Copy availability from priceCalendars
      for (const [day, dayData] of Object.entries(days)) {
        availabilityData.available[day] = (dayData as any)?.available !== false;
      }
      
      const availabilityRef = db.collection('availability').doc(docId);
      batch.set(availabilityRef, availabilityData);
      operationsCount++;
      
      console.log(`  Queue: Initialize ${docId} with ${Object.keys(days).length} days`);
    } else if (availabilityDoc.exists) {
      console.log(`  Skip: ${docId} already exists`);
    } else {
      console.log(`  Skip: ${docId} - no priceCalendars document found`);
    }
  }
  
  if (operationsCount > 0) {
    console.log(`\nExecuting ${operationsCount} operations...`);
    await batch.commit();
    console.log(`Successfully initialized ${operationsCount} availability documents`);
  } else {
    console.log('\nNo operations needed - all documents already exist');
  }
  
  // Verify the results
  console.log('\nVerification:');
  for (const month of months) {
    const docId = `${propertyId}_${month}`;
    const availabilityDoc = await db.collection('availability').doc(docId).get();
    console.log(`  ${month}: ${availabilityDoc.exists ? 'EXISTS' : 'MISSING'}`);
  }
}

// Main execution
async function main() {
  try {
    await initializePrahovaAvailability();
    console.log('\nInitialization completed successfully!');
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { initializePrahovaAvailability };