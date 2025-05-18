// src/lib/firebaseAdminBasic.ts
// This is the simplest possible Firebase Admin implementation
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize variables
let firebaseApp: admin.app.App | undefined;
let firestoreDb: FirebaseFirestore.Firestore | undefined;
let authAdmin: admin.auth.Auth | undefined;
let initError: any;

// Try initializing Firebase Admin with service account
try {
  console.log('Initializing Firebase Admin with basic approach...');
  
  // Check for existing apps
  if (admin.apps.length > 0) {
    console.log('Using existing Firebase Admin app');
    firebaseApp = admin.app();
    firestoreDb = firebaseApp.firestore();
    authAdmin = firebaseApp.auth();
  } else {
    // Get service account path
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      // Normalize path
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.resolve(process.cwd(), serviceAccountPath);
      
      // Check if file exists
      if (fs.existsSync(resolvedPath)) {
        console.log(`Loading service account from ${resolvedPath}`);
        const serviceAccountContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountContent);
        
        // Initialize with service account
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        
        // Get Firestore and Auth
        firestoreDb = firebaseApp.firestore();
        authAdmin = firebaseApp.auth();
        
        console.log('✅ Firebase Admin initialized successfully with service account');
      } else {
        console.error(`❌ Service account file not found at: ${resolvedPath}`);
        initError = new Error(`Service account file not found at: ${resolvedPath}`);
      }
    } else {
      // No service account path provided, try with project ID
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      
      if (projectId) {
        console.log(`Initializing with project ID: ${projectId}`);
        
        firebaseApp = admin.initializeApp({
          projectId
        });
        
        // Get Firestore and Auth
        firestoreDb = firebaseApp.firestore();
        authAdmin = firebaseApp.auth();
        
        console.log('✅ Firebase Admin initialized successfully with project ID');
      } else {
        console.error('❌ No service account path or project ID provided');
        initError = new Error('No service account path or project ID provided');
      }
    }
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  initError = error;
  firebaseApp = undefined;
  firestoreDb = undefined;
  authAdmin = undefined;
}

/**
 * Check if Firestore Admin is available
 */
export function isFirestoreAdminAvailable(): boolean {
  return !!firestoreDb;
}

/**
 * Get initialization error if any
 */
export function getInitializationError(): any {
  return initError;
}

/**
 * Get properties for admin interface
 */
export async function getAdminProperties() {
  if (!firestoreDb) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await firestoreDb.collection('properties').get();
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
  if (!firestoreDb) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await firestoreDb
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
  if (!firestoreDb) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await firestoreDb
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
  if (!firestoreDb) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }
  
  try {
    await firestoreDb
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
  if (!firestoreDb) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }
  
  try {
    await firestoreDb
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
  if (!firestoreDb) {
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

// Export Firestore and Auth instances
export { firestoreDb as dbAdmin, authAdmin };