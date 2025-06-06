// Safe Firebase Admin initialization that handles missing env vars
import * as admin from 'firebase-admin';

let _adminApp: admin.app.App | null = null;

export async function initializeFirebaseAdminSafe() {
  // Skip if already initialized
  if (_adminApp || admin.apps.length > 0) {
    _adminApp = admin.apps[0];
    return _adminApp;
  }

  try {
    // Log initialization attempt
    console.log('[FIREBASE ADMIN SAFE] Starting initialization...');

    // Check for service account environment variable or path
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('[FIREBASE ADMIN SAFE] Found FIREBASE_SERVICE_ACCOUNT, attempting parse...');
      
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        _adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with service account');
      } catch (parseError) {
        console.error('[FIREBASE ADMIN SAFE] ❌ Failed to parse service account:', parseError);
        // Fall through to default initialization
      }
    } else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
      console.log('[FIREBASE ADMIN SAFE] Found FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH, attempting to load file...');
      
      try {
        const fs = await import('fs');
        const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        
        _adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with service account from file');
      } catch (fileError) {
        console.error('[FIREBASE ADMIN SAFE] ❌ Failed to load service account from file:', fileError);
        // Fall through to default initialization
      }
    }

    // If not initialized yet, try default initialization
    if (!_adminApp) {
      console.log('[FIREBASE ADMIN SAFE] Using default initialization...');
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rentalspot-fzwom';
      
      // Use default initialization which will:
      // - Use Application Default Credentials if available (from gcloud auth)
      // - Use implicit credentials in Cloud Run
      // - Fail gracefully if neither is available
      _adminApp = admin.initializeApp({
        projectId: projectId
      });
      console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with default credentials');
    }

    return _adminApp;
  } catch (error) {
    console.error('[FIREBASE ADMIN SAFE] ❌ Fatal initialization error:', error);
    // Return null instead of throwing to prevent app crash
    return null;
  }
}

export function getFirestoreSafe() {
  if (!_adminApp) {
    console.warn('[FIREBASE ADMIN SAFE] Firestore requested but app not initialized');
    return null;
  }
  return admin.firestore(_adminApp);
}

export function getAuthSafe() {
  if (!_adminApp) {
    console.warn('[FIREBASE ADMIN SAFE] Auth requested but app not initialized');
    return null;
  }
  return admin.auth(_adminApp);
}