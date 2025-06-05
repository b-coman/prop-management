// Startup test endpoint to debug deployment issues
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[STARTUP TEST] Endpoint called');
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT?.length || 0,
      hasAdminPath: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH,
      hasClientEmail: !!process.env.NEXT_FIREBASE_CLIENT_EMAIL,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasStripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    firebaseConfig: {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'missing'
    }
  };

  // Try to initialize Firebase Admin
  try {
    const { initializeAdminDebug } = await import('@/lib/firebaseAdminDebug');
    const adminApp = initializeAdminDebug();
    debugInfo.firebaseAdmin = {
      initialized: !!adminApp,
      error: null
    };
  } catch (error) {
    debugInfo.firebaseAdmin = {
      initialized: false,
      error: String(error)
    };
  }

  console.log('[STARTUP TEST] Debug info:', JSON.stringify(debugInfo, null, 2));

  return NextResponse.json(debugInfo);
}