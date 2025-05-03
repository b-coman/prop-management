
// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local at the project root
// Ensure this runs before any attempt to use the variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

let dbAdmin: admin.firestore.Firestore | undefined = undefined; // Initialize as undefined
let adminApp: admin.app.App | undefined = undefined; // Initialize as undefined

if (!admin.apps.length) {
  if (!serviceAccountPath) {
    console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local. Admin SDK cannot initialize.');
    // Don't throw here, let consuming functions handle the undefined dbAdmin
  } else {
    try {
      const serviceAccountFullPath = path.resolve(serviceAccountPath);
      console.log('🔑 Attempting Firebase Admin SDK initialization with service account:', serviceAccountFullPath);

      // Initialize ONLY with the credential. The service account key contains the project ID.
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFullPath),
      });

      dbAdmin = admin.firestore(adminApp);
      console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('❌ Firebase Admin SDK initialization failed:', error);
      console.error('   Check if the service account key path is correct and the file is valid JSON.');
      // Don't throw, let consuming functions handle undefined dbAdmin
      adminApp = undefined; // Ensure app is undefined on failure
      dbAdmin = undefined; // Ensure dbAdmin is undefined on failure
    }
  }
} else {
  console.log('ℹ️ Firebase Admin SDK app already initialized.');
  adminApp = admin.app(); // Get the default app
  dbAdmin = admin.firestore(adminApp);
}

// Export the initialized Admin Firestore instance (might be undefined if init failed)
export { dbAdmin, adminApp };
