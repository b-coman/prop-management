import fs from 'fs';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { addMonths, format, getDaysInMonth } from 'date-fns';

// Load environment variables
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
 * Generate missing price calendars for the specified property
 */
async function generateMissingPriceCalendars() {
  const propertyId = 'coltei-apartment-bucharest';
  const startDate = new Date(2025, 4, 1); // May 2025
  const months = 12; // Generate 12 months of calendars
  
  console.log('Generating missing price calendars...');
  console.log(`Property: ${propertyId}`);
  console.log(`Starting date: ${format(startDate, 'MMMM yyyy')}`);
  console.log(`Number of months: ${months}`);
  console.log('---');
  
  // Get property data to use for pricing
  const propertyDoc = await db.collection('properties').doc(propertyId).get();
  
  if (!propertyDoc.exists) {
    console.error(`Property ${propertyId} not found`);
    return;
  }
  
  const propertyData = propertyDoc.data();
  const basePrice = propertyData.pricePerNight || 150;
  const baseOccupancy = propertyData.baseOccupancy || 2;
  const maxGuests = propertyData.maxGuests || 6;
  const extraGuestFee = propertyData.extraGuestFee || 25;
  
  console.log(`Base price: ${basePrice}`);
  console.log(`Base occupancy: ${baseOccupancy}`);
  console.log(`Max guests: ${maxGuests}`);
  console.log(`Extra guest fee: ${extraGuestFee}`);
  
  // Generate price calendars for each month
  for (let i = 0; i < months; i++) {
    const targetDate = addMonths(startDate, i);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const monthStr = month.toString().padStart(2, '0');
    const monthName = format(targetDate, 'MMMM yyyy');
    const calendarId = `${propertyId}_${year}-${monthStr}`;
    
    console.log(`\nGenerating calendar: ${calendarId} (${monthName})`);
    
    // Check if calendar already exists
    const existingDoc = await db.collection('priceCalendars').doc(calendarId).get();
    if (existingDoc.exists) {
      console.log(`  ✓ Calendar already exists, skipping`);
      continue;
    }
    
    // Generate days data
    const daysInMonth = getDaysInMonth(targetDate);
    const days = {};
    
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = (dayOfWeek === 5 || dayOfWeek === 6); // Friday or Saturday
      
      // Calculate base price with weekend adjustment
      let adjustedPrice = basePrice;
      let priceSource = 'base';
      
      if (isWeekend) {
        adjustedPrice = Math.floor(basePrice * 1.2); // 20% more on weekends
        priceSource = 'weekend';
      }
      
      // Calculate prices for different occupancy levels
      const prices = {};
      for (let guests = baseOccupancy; guests <= maxGuests; guests++) {
        if (guests === baseOccupancy) {
          prices[guests.toString()] = adjustedPrice;
        } else {
          const extraGuests = guests - baseOccupancy;
          prices[guests.toString()] = adjustedPrice + (extraGuests * extraGuestFee);
        }
      }
      
      // Add day data to the calendar
      days[day.toString()] = {
        baseOccupancyPrice: adjustedPrice,
        prices,
        available: true, // All days available by default
        minimumStay: isWeekend ? 2 : 1, // Require 2-night stays on weekends
        priceSource,
        isWeekend
      };
    }
    
    // Create the calendar document
    const calendarData = {
      id: calendarId,
      propertyId,
      year,
      month,
      monthStr: format(targetDate, 'MMMM yyyy'),
      days,
      summary: {
        minPrice: basePrice,
        maxPrice: Math.floor(basePrice * 1.2),
        avgPrice: basePrice,
        unavailableDays: 0,
        modifiedDays: 0,
        hasCustomPrices: false,
        hasSeasonalRates: false
      },
      generatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('priceCalendars').doc(calendarId).set(calendarData);
    console.log(`  ✓ Generated calendar with ${daysInMonth} days`);
  }
  
  console.log('\n---');
  console.log('✓ Calendar generation completed successfully');
}

// Run the generator
generateMissingPriceCalendars().catch(console.error);