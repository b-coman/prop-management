import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { addMonths, format } from 'date-fns';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
function initializeFirebase() {
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

  return admin.firestore();
}

/**
 * Monitor price calendars for issues
 */
async function monitorPriceCalendars() {
  const db = initializeFirebase();
  const issues: string[] = [];
  const now = new Date();
  
  console.log('Monitoring price calendars for issues...');
  console.log('---');

  // Get all active properties
  const propertiesSnapshot = await db.collection('properties').get();
  if (propertiesSnapshot.empty) {
    console.error('No properties found');
    return;
  }

  // For each property, check price calendars for the next 12 months
  for (const propertyDoc of propertiesSnapshot.docs) {
    const propertyId = propertyDoc.id;
    console.log(`\nChecking calendars for property: ${propertyId}`);
    
    for (let i = 0; i < 12; i++) {
      const targetDate = addMonths(now, i);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const monthStr = month.toString().padStart(2, '0');
      const monthName = format(targetDate, 'MMMM yyyy');
      
      const calendarId = `${propertyId}_${year}-${monthStr}`;
      console.log(`- Checking calendar: ${calendarId} (${monthName})`);
      
      // Check if calendar exists
      const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
      if (!calendarDoc.exists) {
        const issue = `Missing calendar: ${calendarId} (${monthName}) for property ${propertyId}`;
        console.error(`  ✗ ${issue}`);
        issues.push(issue);
        continue;
      }
      
      // Validate calendar structure
      const data = calendarDoc.data();
      if (!data.month || !data.year || data.month !== month || data.year !== year) {
        const issue = `Invalid month/year: ${calendarId} - expected ${month}/${year}, got ${data.month}/${data.year}`;
        console.error(`  ✗ ${issue}`);
        issues.push(issue);
      }
      
      // Validate days object
      if (!data.days || typeof data.days !== 'object' || Object.keys(data.days).length === 0) {
        const issue = `Missing or empty days object: ${calendarId}`;
        console.error(`  ✗ ${issue}`);
        issues.push(issue);
        continue;
      }
      
      console.log(`  ✓ Found ${Object.keys(data.days).length} days`);
      
      // Validate day structure for a sample day (day 15 if it exists)
      const sampleDay = '15';
      if (data.days[sampleDay]) {
        const dayData = data.days[sampleDay];
        
        // Check required fields
        if (dayData.baseOccupancyPrice === undefined || 
            dayData.available === undefined || 
            dayData.minimumStay === undefined) {
          const issue = `Invalid day structure in ${calendarId}, day ${sampleDay}: missing required fields`;
          console.error(`  ✗ ${issue}`);
          console.error(`  Day data: ${JSON.stringify(dayData)}`);
          issues.push(issue);
        }
        
        // Check prices object
        if (!dayData.prices || typeof dayData.prices !== 'object') {
          const issue = `Missing prices object in ${calendarId}, day ${sampleDay}`;
          console.error(`  ✗ ${issue}`);
          issues.push(issue);
        }
      }
    }
  }
  
  // Report summary
  console.log('\n---');
  if (issues.length === 0) {
    console.log('✓ No issues found in price calendars');
  } else {
    console.log(`✗ Found ${issues.length} issues:`);
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    
    console.log('\nRecommendation: Run the price calendar generation script to fix these issues:');
    console.log('npm run generate-price-calendars');
  }
}

// Run the monitor
monitorPriceCalendars().catch(console.error);