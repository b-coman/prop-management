// src/lib/firebaseAdmin.ts
// Edge-compatible implementation with lazy initialization

import * as admin from 'firebase-admin';

// Singleton instances
let _dbAdmin: FirebaseFirestore.Firestore | undefined = undefined;
let _authAdmin: admin.auth.Auth | undefined = undefined;
let _adminApp: admin.app.App | undefined = undefined;
let initializationPromise: Promise<void> | null = null;

// Lazy initialization function
async function ensureFirebaseAdmin() {
  // Return early if already initialized
  if (_adminApp && _dbAdmin && _authAdmin) {
    return;
  }

  // Return the existing promise if initialization is in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = (async () => {
    // Skip initialization in Edge Runtime
    if (typeof process.env.NEXT_RUNTIME === 'string' && process.env.NEXT_RUNTIME === 'edge') {
      console.log('⚠️ Firebase Admin SDK cannot be fully initialized in Edge Runtime');
      return;
    }
    
    // Check if already initialized
    if (admin.apps.length === 0) {
      try {
        // Use service account if available
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
          // Try to initialize with service account
          const serviceAccount = JSON.parse(
            process.env.FIREBASE_SERVICE_ACCOUNT
          );
          
          _adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
          });
          
          console.log('✅ Initialized Firebase Admin SDK with service account');
        } else {
          // Fall back to default config
          _adminApp = admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder'
          });
          
          console.log('⚠️ Initialized Firebase Admin with limited capabilities (no service account)');
        }
        
        // Initialize Firestore and Auth
        if (_adminApp) {
          _dbAdmin = admin.firestore(_adminApp);
          _authAdmin = admin.auth(_adminApp);
        }
      } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin SDK:', error);
        _dbAdmin = undefined;
        _authAdmin = undefined;
        _adminApp = undefined;
      }
    } else {
      console.log('ℹ️ Firebase Admin SDK already initialized');
      _adminApp = admin.app();
      if (_adminApp) {
        try {
          _dbAdmin = admin.firestore(_adminApp);
          _authAdmin = admin.auth(_adminApp);
        } catch (error) {
          console.error('❌ Failed to initialize Firestore/Auth:', error);
        }
      }
    }
  })();

  await initializationPromise;
}

// Helper to check if Firestore is available
export function isFirestoreAdminAvailable() {
  return !!_dbAdmin;
}

// Lazy getters for the instances
export async function getDbAdmin() {
  await ensureFirebaseAdmin();
  return _dbAdmin;
}

export async function getAuthAdmin() {
  await ensureFirebaseAdmin();
  return _authAdmin;
}

export async function getAdminApp() {
  await ensureFirebaseAdmin();
  return _adminApp;
}

// Export compatibility layer for existing code
export const dbAdmin = new Proxy({} as FirebaseFirestore.Firestore, {
  get(target, prop: string) {
    // Return a promise-based method for any property access
    return async (...args: any[]) => {
      const db = await getDbAdmin();
      if (!db) throw new Error('Firestore Admin not available');
      return (db as any)[prop](...args);
    };
  }
});

export const authAdmin = new Proxy({} as admin.auth.Auth, {
  get(target, prop: string) {
    return async (...args: any[]) => {
      const auth = await getAuthAdmin();
      if (!auth) throw new Error('Auth Admin not available');
      return (auth as any)[prop](...args);
    };
  }
});

export const adminApp = new Proxy({} as admin.app.App, {
  get(target, prop: string) {
    return async (...args: any[]) => {
      const app = await getAdminApp();
      if (!app) throw new Error('Admin App not available');
      return (app as any)[prop](...args);
    };
  }
});