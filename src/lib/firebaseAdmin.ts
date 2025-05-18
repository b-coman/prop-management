// src/lib/firebaseAdmin.ts
// Edge-compatible implementation (limited functionality)

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let dbAdmin: FirebaseFirestore.Firestore | undefined = undefined;
let authAdmin: admin.auth.Auth | undefined = undefined;
let adminApp: admin.app.App | undefined = undefined;

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  // Skip initialization in Edge Runtime
  if (typeof process.env.NEXT_RUNTIME === 'string' && process.env.NEXT_RUNTIME === 'edge') {
    console.log('⚠️ Firebase Admin SDK cannot be fully initialized in Edge Runtime');
    return { dbAdmin: undefined, authAdmin: undefined, adminApp: undefined };
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
        
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });
        
        console.log('✅ Initialized Firebase Admin SDK with service account');
      } else {
        // Fall back to default config
        adminApp = admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder'
        });
        
        console.log('⚠️ Initialized Firebase Admin with limited capabilities (no service account)');
      }
      
      // Initialize Firestore and Auth
      if (adminApp) {
        dbAdmin = admin.firestore(adminApp);
        authAdmin = admin.auth(adminApp);
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin SDK:', error);
      dbAdmin = undefined;
      authAdmin = undefined;
      adminApp = undefined;
    }
  } else {
    console.log('ℹ️ Firebase Admin SDK already initialized');
    adminApp = admin.app();
    if (adminApp) {
      try {
        dbAdmin = admin.firestore(adminApp);
        authAdmin = admin.auth(adminApp);
      } catch (error) {
        console.error('❌ Failed to get Firestore/Auth instances:', error);
      }
    }
  }

  return { dbAdmin, authAdmin, adminApp };
}

// Initialize on import
const { dbAdmin: db, authAdmin: auth, adminApp: app } = initializeFirebaseAdmin();

// Helper to check if Firestore is available
export function isFirestoreAdminAvailable() {
  return false; // Always false in Edge Runtime
}

// Export the initialized instances
export { db as dbAdmin, auth as authAdmin, app as adminApp };