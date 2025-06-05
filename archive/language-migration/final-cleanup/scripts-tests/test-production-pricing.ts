import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { addDays, format } from 'date-fns';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Get production URL from environment or use default
const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://your-production-url.com';

/**
 * Test the pricing API in production
 */
async function testProductionPricing() {
  // Test properties and date ranges
  const testCases = [
    {
      propertyId: 'prahova-mountain-chalet', 
      startDate: new Date(), // today
      nights: 3,
      guests: 5
    },
    {
      propertyId: 'prahova-mountain-chalet',
      startDate: addDays(new Date(), 30), // 30 days from now
      nights: 7,
      guests: 4
    },
    {
      propertyId: 'prahova-mountain-chalet',
      startDate: addDays(new Date(), 180), // 6 months from now
      nights: 5,
      guests: 6
    }
  ];
  
  console.log(`Testing pricing API in production: ${PRODUCTION_URL}`);
  console.log('---');
  
  let allPassed = true;
  
  for (const test of testCases) {
    const checkIn = format(test.startDate, 'yyyy-MM-dd');
    const checkOut = format(addDays(test.startDate, test.nights), 'yyyy-MM-dd');
    
    console.log(`\nTest case: ${test.propertyId}`);
    console.log(`Check-in: ${checkIn}, Check-out: ${checkOut}, Guests: ${test.guests}`);
    
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/check-pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          propertyId: test.propertyId,
          checkIn,
          checkOut,
          guests: test.guests
        }),
      });
      
      const data = await response.json();
      console.log(`Status: ${response.status}`);
      
      if (response.ok && data.available === true) {
        console.log(`✓ Test passed: Property is available`);
        console.log(`  Total price: ${data.pricing?.currency} ${data.pricing?.total || 'N/A'}`);
        console.log(`  Nights: ${Object.keys(data.pricing?.dailyRates || {}).length}`);
      } else if (response.ok && data.available === false) {
        console.log(`✓ Test passed: Property is not available`);
        console.log(`  Reason: ${data.reason}`);
        if (data.reason === 'unavailable_dates') {
          console.log(`  Unavailable dates: ${data.unavailableDates?.join(', ') || 'N/A'}`);
        } else if (data.reason === 'minimum_stay') {
          console.log(`  Minimum stay: ${data.minimumStay}, Requested: ${test.nights}`);
        }
      } else {
        console.log(`✗ Test failed: API returned an error`);
        console.log(`  Error: ${data.error || JSON.stringify(data)}`);
        allPassed = false;
      }
    } catch (error) {
      console.error(`✗ Test failed: ${error.message}`);
      allPassed = false;
    }
  }
  
  console.log('\n---');
  if (allPassed) {
    console.log('✓ All tests passed successfully');
  } else {
    console.log('✗ Some tests failed - check errors above');
  }
}

// Run the test
testProductionPricing().catch(console.error);