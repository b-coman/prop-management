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
  const guests = 2;

  console.log('Testing pricing API locally...');
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

  // Check if price calendar exists
  const calendarId = `${propertyId}_${year}-${monthStr}`;
  const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
  
  if (!calendarDoc.exists) {
    console.error(`Price calendar ${calendarId} not found`);
    
    // List available calendars
    const calendarsSnapshot = await db.collection('priceCalendars')
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
  console.log(`Calendar data: Year ${calendarData.year}, Month ${calendarData.month}`);
  
  // Check if the calendar has days data
  if (!calendarData.days || typeof calendarData.days !== 'object') {
    console.error('Calendar missing days data');
    return;
  }

  console.log(`✓ Calendar has ${Object.keys(calendarData.days).length} days of pricing data`);
  
  // Debug: Check the structure of day 15
  console.log('\nDebug - Day 15 data:', JSON.stringify(calendarData.days[15], null, 2));

  // Calculate pricing
  let totalPrice = 0;
  const currentDate = new Date(checkInDate);
  const nights = [];

  while (currentDate < checkOutDate) {
    const dayNum = currentDate.getDate();
    const dayPrice = calendarData.days[dayNum];
    
    if (!dayPrice || !dayPrice.price) {
      console.error(`No price for day ${dayNum}`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    nights.push({
      date: currentDate.toISOString().split('T')[0],
      price: dayPrice.price
    });

    totalPrice += dayPrice.price;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\nCalculated pricing:');
  nights.forEach(night => {
    console.log(`${night.date}: RON ${night.price}`);
  });
  console.log(`Total: RON ${totalPrice}`);
}

// Run the test
testPricingAPI().catch(console.error);