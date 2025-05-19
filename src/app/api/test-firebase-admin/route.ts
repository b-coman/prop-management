import { NextResponse } from 'next/server';
import { initializeFirebaseAdminSafe, getFirestoreSafe } from '@/lib/firebaseAdminSafe';

export async function GET() {
  const results = {
    environment: {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      nodeEnv: process.env.NODE_ENV,
      // Don't log actual values for security
    },
    initialization: {
      success: false,
      error: null,
      appInitialized: false,
    },
    firestore: {
      available: false,
      error: null,
    },
    testQuery: {
      success: false,
      error: null,
      data: null,
    }
  };

  try {
    // Test initialization
    console.log('[TEST] Attempting Firebase Admin initialization...');
    const app = await initializeFirebaseAdminSafe();
    results.initialization.success = !!app;
    results.initialization.appInitialized = !!app;
    
    // Test Firestore access
    const db = getFirestoreSafe();
    results.firestore.available = !!db;
    
    if (db) {
      // Try a simple query
      try {
        const propertiesSnapshot = await db.collection('properties').limit(1).get();
        results.testQuery.success = true;
        results.testQuery.data = {
          found: !propertiesSnapshot.empty,
          count: propertiesSnapshot.size
        };
      } catch (queryError: any) {
        results.testQuery.error = queryError.message;
      }
    }
  } catch (error: any) {
    results.initialization.error = error.message;
  }

  return NextResponse.json(results);
}

export async function POST() {
  return GET();
}