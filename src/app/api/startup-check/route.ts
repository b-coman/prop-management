// Startup check endpoint for debugging deployment issues
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleStartupCheck();
}

export async function POST() {
  return handleStartupCheck();
}

async function handleStartupCheck() {
  const startupInfo = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      NEXT_RUNTIME: process.env.NEXT_RUNTIME,
      // Check if Firebase config is available
      hasFirebaseProject: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      hasServiceAccountPath: !!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH,
      // Check if Stripe config is available
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    },
    memoryUsage: process.memoryUsage(),
  };

  // Test basic Firebase initialization without importing firebaseAdmin
  let firebaseStatus = 'not tested';
  try {
    // Dynamic import to avoid blocking startup
    const { isFirestoreAdminAvailable } = await import('@/lib/firebaseAdminNew');
    const { getDbAdmin } = await import('@/lib/firebaseAdmin');
    // Try to get the admin instance - this will trigger initialization if needed
    const db = await getDbAdmin();
    firebaseStatus = db ? 'initialized and available' : 'not available';
  } catch (error) {
    firebaseStatus = `error: ${error}`;
  }

  return new Response(JSON.stringify({
    status: 'ok',
    ...startupInfo,
    firebaseStatus,
  }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}