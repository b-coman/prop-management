/**
 * Test script for the hold cleanup endpoint
 * This script tests the /api/cron/release-holds endpoint locally
 */

import { format } from 'date-fns';

const ENDPOINT_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_TOKEN = 'test-token-12345';

async function testHoldCleanupEndpoint() {
  console.log('🧪 Testing Hold Cleanup Endpoint');
  console.log(`📡 Target URL: ${ENDPOINT_URL}/api/cron/release-holds`);
  console.log('');

  try {
    // Test 1: Unauthorized request (should fail)
    console.log('Test 1: Unauthorized request...');
    const unauthorizedResponse = await fetch(`${ENDPOINT_URL}/api/cron/release-holds`);
    console.log(`Status: ${unauthorizedResponse.status} (Expected: 401)`);
    
    if (unauthorizedResponse.status !== 401) {
      console.log('❌ Expected 401 Unauthorized');
      const text = await unauthorizedResponse.text();
      console.log('Response:', text);
    } else {
      console.log('✅ Correctly rejected unauthorized request');
    }
    console.log('');

    // Test 2: Authorized request with Bearer token
    console.log('Test 2: Authorized request with Bearer token...');
    const authorizedResponse = await fetch(`${ENDPOINT_URL}/api/cron/release-holds`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${authorizedResponse.status}`);
    const responseData = await authorizedResponse.json();
    console.log('Response:', JSON.stringify(responseData, null, 2));
    
    if (authorizedResponse.status === 200) {
      console.log('✅ Endpoint is working correctly');
    } else {
      console.log(`❌ Unexpected status: ${authorizedResponse.status}`);
    }
    console.log('');

    // Test 3: Authorized request with cron header
    console.log('Test 3: Authorized request with cron header...');
    const cronResponse = await fetch(`${ENDPOINT_URL}/api/cron/release-holds`, {
      headers: {
        'X-Appengine-Cron': 'true',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${cronResponse.status}`);
    const cronResponseData = await cronResponse.json();
    console.log('Response:', JSON.stringify(cronResponseData, null, 2));
    
    if (cronResponse.status === 200) {
      console.log('✅ Cron header authentication working');
    } else {
      console.log(`❌ Unexpected status: ${cronResponse.status}`);
    }
    console.log('');

    // Test 4: POST method (for manual testing)
    console.log('Test 4: POST method with authorization...');
    const postResponse = await fetch(`${ENDPOINT_URL}/api/cron/release-holds`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status: ${postResponse.status}`);
    const postResponseData = await postResponse.json();
    console.log('Response:', JSON.stringify(postResponseData, null, 2));
    console.log('');

    console.log('🎉 All tests completed!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   - Unauthorized access: ${unauthorizedResponse.status === 401 ? '✅' : '❌'}`);
    console.log(`   - Bearer token auth: ${authorizedResponse.status === 200 ? '✅' : '❌'}`);
    console.log(`   - Cron header auth: ${cronResponse.status === 200 ? '✅' : '❌'}`);
    console.log(`   - POST method: ${postResponse.status === 200 ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.log('');
      console.log('💡 Make sure your development server is running:');
      console.log('   npm run dev');
      console.log('   # or');
      console.log('   yarn dev');
    }
  }
}

// Run the test
testHoldCleanupEndpoint().catch(console.error);