import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
let serviceAccount;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('✓ Using service account from path');
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('✓ Using service account from environment variable');
} else {
  console.error('No Firebase service account credentials found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✓ Firebase Admin initialized');
}

const db = admin.firestore();

/**
 * Verify the exact path to a calendar document
 */
async function testPricingPath() {
  const propertyId = 'prahova-mountain-chalet';
  const year = 2025;
  const month = 6;
  const monthStr = month.toString().padStart(2, '0');

  console.log('Testing exact path to pricing calendar...');
  console.log(`Property: ${propertyId}`);
  console.log(`Year-Month: ${year}-${monthStr}`);
  console.log('---');

  // Test the expected document ID format
  const calendarId = `${propertyId}_${year}-${monthStr}`;
  console.log(`Looking for document ID: ${calendarId}`);
  
  try {
    const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
    
    if (calendarDoc.exists) {
      console.log('✓ Calendar exists!');
      const data = calendarDoc.data();
      console.log(`Month: ${data.month}`);
      console.log(`Year: ${data.year}`);
      console.log(`Days: ${Object.keys(data.days || {}).length}`);
      
      // Check a specific day
      const day15 = data.days['15'];
      if (day15) {
        console.log('\nStructure of day 15:');
        console.log(JSON.stringify(day15, null, 2));
      } else {
        console.log('Day 15 not found in calendar');
      }
    } else {
      console.log('✗ Calendar not found with expected ID');
      
      // Try to find if any calendar exists for this period
      const calendarsQuery = await db.collection('priceCalendars')
        .where('propertyId', '==', propertyId)
        .where('year', '==', year)
        .get();
      
      if (calendarsQuery.empty) {
        console.log('No calendars found for this property and year');
      } else {
        console.log('\nFound calendars with different IDs:');
        calendarsQuery.forEach(doc => {
          console.log(`- ${doc.id} (Month: ${doc.data().month})`);
        });
      }
      
      // Also try the alternate format
      const alternateId = `${propertyId}-${year}`;
      const alternateDoc = await db.collection('priceCalendars').doc(alternateId).get();
      if (alternateDoc.exists) {
        console.log(`\n✓ Found calendar with alternate ID: ${alternateId}`);
        console.log('This suggests the calendars are using a different format than expected');
      }
    }
  } catch (error) {
    console.error('Error accessing Firestore:', error);
  }
}

// Run the test
testPricingPath().catch(console.error);