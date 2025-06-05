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

  console.log('Testing pricing API with correct structure...');
  console.log(`Property: ${propertyId}`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log(`Guests: ${guests}`);
  console.log('---');

  // Test the pricing logic directly
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

  // Check if price calendar exists (using correct collection name)
  const calendarId = `${propertyId}_${year}-${monthStr}`;
  const calendarDoc = await db.collection('priceCalendar').doc(calendarId).get();
  
  if (!calendarDoc.exists) {
    console.error(`Price calendar ${calendarId} not found`);
    
    // List available calendars
    const calendarsSnapshot = await db.collection('priceCalendar')
      .where('propertyId', '==', propertyId)
      .get();
    
    console.log('\nAvailable calendars:');
    calendarsSnapshot.forEach(doc => {
      console.log(`- ${doc.id}: Year ${doc.data().year}, Month ${doc.data().month}`);
    });
    return;
  }

  console.log(`✓ Calendar ${calendarId} exists`);
  const calendarData = calendarDoc.data();
  console.log(`Calendar data: Year ${calendarData.year}, Month "${calendarData.month}"`);
  
  // Check if the calendar has days data
  if (!calendarData.days || typeof calendarData.days !== 'object') {
    console.error('Calendar missing days data');
    return;
  }

  console.log(`✓ Calendar has ${Object.keys(calendarData.days).length} days of pricing data`);

  // Calculate pricing
  let totalPrice = 0;
  const currentDate = new Date(checkInDate);
  const nights = [];

  while (currentDate < checkOutDate) {
    const dayNum = currentDate.getDate();
    const dayData = calendarData.days[dayNum.toString()];
    
    if (!dayData) {
      console.error(`No data for day ${dayNum}`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Get the base price
    let nightPrice = dayData.baseOccupancyPrice || dayData.adjustedPrice || dayData.price;
    
    // Check if there's a price for the specific guest count
    if (dayData.prices && dayData.prices[guests.toString()]) {
      nightPrice = dayData.prices[guests.toString()];
    } else if (guests > (propertyData.baseOccupancy || 4) && propertyData.extraGuestFee) {
      // Calculate extra guest fee
      const extraGuests = guests - (propertyData.baseOccupancy || 4);
      nightPrice += extraGuests * propertyData.extraGuestFee;
    }

    nights.push({
      date: currentDate.toISOString().split('T')[0],
      price: nightPrice,
      available: dayData.available,
      priceSource: dayData.priceSource
    });

    totalPrice += nightPrice;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\nCalculated pricing:');
  nights.forEach(night => {
    console.log(`${night.date}: RON ${night.price} (${night.priceSource}) - ${night.available ? 'Available' : 'Unavailable'}`);
  });
  console.log(`Total: RON ${totalPrice}`);
  
  // Also show the raw day data for day 15 to understand structure
  console.log('\nRaw data for day 15:', JSON.stringify(calendarData.days['15'], null, 2));
}

// Run the test
testPricingAPI().catch(console.error);