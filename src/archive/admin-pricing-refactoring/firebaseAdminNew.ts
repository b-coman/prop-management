// src/lib/firebaseAdminNew.ts
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Global variables for Firebase Admin
let _initialized = false;
let _adminApp: admin.app.App | null = null;
let _firestoreDb: FirebaseFirestore.Firestore | null = null;
let _initializationError: any = null;

/**
 * Initialize Firebase Admin SDK with a safer approach specifically targeting
 * the "Cannot read properties of undefined (reading 'INTERNAL')" error
 */
async function initializeFirebaseAdmin(): Promise<boolean> {
  // If already initialized, return true
  if (_initialized && _adminApp && _firestoreDb) {
    return true;
  }

  // If we've tried and failed before, don't try again
  if (_initializationError) {
    return false;
  }

  try {
    // Get the project ID from environment
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      _initializationError = new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable');
      console.error('Firebase Admin initialization failed:', _initializationError);
      return false;
    }

    // Clean up any existing apps first to avoid conflicts
    try {
      const existingApps = [...admin.apps];
      for (const app of existingApps) {
        if (app) await app.delete();
      }
    } catch (e) {
      console.warn('Error cleaning up existing Firebase Admin apps:', e);
    }

    // Try different approaches to initialize Firebase Admin

    // APPROACH 1: Using service account if available
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath) {
      try {
        console.log('Trying to initialize with service account...');
        const resolvedPath = path.isAbsolute(serviceAccountPath)
          ? serviceAccountPath
          : path.resolve(process.cwd(), serviceAccountPath);

        if (fs.existsSync(resolvedPath)) {
          const serviceAccountContent = fs.readFileSync(resolvedPath, 'utf8');
          const serviceAccount = JSON.parse(serviceAccountContent);

          // Create the app with explicit credential
          _adminApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });

          // Initialize Firestore
          _firestoreDb = _adminApp.firestore();
          _initialized = true;
          console.log('✅ Firebase Admin SDK initialized successfully with service account');
          return true;
        } else {
          console.warn(`Service account file not found at: ${resolvedPath}`);
        }
      } catch (error) {
        console.warn('Error initializing with service account:', error);
        try {
          // Clean up if initialization failed
          if (_adminApp) {
            await _adminApp.delete();
            _adminApp = null;
            _firestoreDb = null;
          }
        } catch (cleanupError) {
          console.warn('Error cleaning up after failed initialization:', cleanupError);
        }
      }
    }

    // APPROACH 2: Using just the project ID
    try {
      console.log('Trying to initialize with project ID only...');
      _adminApp = admin.initializeApp({
        projectId
      });

      // Initialize Firestore
      _firestoreDb = _adminApp.firestore();
      _initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully with project ID');
      return true;
    } catch (error) {
      console.warn('Error initializing with project ID:', error);
      try {
        // Clean up if initialization failed
        if (_adminApp) {
          await _adminApp.delete();
          _adminApp = null;
          _firestoreDb = null;
        }
      } catch (cleanupError) {
        console.warn('Error cleaning up after failed initialization:', cleanupError);
      }
    }

    // APPROACH 3: Let Firebase figure it out
    try {
      console.log('Trying to initialize with default options...');
      _adminApp = admin.initializeApp();

      // Initialize Firestore
      _firestoreDb = _adminApp.firestore();
      _initialized = true;
      console.log('✅ Firebase Admin SDK initialized successfully with default options');
      return true;
    } catch (error) {
      console.error('Error initializing with default options:', error);
      _initializationError = error;
      return false;
    }
  } catch (error) {
    console.error('Firebase Admin initialization failed:', error);
    _initializationError = error;
    return false;
  }
}

/**
 * Check if Firestore is available
 */
export async function isFirestoreAdminAvailable(): Promise<boolean> {
  try {
    const initialized = await initializeFirebaseAdmin();
    return initialized && !!_firestoreDb;
  } catch (error) {
    console.error('Error checking Firestore availability:', error);
    return false;
  }
}

/**
 * Get initialization error if any
 */
export function getInitializationError(): any {
  return _initializationError;
}

/**
 * Get properties for admin interface
 */
export async function getAdminProperties() {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return [];
  }

  try {
    const snapshot = await _firestoreDb.collection('properties').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching properties:', error);
    return [];
  }
}

/**
 * Get seasonal pricing for a property
 */
export async function getAdminSeasonalPricing(propertyId: string) {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return [];
  }

  try {
    const snapshot = await _firestoreDb
      .collection('seasonalPricing')
      .where('propertyId', '==', propertyId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error fetching seasonal pricing for property ${propertyId}:`, error);
    return [];
  }
}

/**
 * Get date overrides for a property
 */
export async function getAdminDateOverrides(propertyId: string) {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return [];
  }

  try {
    const snapshot = await _firestoreDb
      .collection('dateOverrides')
      .where('propertyId', '==', propertyId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error fetching date overrides for property ${propertyId}:`, error);
    return [];
  }
}

/**
 * Toggle date override availability
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }

  try {
    await _firestoreDb
      .collection('dateOverrides')
      .doc(dateOverrideId)
      .update({ available });

    return { success: true };
  } catch (error) {
    console.error(`Error updating date override ${dateOverrideId}:`, error);
    return { success: false, error: `Failed to update date override: ${error}` };
  }
}

/**
 * Toggle seasonal pricing status
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }

  try {
    await _firestoreDb
      .collection('seasonalPricing')
      .doc(seasonId)
      .update({ enabled });

    return { success: true };
  } catch (error) {
    console.error(`Error updating seasonal pricing ${seasonId}:`, error);
    return { success: false, error: `Failed to update seasonal pricing: ${error}` };
  }
}

/**
 * Generate price calendars for a property
 */
export async function generatePriceCalendar(propertyId: string) {
  const initialized = await initializeFirebaseAdmin();

  if (!initialized || !_firestoreDb) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }

  try {
    // This would typically call your price calendar generation logic
    // For now, we'll just return a success response
    return { success: true, months: 12 };
  } catch (error) {
    console.error(`Error generating price calendars for property ${propertyId}:`, error);
    return { success: false, error: `Failed to generate price calendars: ${error}` };
  }
}

// Export Firestore instance. Note that it might be null initially
export const dbAdmin = _firestoreDb;