/**
 * @fileoverview Direct test of the dev session logic
 * @module scripts/test-dev-session-directly
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Set development mode
process.env.NODE_ENV = 'development';

// Import the auth helpers directly
import { getAuthUser } from '../src/lib/auth-helpers';

// Mock cookies function
const mockCookies = {
  get: (name: string) => {
    if (name === 'dev-session') {
      // Create a mock dev session
      const mockSession = {
        uid: 'test-user-123',
        email: 'test@example.com',
        timestamp: Date.now(),
        mode: 'development'
      };
      
      const base64Session = Buffer.from(JSON.stringify(mockSession)).toString('base64');
      return { value: base64Session };
    }
    return undefined;
  }
};

async function testDevSessionLogic() {
  console.log('🧪 Testing Development Session Logic\n');

  // Test 1: No session cookie
  console.log('1️⃣ Testing with no session cookie...');
  const mockCookiesEmpty = {
    get: () => undefined
  };
  
  const result1 = await getAuthUser(mockCookiesEmpty as any);
  console.log('Result:', result1);
  console.log('Expected: { authenticated: false }');
  console.log('✅ Test 1:', result1.authenticated === false ? 'PASS' : 'FAIL');

  // Test 2: Valid dev session cookie
  console.log('\n2️⃣ Testing with valid dev session cookie...');
  const result2 = await getAuthUser(mockCookies as any);
  console.log('Result:', result2);
  console.log('Expected: { authenticated: true, admin: true, user: {...} }');
  console.log('✅ Test 2:', result2.authenticated === true && result2.admin === true ? 'PASS' : 'FAIL');

  // Test 3: Invalid dev session cookie
  console.log('\n3️⃣ Testing with invalid dev session cookie...');
  const mockCookiesInvalid = {
    get: (name: string) => {
      if (name === 'dev-session') {
        return { value: 'invalid-base64-data' };
      }
      return undefined;
    }
  };
  
  const result3 = await getAuthUser(mockCookiesInvalid as any);
  console.log('Result:', result3);
  console.log('Expected: { authenticated: false }');
  console.log('✅ Test 3:', result3.authenticated === false ? 'PASS' : 'FAIL');

  // Test 4: Production mode (should skip dev session)
  console.log('\n4️⃣ Testing production mode behavior...');
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  const result4 = await getAuthUser(mockCookies as any);
  console.log('Result:', result4);
  console.log('Expected: { authenticated: false } (no Firebase Admin in test)');
  console.log('✅ Test 4:', result4.authenticated === false ? 'PASS' : 'FAIL');
  
  // Restore environment
  process.env.NODE_ENV = originalEnv;

  console.log('\n📊 Summary:');
  const tests = [
    result1.authenticated === false,
    result2.authenticated === true && result2.admin === true,
    result3.authenticated === false,
    result4.authenticated === false
  ];
  
  const passed = tests.filter(Boolean).length;
  console.log(`${passed}/${tests.length} tests passed`);
  
  if (passed === tests.length) {
    console.log('🎉 All tests passed! Development session logic is working correctly.');
  } else {
    console.log('❌ Some tests failed. Check the implementation.');
  }
}

// Run the test
testDevSessionLogic().catch(console.error);