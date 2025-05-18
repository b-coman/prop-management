/**
 * Script to test the pricing API with different date ranges and properties
 * 
 * This script tests the check-pricing-availability API endpoint
 * which retrieves pricing from pre-calculated price calendars
 * 
 * Usage:
 * ts-node scripts/test-pricing-api.ts
 */

import { format, addDays } from 'date-fns';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// API endpoint for pricing queries
const API_URL = 'http://localhost:3000/api/check-pricing-availability';
const PROPERTY_ID = 'prahova-mountain-chalet'; // You can change this to any valid property slug

// Initialize Firebase Admin for direct calendar access
try {
  // Try to find service account path
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
                            './firebase-admin/serviceAccountKey.json';
                            
  if (fs.existsSync(serviceAccountPath)) {
    initializeApp({
      credential: cert(serviceAccountPath)
    });
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    console.log('⚠️ Service account file not found, skipping Firebase Admin initialization');
    console.log('Will only test via API, not direct calendar access');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
}

// Function to test pricing for a date range via API
async function testPricing(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  guestCount: number = 2
) {
  const requestBody = {
    propertyId,
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    guests: guestCount
  };

  try {
    console.log(`\n📅 Testing pricing for ${format(checkIn, 'MMM d, yyyy')} to ${format(checkOut, 'MMM d, yyyy')} with ${guestCount} guests:`);
    
    // Check if we can access the price calendar directly (with Admin SDK)
    try {
      const db = getFirestore();
      if (db) {
        // Get all months in the date range
        const monthNeeded = new Set<string>();
        let calendarDate = new Date(checkIn);
        
        while (calendarDate < checkOut) {
          const yearMonth = format(calendarDate, 'yyyy-MM');
          monthNeeded.add(yearMonth);
          calendarDate.setDate(calendarDate.getDate() + 1);
        }
        
        console.log(`🔍 Checking ${monthNeeded.size} price calendars for months: ${Array.from(monthNeeded).join(', ')}`);
        let foundCalendar = false;
        
        // Check each month's calendar
        for (const yearMonth of monthNeeded) {
          const calendarId = `${propertyId}_${yearMonth}`;
          const calendarDoc = await db.collection('priceCalendars').doc(calendarId).get();
          
          if (calendarDoc.exists) {
            foundCalendar = true;
            console.log(`✅ Price calendar found: ${calendarId}`);
            
            // Get data from calendar
            const calendarData = calendarDoc.data();
            const days = calendarData?.days || {};
            
            // Show calendar info
            console.log(`📊 Calendar contains ${Object.keys(days).length} days`);
            
            // Get a day in our range as sample
            const checkInDay = checkIn.getDate().toString();
            const sampleDay = days[checkInDay] ? checkInDay : Object.keys(days)[0];
            
            if (sampleDay) {
              console.log(`📝 Sample day (${yearMonth}-${sampleDay}): ${JSON.stringify(days[sampleDay], null, 2)}`);
              
              // Check if prices for different occupancy levels exist
              const dayData = days[sampleDay];
              if (dayData.prices && Object.keys(dayData.prices).length > 0) {
                console.log(`✅ Occupancy-based pricing found. Available guest counts: ${Object.keys(dayData.prices).join(', ')}`);
              }
            }
            
            // Only show one calendar as example
            break;
          }
        }
        
        if (!foundCalendar) {
          console.log(`⚠️ No price calendars found for ${propertyId}`);
          console.log(`ℹ️ Make sure price calendars exist with format: ${propertyId}_YYYY-MM`);
          console.log(`ℹ️ Example: ${propertyId}_${format(checkIn, 'yyyy-MM')}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not check price calendar directly: ${error.message}`);
    }
    
    // Now call the API to test the endpoint
    console.log(`🔄 Calling API endpoint: ${API_URL}`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    
    if (data.available && data.pricing) {
      console.log(`✅ Available - Total price: ${data.pricing.totalPrice} ${data.pricing.currency}`);
      console.log(`📊 Daily rates (${Object.keys(data.pricing.dailyRates).length} days):`);
      
      // Display daily rates in a readable format
      const dailyRates = data.pricing.dailyRates;
      const dates = Object.keys(dailyRates).sort();
      
      // Show first 3 days as sample
      const sampleDates = dates.slice(0, 3);
      sampleDates.forEach(date => {
        const dayOfWeek = format(new Date(date), 'EEE');
        console.log(`  - ${date} (${dayOfWeek}): ${dailyRates[date]} ${data.pricing.currency}`);
      });
      
      if (dates.length > 3) {
        console.log(`  ... and ${dates.length - 3} more days`);
      }
      
      // Display summary statistics
      const prices = dates.map(date => dailyRates[date]);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
      
      console.log(`\n📈 Stats: Min: ${min}, Max: ${max}, Avg: ${avg}, Range: ${Math.round(max - min)} ${data.pricing.currency}`);
      
    } else if (!data.available) {
      console.log(`❌ Not available - Reason: ${data.reason}`);
      if (data.unavailableDates) {
        console.log(`⚠️ Unavailable dates: ${data.unavailableDates.slice(0, 5).join(', ')}${data.unavailableDates.length > 5 ? '...' : ''}`);
      }
    } else {
      console.log(`⚠️ Unexpected response:`, data);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function runTests() {
  console.log('🧪 Running pricing API tests');
  
  // Get current date as starting point
  const today = new Date();
  
  // Test cases for different scenarios
  
  // 1. Weekend stay (Friday-Sunday)
  const nextFriday = new Date(today);
  while (nextFriday.getDay() !== 5) { // 5 is Friday
    nextFriday.setDate(nextFriday.getDate() + 1);
  }
  const nextSunday = new Date(nextFriday);
  nextSunday.setDate(nextSunday.getDate() + 2);
  
  await testPricing(PROPERTY_ID, nextFriday, nextSunday);
  
  // 2. Weekday stay (Monday-Thursday)
  const nextMonday = new Date(today);
  while (nextMonday.getDay() !== 1) { // 1 is Monday
    nextMonday.setDate(nextMonday.getDate() + 1);
  }
  const nextThursday = new Date(nextMonday);
  nextThursday.setDate(nextThursday.getDate() + 3);
  
  await testPricing(PROPERTY_ID, nextMonday, nextThursday);
  
  // 3. Summer stay (1 week in July)
  const summerDate = new Date(today.getFullYear(), 6, 15); // July 15
  if (summerDate < today) {
    summerDate.setFullYear(summerDate.getFullYear() + 1); // Next year if past
  }
  const summerEndDate = new Date(summerDate);
  summerEndDate.setDate(summerEndDate.getDate() + 7);
  
  await testPricing(PROPERTY_ID, summerDate, summerEndDate);
  
  // 4. Holiday period check
  const christmasDate = new Date(today.getFullYear(), 11, 23); // December 23
  if (christmasDate < today) {
    christmasDate.setFullYear(christmasDate.getFullYear() + 1); // Next year if past
  }
  const newYearsDate = new Date(christmasDate);
  newYearsDate.setDate(newYearsDate.getDate() + 9);
  
  await testPricing(PROPERTY_ID, christmasDate, newYearsDate);
  
  // 5. Different guest counts to test occupancy pricing
  await testPricing(PROPERTY_ID, addDays(today, 30), addDays(today, 34), 4);
  
  console.log('\n🏁 Testing complete!');
  console.log('\n💡 If price calendars are not available or prices are incorrect:');
  console.log('1. Run the price calendar generation script: npm run generate-price-calendars');
  console.log('2. Check that Firestore security rules allow access to priceCalendars collection');
  console.log('3. Verify that the property has dynamic pricing enabled');
  console.log('\n⚠️ NOTE: Price calendars use the following format:');
  console.log('- Calendar ID: propertyId_YYYY-MM (e.g. "prahova-mountain-chalet_2024-05")');
  console.log('- Day pricing: calendar.days[dayNumber] (e.g. calendar.days["15"] for the 15th day)');
  console.log('- Each day object contains:');
  console.log('  * available: boolean - If the date is available for booking');
  console.log('  * basePrice: number - Original price before adjustments');
  console.log('  * adjustedPrice: number - Final price after adjustments');
  console.log('  * prices: object - Optional prices for different guest counts');
  console.log('  * minimumStay: number - Minimum nights required for this date');
}

// Run the tests
runTests().catch(console.error);