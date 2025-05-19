// Debug wrapper for Firebase Admin initialization
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | null = null;

export function initializeAdminDebug() {
  console.log('[FIREBASE ADMIN DEBUG] Starting initialization check...');
  
  try {
    // Check if already initialized
    const apps = getApps();
    if (apps.length > 0) {
      console.log('[FIREBASE ADMIN DEBUG] Already initialized, using existing app');
      app = apps[0];
      return app;
    }

    // Log environment variable status
    console.log('[FIREBASE ADMIN DEBUG] Environment check:', {
      hasServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      serviceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT?.length || 0,
      hasClientEmail: !!process.env.NEXT_FIREBASE_CLIENT_EMAIL,
      hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      nodeEnv: process.env.NODE_ENV,
      isEdgeRuntime: process.env.NEXT_RUNTIME === 'edge'
    });

    // Edge runtime check
    if (process.env.NEXT_RUNTIME === 'edge') {
      console.log('[FIREBASE ADMIN DEBUG] Skipping initialization in Edge runtime');
      return null;
    }

    // Try to initialize with available credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('[FIREBASE ADMIN DEBUG] Attempting initialization with service account JSON...');
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('[FIREBASE ADMIN DEBUG] ✅ Successfully initialized with service account');
      } catch (parseError) {
        console.error('[FIREBASE ADMIN DEBUG] ❌ Failed to parse service account JSON:', parseError);
        throw parseError;
      }
    } else {
      console.log('[FIREBASE ADMIN DEBUG] ⚠️ No FIREBASE_SERVICE_ACCOUNT found, trying minimal config...');
      // Try minimal initialization
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (projectId) {
        app = initializeApp({ projectId });
        console.log('[FIREBASE ADMIN DEBUG] ✅ Initialized with minimal config');
      } else {
        console.error('[FIREBASE ADMIN DEBUG] ❌ No project ID available');
        throw new Error('No Firebase configuration available');
      }
    }

    return app;
  } catch (error) {
    console.error('[FIREBASE ADMIN DEBUG] ❌ Initialization failed:', error);
    console.error('[FIREBASE ADMIN DEBUG] Stack trace:', (error as Error).stack);
    // Don't throw - allow app to continue without admin SDK
    return null;
  }
}

export function getFirestoreDebug() {
  if (!app) {
    app = initializeAdminDebug();
  }
  
  if (!app) {
    console.error('[FIREBASE ADMIN DEBUG] No app available for Firestore');
    return null;
  }
  
  return getFirestore(app);
}