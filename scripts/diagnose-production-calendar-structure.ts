import * as admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin SDK
let serviceAccount: any;
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  console.log('✓ Using service account from path:', serviceAccountPath);
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  console.log('✓ Using service account from environment variable');
} else {
  console.error('❌ Error: No service account credentials found');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('✓ Firebase Admin SDK initialized');
}

const db = admin.firestore();

/**
 * Diagnose the structure of price calendars in Firestore
 */
async function diagnoseCalendarStructure() {
  // Get arguments
  const propertyId = process.argv[2] || 'prahova-mountain-chalet';
  const year = process.argv[3] || '2025';
  const month = process.argv[4] || '05'; // Default to May 2025
  
  console.log(`\n===== Price Calendar Structure Diagnosis =====`);
  console.log(`Property: ${propertyId}`);
  console.log(`Calendar: ${year}-${month}`);
  console.log(`===============================================\n`);
  
  // Format document ID (propertyId_YYYY-MM)
  const calendarId = `${propertyId}_${year}-${month}`;
  console.log(`Looking for price calendar: ${calendarId}`);
  
  try {
    // Get the document
    const doc = await db.collection('priceCalendars').doc(calendarId).get();
    
    if (!doc.exists) {
      console.log(`❌ Calendar not found: ${calendarId}`);
      
      // Check format by listing some available calendars
      console.log(`\nListing available calendars for ${propertyId}...`);
      const snapshot = await db.collection('priceCalendars')
        .where('propertyId', '==', propertyId)
        .limit(5)
        .get();
      
      if (snapshot.empty) {
        console.log(`No calendars found for property ${propertyId}`);
      } else {
        console.log(`Found ${snapshot.size} calendars:`);
        snapshot.docs.forEach(doc => {
          console.log(`- ${doc.id}`);
        });
      }
      
      return;
    }
    
    // Get the data
    const calendarData = doc.data();
    
    console.log(`\n✓ Calendar found: ${calendarId}`);
    console.log(`Document data structure analysis:`);
    
    // Check for days object
    const hasDays = !!calendarData.days && typeof calendarData.days === 'object';
    console.log(`- Has 'days' structure: ${hasDays ? 'YES' : 'NO'}`);
    
    // Check for prices object
    const hasPrices = !!calendarData.prices && typeof calendarData.prices === 'object';
    console.log(`- Has 'prices' structure: ${hasPrices ? 'YES' : 'NO'}`);
    
    // Examine the top-level fields
    console.log(`\nTop-level fields:`);
    Object.keys(calendarData).forEach(key => {
      const value = calendarData[key];
      if (typeof value === 'object' && value !== null) {
        console.log(`- ${key}: [Object with ${Object.keys(value).length} entries]`);
      } else {
        console.log(`- ${key}: ${value}`);
      }
    });
    
    // Analyze internal structure
    console.log(`\nDetailed structure analysis:`);
    
    // Check days if available
    if (hasDays) {
      const daysSample = Object.keys(calendarData.days).slice(0, 3);
      console.log(`'days' structure sample (first 3 entries):`);
      daysSample.forEach(day => {
        console.log(`  Day ${day}:`, calendarData.days[day]);
      });
    }
    
    // Check prices if available
    if (hasPrices) {
      const pricesSample = Object.keys(calendarData.prices).slice(0, 3);
      console.log(`'prices' structure sample (first 3 entries):`);
      pricesSample.forEach(date => {
        console.log(`  Date ${date}:`, calendarData.prices[date]);
      });
      
      // Check if prices entries have 'baseOccupancyPrice'
      const firstPriceKey = Object.keys(calendarData.prices)[0];
      const firstPrice = calendarData.prices[firstPriceKey];
      console.log(`\nPrice entry structure check:`);
      
      // Check critical fields
      console.log(`- Has baseOccupancyPrice: ${firstPrice?.baseOccupancyPrice !== undefined ? 'YES' : 'NO'}`);
      console.log(`- Has basePrice: ${firstPrice?.basePrice !== undefined ? 'YES' : 'NO'}`);
      console.log(`- Has adjustedPrice: ${firstPrice?.adjustedPrice !== undefined ? 'YES' : 'NO'}`);
      console.log(`- Has available: ${firstPrice?.available !== undefined ? 'YES' : 'NO'}`);
      console.log(`- Has occupancy prices object: ${firstPrice?.prices !== undefined ? 'YES' : 'NO'}`);
      
      // If there's an inner prices object, check it
      if (firstPrice?.prices) {
        console.log(`  Inner 'prices' object: ${JSON.stringify(firstPrice.prices)}`);
      }
    }
    
    // Save full structure to file for further analysis
    const outputPath = path.join(process.cwd(), 'calendar-structure-analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(calendarData, null, 2));
    console.log(`\nFull structure saved to: ${outputPath}`);
    
    // Provide guidance based on the finding
    console.log(`\n===== DIAGNOSIS RESULT =====`);
    if (hasPrices && !hasDays) {
      console.log(`✅ CONFIRMED: Calendar uses 'prices' structure and lacks 'days' structure.`);
      console.log(`This explains why the API is having trouble processing guest counts correctly.`);
      console.log(`The API expects a 'days' structure, but is receiving a 'prices' structure.`);
    } else if (hasDays && !hasPrices) {
      console.log(`Calendar uses 'days' structure and lacks 'prices' structure.`);
      console.log(`This suggests the API should be working correctly with guest counts.`);
      console.log(`Check for other issues that might be affecting the API.`);
    } else if (hasDays && hasPrices) {
      console.log(`Calendar has both 'days' and 'prices' structures.`);
      console.log(`This suggests a hybrid or transition state. Check if both structures are valid and in sync.`);
    } else {
      console.log(`❌ Calendar has neither 'days' nor 'prices' structure!`);
      console.log(`This is unexpected and suggests data corruption or a completely different format.`);
    }
    
  } catch (error) {
    console.error('Error accessing Firestore:', error);
  }
}

// Run the diagnosis
diagnoseCalendarStructure()
  .then(() => {
    console.log('\nDiagnosis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nDiagnosis failed:', error);
    process.exit(1);
  });