import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testPricingAPI() {
  const propertyId = 'prahova-mountain-chalet';
  const checkIn = '2025-06-15';
  const checkOut = '2025-06-18';
  const guests = 5;

  console.log('Testing pricing API endpoint...');
  console.log(`Property: ${propertyId}`);
  console.log(`Check-in: ${checkIn}`);
  console.log(`Check-out: ${checkOut}`);
  console.log(`Guests: ${guests}`);
  console.log('---');

  // Call the pricing API directly
  const response = await fetch('http://localhost:9002/api/check-pricing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      propertyId,
      checkIn,
      checkOut,
      guests
    }),
  });

  const data = await response.json();
  
  console.log(`API Response Status: ${response.status}`);
  console.log('API Response Data:', JSON.stringify(data, null, 2));
}

// Run the test
testPricingAPI().catch(console.error);