/**
 * @fileoverview Direct test of session API endpoint
 * @module scripts/test-session-api
 * 
 * @description
 * Tests the session API endpoint directly to diagnose the 500 error
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { initializeFirebaseAdminSafe } from '../src/lib/firebaseAdminSafe';

async function testSessionAPI() {
  console.log('🧪 Testing Session API Endpoint\n');

  // Test 1: Check Firebase Admin initialization
  console.log('1️⃣ Testing Firebase Admin initialization...');
  try {
    const app = await initializeFirebaseAdminSafe();
    if (app) {
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.log('❌ Firebase Admin initialization returned null');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }

  // Test 2: Test session API with mock token
  console.log('\n2️⃣ Testing session API endpoint...');
  
  // First, let's test if the endpoint exists
  try {
    const response = await fetch('http://localhost:9002/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken: 'test-token' }),
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);
  } catch (error) {
    console.error('❌ Failed to call session API:', error);
  }

  // Test 3: Check environment variables
  console.log('\n3️⃣ Checking authentication environment...');
  console.log('SERVICE_ACCOUNT env var:', process.env.FIREBASE_SERVICE_ACCOUNT ? 'Set' : 'Not set');
  console.log('SERVICE_ACCOUNT_PATH:', process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH || 'Not set');
  console.log('ADMIN_EMAILS:', process.env.ADMIN_EMAILS || 'Not set');
  
  // Test 4: Check if service account file exists
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
    console.log('\n4️⃣ Checking service account file...');
    try {
      const fs = await import('fs');
      const exists = fs.existsSync(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH);
      console.log('Service account file exists:', exists);
      
      if (exists) {
        const stats = fs.statSync(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH);
        console.log('File size:', stats.size, 'bytes');
        console.log('File permissions:', stats.mode.toString(8));
      }
    } catch (error) {
      console.error('❌ Error checking service account file:', error);
    }
  }
}

// Run the test
testSessionAPI().catch(console.error);