
// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local at the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;

let dbAdmin: undefined = undefined; // Initialize as undefined - Keep type for potential future use
let adminApp: undefined = undefined; // Initialize as undefined - Keep type for potential future use

/**** Temporarily commenting out Admin SDK initialization ****
   This is because we're switching to the Client SDK for updating availability
   due to persistent initialization errors with the Admin SDK in this environment.
   If Admin SDK functionality is needed elsewhere later, this can be revisited.

if (!admin.apps.length) {
  if (!serviceAccountPath) {
    console.error('❌ FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH is not set in .env.local. Admin SDK cannot initialize.');
    // Don't throw here, let consuming functions handle the undefined dbAdmin
  } else {
    try {
      const serviceAccountFullPath = path.resolve(serviceAccountPath);
      console.log('🔑 Attempting Firebase Admin SDK initialization with service account:', serviceAccountFullPath);

      // --- Debugging Step 1: Log the service account path ---
      // console.log('[Admin Init Debug] Service account path:', serviceAccountFullPath);

      // --- Debugging Step 2: Attempt to load the credential ---
      let credential;
      try {
          credential = admin.credential.cert(serviceAccountFullPath);
          // console.log('[Admin Init Debug] Successfully loaded credential from path.');
      } catch (credError) {
          console.error('❌ [Admin Init Debug] Error loading credential from path:', credError);
          throw credError; // Re-throw credential loading error
      }

      // --- Debugging Step 3: Attempt to initialize app ---
      // Initialize ONLY with the credential. The service account key should contain the project ID.
      adminApp = admin.initializeApp({
        credential: credential,
        // No databaseURL needed for Firestore Admin SDK v9+
      });
      // console.log('[Admin Init Debug] Successfully called admin.initializeApp.');


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
*/

// Export undefined placeholders for now
export { dbAdmin, adminApp };
