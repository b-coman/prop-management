import admin from 'firebase-admin';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.error('No Firebase service account credentials found');
    process.exit(1);
  }
}

const db = admin.firestore();

async function testPricingAPI() {
  const propertyId = 'prahova-mountain-chalet';
  const checkIn = '2025-06-15';
  const checkOut = '2025-06-18';
  const guests = 5;

  console.log('Testing pricing API with CONFIRMED structure...');
  console.log(`Property: ${propertyId}`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log(`Guests: ${guests}`);
  console.log('---');

  // Parse dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const year = checkInDate.getFullYear();
  const month = checkInDate.getMonth() + 1;
  const monthStr = month.toString().padStart(2, '0');

  // Check if the property exists
  const propertyDoc = await db.collection('properties').doc(propertyId).get();
  if (!propertyDoc.exists) {
    console.error(`Property ${propertyId} not found`);
    return;
  }
  console.log('✓ Property exists');
  const propertyData = propertyDoc.data()!;

  // Check if price calendar exists with CONFIRMED structure
  const calendarId = `${propertyId}_${year}-${monthStr}`;
  console.log(`Looking for calendar with ID: ${calendarId}`);
  
  const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
  
  if (!calendarDoc.exists) {
    console.error(`Price calendar ${calendarId} not found`);
    
    // List available calendars to help diagnose
    console.log('\nListing available calendars in priceCalendars collection:');
    const calendarsSnapshot = await db.collection('priceCalendars').get();
    
    if (calendarsSnapshot.empty) {
      console.log('No calendars found in priceCalendars collection.');
    } else {
      calendarsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ${doc.id}: Year ${data.year}, Month ${data.month || 'unknown'}`);
      });
    }
    
    // Try with alternate format to help diagnose
    const alternateId = `${propertyId}-${year}`;
    const alternateDoc = await db.collection('priceCalendars').doc(alternateId).get();
    if (alternateDoc.exists) {
      console.log(`\nFound calendar with alternate ID format: ${alternateId}`);
      console.log('This suggests the calendars are using a different format than expected.');
    }
    
    return;
  }

  console.log(`✓ Calendar ${calendarId} exists`);
  const calendarData = calendarDoc.data();
  console.log(`Calendar data: Year ${calendarData.year}, Month ${calendarData.month}`);
  
  // Verify calendar has the expected structure
  if (!calendarData.days || typeof calendarData.days !== 'object') {
    console.error('Calendar missing days object. Structure is different than expected.');
    console.log('Calendar data structure:', Object.keys(calendarData));
    return;
  }

  console.log(`✓ Calendar has days object with ${Object.keys(calendarData.days).length} days`);
  
  // Calculate pricing for the date range
  let totalPrice = 0;
  const nights = [];
  const currentDate = new Date(checkInDate);

  while (currentDate < checkOutDate) {
    const dayNumber = currentDate.getDate().toString();
    const dayData = calendarData.days[dayNumber];
    
    if (!dayData) {
      console.error(`No data for day ${dayNumber}`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get price for requested guest count
    let price = dayData.baseOccupancyPrice;
    if (guests > propertyData.baseOccupancy && dayData.prices) {
      const guestPrice = dayData.prices[guests.toString()];
      if (guestPrice) {
        price = guestPrice;
      }
    }

    nights.push({
      date: currentDate.toISOString().split('T')[0],
      price,
      available: dayData.available,
      priceSource: dayData.priceSource
    });

    totalPrice += price;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\nCalculated pricing:');
  nights.forEach(night => {
    console.log(`${night.date}: ${propertyData.baseCurrency || 'RON'} ${night.price} (${night.priceSource}) - ${night.available ? 'Available' : 'Unavailable'}`);
  });
  console.log(`Total: ${propertyData.baseCurrency || 'RON'} ${totalPrice}`);
  
  // Also show the raw day data structure for a sample day
  const sampleDayNumber = checkInDate.getDate().toString();
  if (calendarData.days[sampleDayNumber]) {
    console.log(`\nSample day (${sampleDayNumber}) structure:`, JSON.stringify(calendarData.days[sampleDayNumber], null, 2));
  }
}

// Run the test
testPricingAPI().catch(console.error);