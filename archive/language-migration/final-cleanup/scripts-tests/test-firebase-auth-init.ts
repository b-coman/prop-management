/**
 * @fileoverview Test Firebase Auth initialization
 * @module scripts/test-firebase-auth-init
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

// Test Firebase client initialization
async function testFirebaseAuthInit() {
  console.log('🧪 Testing Firebase Client Auth Initialization\n');

  // Test 1: Environment variables
  console.log('1️⃣ Checking environment variables...');
  const envVars = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  console.log('Environment variables:');
  Object.entries(envVars).forEach(([key, value]) => {
    console.log(`  ${key}: ${value ? '✅ Set' : '❌ Missing'}`);
  });

  const allVarsSet = Object.values(envVars).every(value => !!value);
  console.log(`\nAll vars set: ${allVarsSet ? '✅' : '❌'}`);

  // Test 2: Firebase initialization (simulated)
  console.log('\n2️⃣ Testing Firebase config object...');
  const firebaseConfig = {
    apiKey: envVars.apiKey,
    authDomain: envVars.authDomain,
    projectId: envVars.projectId,
    storageBucket: envVars.storageBucket,
    messagingSenderId: envVars.messagingSenderId,
    appId: envVars.appId,
  };

  const configValid = Object.values(firebaseConfig).every(value => !!value);
  console.log('Firebase config valid:', configValid ? '✅' : '❌');

  if (!configValid) {
    console.log('❌ Firebase config is invalid - this would cause auth initialization to fail');
    return;
  }

  // Test 3: Check if this looks like a valid Firebase config
  console.log('\n3️⃣ Validating Firebase config format...');
  const validations = {
    apiKeyFormat: /^[A-Za-z0-9_-]+$/.test(envVars.apiKey || ''),
    authDomainFormat: /\.firebaseapp\.com$/.test(envVars.authDomain || ''),
    projectIdFormat: /^[a-z0-9-]+$/.test(envVars.projectId || ''),
    appIdFormat: /^1:\d+:web:[a-f0-9]+$/.test(envVars.appId || ''),
  };

  console.log('Format validations:');
  Object.entries(validations).forEach(([key, isValid]) => {
    console.log(`  ${key}: ${isValid ? '✅' : '❌'}`);
  });

  const allFormatsValid = Object.values(validations).every(Boolean);
  console.log(`\nAll formats valid: ${allFormatsValid ? '✅' : '❌'}`);

  // Summary
  console.log('\n📊 Summary:');
  if (allVarsSet && configValid && allFormatsValid) {
    console.log('🎉 Firebase configuration looks correct!');
    console.log('The auth initialization issue is likely elsewhere.');
  } else {
    console.log('❌ Firebase configuration has issues that would prevent auth initialization.');
  }
}

// Run the test
testFirebaseAuthInit().catch(console.error);