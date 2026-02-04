// Safe Firebase Admin initialization that handles missing env vars
import * as admin from 'firebase-admin';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

let _adminApp: admin.app.App | null = null;

export async function initializeFirebaseAdminSafe() {
  // Skip if already initialized
  if (_adminApp || admin.apps.length > 0) {
    _adminApp = admin.apps[0];
    return _adminApp;
  }

  try {
    // Check for service account environment variable or path
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        _adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        logger.debug('Admin SDK initialized with service account');
      } catch (parseError) {
        logger.error('Failed to parse service account', parseError as Error);
        // Fall through to default initialization
      }
    } else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
      try {
        const fs = await import('fs');
        const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
        const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);

        _adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        logger.debug('Admin SDK initialized with service account from file');
      } catch (fileError) {
        logger.error('Failed to load service account from file', fileError as Error);
        // Fall through to default initialization
      }
    }

    // If not initialized yet, try default initialization
    if (!_adminApp) {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rentalspot-fzwom';
      _adminApp = admin.initializeApp({
        projectId: projectId
      });
      logger.debug('Admin SDK initialized with default credentials');
    }

    return _adminApp;
  } catch (error) {
    logger.error('Fatal Admin SDK initialization error', error as Error);
    return null;
  }
}

export function getFirestoreSafe() {
  if (!_adminApp) {
    logger.warn('Firestore requested but Admin SDK not initialized');
    return null;
  }
  return admin.firestore(_adminApp);
}

export function getAuthSafe() {
  if (!_adminApp) {
    logger.warn('Auth requested but Admin SDK not initialized');
    return null;
  }
  return admin.auth(_adminApp);
}
