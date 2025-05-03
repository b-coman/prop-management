
// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local at the project root
// Necessary because this might be imported in contexts where Next.js hasn't loaded env vars (like scripts)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

let dbAdmin: admin.firestore.Firestore;
let adminApp: admin.app.App;

if (!admin.apps.length) {
  if (!serviceAccountPath) {
    console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local.');
    // Avoid throwing error immediately, let consuming functions handle it if needed
    // throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set.');
  } else {
    try {
      const serviceAccountFullPath = path.resolve(serviceAccountPath);
      console.log('🔑 Initializing Firebase Admin SDK with service account:', serviceAccountFullPath);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFullPath),
        // No databaseURL needed for Firestore Admin SDK v9+
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Use projectId from env
      });
      dbAdmin = admin.firestore(adminApp);
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error);
      console.error('   Check if the service account key path is correct and the file is valid.');
      // throw error; // Re-throw if initialization is critical
    }
  }
} else {
  console.log('ℹ️ Firebase Admin SDK app already initialized.');
  adminApp = admin.app(); // Get the default app
  dbAdmin = admin.firestore(adminApp);
}

// Export the initialized Admin Firestore instance
// Ensure dbAdmin is exported even if initialization failed, but consuming code should check
export { dbAdmin, adminApp };
