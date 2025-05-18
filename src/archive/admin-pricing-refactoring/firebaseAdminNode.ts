// src/lib/firebaseAdminNode.ts
// Node.js-specific implementation for server components and actions
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Global variables for Firebase Admin instances
let _dbAdmin: FirebaseFirestore.Firestore | undefined;
let _authAdmin: admin.auth.Auth | undefined;
let _adminApp: admin.app.App | undefined;

/**
 * Get the Firebase Admin app instance, initializing it if necessary
 */
function getApp(): admin.app.App | undefined {
  // If already initialized, return the existing instance
  if (_adminApp) {
    return _adminApp;
  }
  
  // If apps are already initialized, use the default app
  if (admin.apps.length > 0) {
    try {
      _adminApp = admin.app();
      return _adminApp;
    } catch (error) {
      console.error('Error accessing existing Firebase app:', error);
    }
  }
  
  // Initialize a new app
  try {
    // Get service account path
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath) {
      console.warn('⚠️ No service account path set, using default credentials');
      _adminApp = admin.initializeApp();
      return _adminApp;
    }
    
    // Check if file exists and is readable
    const resolvedPath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);
      
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Service account file not found at: ${resolvedPath}`);
      return undefined;
    }
    
    // Read and parse service account
    try {
      const serviceAccountContent = fs.readFileSync(resolvedPath, 'utf8');
      const serviceAccount = JSON.parse(serviceAccountContent);
      
      // Create the credential first, separately from app initialization
      const credential = admin.credential.cert(serviceAccount);
      
      // Then initialize the app with the credential
      _adminApp = admin.initializeApp({
        credential
      });
      
      console.log('✅ Firebase Admin initialized successfully');
      return _adminApp;
    } catch (e) {
      console.error('Error reading/parsing service account:', e);
      return undefined;
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    return undefined;
  }
}

/**
 * Get the Firestore instance, initializing Firebase Admin if necessary
 */
export function getFirestore(): FirebaseFirestore.Firestore | undefined {
  if (_dbAdmin) {
    return _dbAdmin;
  }
  
  const app = getApp();
  if (!app) {
    return undefined;
  }
  
  try {
    _dbAdmin = app.firestore();
    return _dbAdmin;
  } catch (error) {
    console.error('Error initializing Firestore:', error);
    return undefined;
  }
}

/**
 * Get the Auth instance, initializing Firebase Admin if necessary
 */
export function getAuth(): admin.auth.Auth | undefined {
  if (_authAdmin) {
    return _authAdmin;
  }
  
  const app = getApp();
  if (!app) {
    return undefined;
  }
  
  try {
    _authAdmin = app.auth();
    return _authAdmin;
  } catch (error) {
    console.error('Error initializing Auth:', error);
    return undefined;
  }
}

// Helper to check if Firestore is available
export function isFirestoreAdminAvailable(): boolean {
  return !!getFirestore();
}

// Helper to check service account file
export function checkServiceAccountFile() {
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
  
  if (!serviceAccountPath) {
    return {
      exists: false,
      error: 'No service account path provided in environment variables',
      path: undefined
    };
  }
  
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);
    
  if (!fs.existsSync(resolvedPath)) {
    return {
      exists: false,
      error: `Service account file does not exist at path: ${resolvedPath}`,
      path: resolvedPath
    };
  }
  
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const json = JSON.parse(content);
    
    // Check for required fields
    const hasProjectId = !!json.project_id;
    const hasPrivateKey = !!json.private_key;
    const hasClientEmail = !!json.client_email;
    
    if (!hasProjectId || !hasPrivateKey || !hasClientEmail) {
      return {
        exists: true,
        valid: false,
        error: 'Service account JSON missing required fields',
        path: resolvedPath,
        fields: {
          hasProjectId,
          hasPrivateKey,
          hasClientEmail
        }
      };
    }
    
    return {
      exists: true,
      valid: true,
      path: resolvedPath,
      projectId: json.project_id
    };
  } catch (error) {
    return {
      exists: true,
      valid: false,
      error: `Error parsing service account JSON: ${error}`,
      path: resolvedPath
    };
  }
}

// Define and export lazy-loaded properties
export const dbAdmin = getFirestore();
export const authAdmin = getAuth();
export const adminApp = getApp();