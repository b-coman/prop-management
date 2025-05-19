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

  console.log('Testing pricing API with ACTUAL structure...');
  console.log(`Property: ${propertyId}`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log(`Guests: ${guests}`);
  console.log('---');

  // Test the pricing logic directly
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const year = checkInDate.getFullYear();

  // Check if the property exists
  const propertyDoc = await db.collection('properties').doc(propertyId).get();
  if (!propertyDoc.exists) {
    console.error(`Property ${propertyId} not found`);
    return;
  }
  console.log('✓ Property exists');
  const propertyData = propertyDoc.data()!;

  // Check if price calendar exists - using annual calendar ID
  const calendarId = `${propertyId}-${year}`;
  const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
  
  if (!calendarDoc.exists) {
    console.error(`Price calendar ${calendarId} not found`);
    
    // List available calendars
    const calendarsSnapshot = await db.collection('priceCalendars').get();
    
    console.log('\nAvailable calendars:');
    calendarsSnapshot.forEach(doc => {
      console.log(`- ${doc.id}: Year ${doc.data().year}`);
    });
    return;
  }

  console.log(`✓ Calendar ${calendarId} exists`);
  const calendarData = calendarDoc.data();
  console.log(`Calendar data: Year ${calendarData.year}`);
  
  // Check if the calendar has prices data
  if (!calendarData.prices || typeof calendarData.prices !== 'object') {
    console.error('Calendar missing prices data');
    return;
  }

  console.log(`✓ Calendar has ${Object.keys(calendarData.prices).length} days of pricing data`);

  // Calculate pricing
  let totalPrice = 0;
  const currentDate = new Date(checkInDate);
  const nights = [];

  while (currentDate < checkOutDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayPrice = calendarData.prices[dateStr];
    
    if (!dayPrice) {
      console.error(`No price for date ${dateStr}`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get the adjusted price (or base price as fallback)
    let nightPrice = dayPrice.adjustedPrice || dayPrice.basePrice;
    
    // Apply extra guest fee if needed and not already factored in
    if (guests > (propertyData.baseOccupancy || 4) && propertyData.extraGuestFee) {
      const extraGuests = guests - (propertyData.baseOccupancy || 4);
      nightPrice += extraGuests * propertyData.extraGuestFee;
    }

    nights.push({
      date: dateStr,
      price: nightPrice,
      available: dayPrice.available,
      isWeekend: dayPrice.isWeekend,
      seasonId: dayPrice.seasonId
    });

    totalPrice += nightPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\nCalculated pricing:');
  nights.forEach(night => {
    console.log(`${night.date}: RON ${night.price} (${night.isWeekend ? 'Weekend' : 'Weekday'}${night.seasonId ? ', ' + night.seasonId : ''}) - ${night.available ? 'Available' : 'Unavailable'}`);
  });
  console.log(`Total: RON ${totalPrice}`);
  
  // Also show a sample date's raw data
  const sampleDate = checkIn;
  console.log('\nRaw data for checkIn date:', JSON.stringify(calendarData.prices[sampleDate], null, 2));
}

// Run the test
testPricingAPI().catch(console.error);