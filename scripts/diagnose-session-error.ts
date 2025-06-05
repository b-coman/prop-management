/**
 * @fileoverview Diagnose the session API 500 error
 * @module scripts/diagnose-session-error
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { initializeFirebaseAdminSafe, getAuthSafe } from '../src/lib/firebaseAdminSafe';

async function diagnoseSessionError() {
  console.log('🔍 Diagnosing Session API Error\n');

  // Initialize Firebase Admin
  console.log('1️⃣ Initializing Firebase Admin...');
  try {
    await initializeFirebaseAdminSafe();
    const auth = getAuthSafe();
    
    if (!auth) {
      console.error('❌ Firebase Admin Auth is null');
      return;
    }
    
    console.log('✅ Firebase Admin initialized');
    
    // Test creating a session cookie with a fake token
    console.log('\n2️⃣ Testing session cookie creation with invalid token...');
    try {
      const result = await auth.createSessionCookie('invalid-token', { expiresIn: 432000000 });
      console.log('Session cookie result:', result);
    } catch (error: any) {
      console.error('❌ Expected error creating session cookie:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // This is the likely error we're seeing in production
      if (error.code === 'auth/invalid-id-token' || error.code === 'auth/argument-error') {
        console.log('\n✅ This is the expected error for invalid tokens');
        console.log('The session API should handle this gracefully');
      }
    }
    
    // Test ID token verification
    console.log('\n3️⃣ Testing ID token verification...');
    try {
      const result = await auth.verifyIdToken('invalid-token');
      console.log('Verify result:', result);
    } catch (error: any) {
      console.error('❌ Expected error verifying ID token:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }

  // Check if the error might be related to the runtime
  console.log('\n4️⃣ Checking Node.js runtime compatibility...');
  console.log('Node version:', process.version);
  console.log('Platform:', process.platform);
  
  // Test the actual session creation flow
  console.log('\n5️⃣ Testing the complete session creation flow...');
  try {
    const { verifyIdToken, createSessionCookie } = await import('../src/lib/firebaseAdminNode');
    
    // This will fail but show us the exact error
    const decoded = await verifyIdToken('test-token');
    console.log('Decoded token:', decoded);
    
    if (!decoded) {
      console.log('✅ verifyIdToken correctly returned null for invalid token');
    }
    
    const session = await createSessionCookie('test-token', { expiresIn: 432000000 });
    console.log('Session cookie:', session);
    
    if (!session) {
      console.log('✅ createSessionCookie correctly returned null for invalid token');
    }
    
  } catch (error) {
    console.error('❌ Error in session creation flow:', error);
  }
}

// Run the diagnostic
diagnoseSessionError().catch(console.error);