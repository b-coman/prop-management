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
 * Fix price calendar structure to match the expected schema
 */
async function fixPriceCalendarStructure() {
  const propertyId = 'prahova-mountain-chalet'; // The property with issues
  const startYear = 2025;
  const endYear = 2026;
  
  console.log('Fixing price calendar structure...');
  console.log(`Property: ${propertyId}`);
  console.log(`Years: ${startYear}-${endYear}`);
  console.log('---');
  
  // Get all price calendars for this property and date range
  const calendarsSnapshot = await db.collection('priceCalendars')
    .where('propertyId', '==', propertyId)
    .get();
  
  if (calendarsSnapshot.empty) {
    console.log('No calendars found for this property');
    return;
  }
  
  let fixedCalendars = 0;
  
  for (const calendarDoc of calendarsSnapshot.docs) {
    const calendarId = calendarDoc.id;
    const calendarData = calendarDoc.data();
    
    console.log(`\nProcessing calendar: ${calendarId}`);
    
    // Skip calendars outside our target years
    const year = calendarData.year;
    if (year < startYear || year > endYear) {
      console.log(`  Skipping calendar for year ${year} (outside target range)`);
      continue;
    }
    
    // Check if this calendar has the days object
    if (!calendarData.days || typeof calendarData.days !== 'object') {
      console.log(`  ✗ Calendar missing days object`);
      continue;
    }
    
    // Process each day
    let fixedDays = 0;
    const updatedDays = { ...calendarData.days };
    
    for (const [dayNum, dayData] of Object.entries(calendarData.days)) {
      // Check if this day needs fixing
      if (dayData.baseOccupancyPrice === undefined && 
          (dayData.basePrice !== undefined || dayData.adjustedPrice !== undefined)) {
        
        // Convert to the expected structure
        const basePrice = dayData.adjustedPrice || dayData.basePrice;
        
        updatedDays[dayNum] = {
          ...dayData,
          baseOccupancyPrice: basePrice,
        };
        
        fixedDays++;
      }
    }
    
    // Update the calendar if any days were fixed
    if (fixedDays > 0) {
      console.log(`  ✓ Fixing ${fixedDays} days in calendar ${calendarId}`);
      
      await db.collection('priceCalendars').doc(calendarId).update({
        days: updatedDays
      });
      
      fixedCalendars++;
    } else {
      console.log(`  ✓ No issues found in calendar ${calendarId}`);
    }
  }
  
  console.log('\n---');
  if (fixedCalendars > 0) {
    console.log(`✓ Fixed ${fixedCalendars} calendars successfully`);
  } else {
    console.log('No calendars needed fixes');
  }
}

// Run the fix
fixPriceCalendarStructure().catch(console.error);