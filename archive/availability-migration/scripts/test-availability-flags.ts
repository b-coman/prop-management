/**
 * Test script for availability feature flags
 * This script tests all three modes of the availability system
 */

import { format, addDays } from 'date-fns';

const ENDPOINT_URL = process.env.TEST_URL || 'http://localhost:9002';
const TEST_PROPERTY = 'prahova-mountain-chalet';

// Test dates - use future dates to avoid past date validation
const today = new Date();
const checkIn = format(addDays(today, 7), 'yyyy-MM-dd');
const checkOut = format(addDays(today, 9), 'yyyy-MM-dd');

const TEST_REQUEST = {
  propertyId: TEST_PROPERTY,
  checkIn,
  checkOut,
  guests: 4
};

async function testAvailabilityFlags() {
  console.log('🧪 Testing Availability Feature Flags System');
  console.log(`📡 Target URL: ${ENDPOINT_URL}`);
  console.log(`🏠 Test property: ${TEST_PROPERTY}`);
  console.log(`📅 Test dates: ${checkIn} to ${checkOut}`);
  console.log('');

  try {
    // Test the new v2 endpoint with feature flags
    console.log('='.repeat(60));
    console.log('Testing /api/check-pricing-v2 (with feature flags)');
    console.log('='.repeat(60));
    
    const v2Response = await fetch(`${ENDPOINT_URL}/api/check-pricing-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_REQUEST)
    });
    
    console.log(`Status: ${v2Response.status}`);
    
    if (v2Response.ok) {
      const v2Data = await v2Response.json();
      
      console.log('✅ V2 endpoint working');
      console.log('📊 Response summary:');
      console.log(`   Available: ${v2Data.available}`);
      console.log(`   Source: ${v2Data.meta?.source || 'unknown'}`);
      console.log(`   Feature flags: ${JSON.stringify(v2Data.meta?.featureFlags || {})}`);
      console.log(`   Discrepancies: ${v2Data.meta?.discrepanciesFound || false}`);
      
      if (v2Data.available && v2Data.pricing) {
        console.log(`   Total price: ${v2Data.pricing.total} ${v2Data.pricing.currency}`);
      }
      
      if (v2Data.meta?.errorDetails) {
        console.log(`   ⚠️  Error details: ${v2Data.meta.errorDetails}`);
      }
      
      if (!v2Data.available) {
        console.log(`   Reason: ${v2Data.reason}`);
        console.log(`   Unavailable dates: ${v2Data.unavailableDates?.length || 0}`);
      }
    } else {
      const errorText = await v2Response.text();
      console.log('❌ V2 endpoint failed');
      console.log(`Error: ${errorText}`);
    }

    console.log('');
    
    // Test the original endpoint for comparison
    console.log('='.repeat(60));
    console.log('Testing /api/check-pricing (original)');
    console.log('='.repeat(60));
    
    const originalResponse = await fetch(`${ENDPOINT_URL}/api/check-pricing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_REQUEST)
    });
    
    console.log(`Status: ${originalResponse.status}`);
    
    if (originalResponse.ok) {
      const originalData = await originalResponse.json();
      
      console.log('✅ Original endpoint working');
      console.log('📊 Response summary:');
      console.log(`   Available: ${originalData.available}`);
      console.log(`   Source: priceCalendars (fixed)`);
      
      if (originalData.available && originalData.pricing) {
        console.log(`   Total price: ${originalData.pricing.total} ${originalData.pricing.currency}`);
      }
      
      if (!originalData.available) {
        console.log(`   Reason: ${originalData.reason}`);
        console.log(`   Unavailable dates: ${originalData.unavailableDates?.length || 0}`);
      }
    } else {
      const errorText = await originalResponse.text();
      console.log('❌ Original endpoint failed');
      console.log(`Error: ${errorText}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    
    console.log(`✅ V2 endpoint: ${v2Response.ok ? 'WORKING' : 'FAILED'}`);
    console.log(`✅ Original endpoint: ${originalResponse.ok ? 'WORKING' : 'FAILED'}`);
    
    if (v2Response.ok && originalResponse.ok) {
      const v2Data = await v2Response.json();
      const originalData = await originalResponse.json();
      
      const resultsMatch = v2Data.available === originalData.available;
      console.log(`🔍 Results match: ${resultsMatch ? 'YES' : 'NO'}`);
      
      if (!resultsMatch) {
        console.log('⚠️  DISCREPANCY DETECTED:');
        console.log(`   V2 (${v2Data.meta?.source}): ${v2Data.available ? 'AVAILABLE' : 'UNAVAILABLE'}`);
        console.log(`   Original (priceCalendars): ${originalData.available ? 'AVAILABLE' : 'UNAVAILABLE'}`);
      }
    }

    console.log('');
    console.log('🎛️  To test different modes:');
    console.log('   1. Run: ./scripts/availability-rollback.sh');
    console.log('   2. Change environment variables');
    console.log('   3. Restart development server');
    console.log('   4. Run this test again');
    console.log('');
    console.log('🚨 For emergency rollback:');
    console.log('   ./scripts/availability-rollback.sh --emergency');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('💡 Make sure your development server is running:');
      console.log('   npm run dev');
    }
  }
}

// Run the test
testAvailabilityFlags().catch(console.error);