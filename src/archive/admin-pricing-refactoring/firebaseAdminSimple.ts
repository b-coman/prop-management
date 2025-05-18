// src/lib/firebaseAdminSimple.ts
// A simpler Firebase Admin implementation that works around initialization issues
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Track initialization status
let _initialized = false;
let _initializationError: any = null;

// Store instances
let _dbAdmin: FirebaseFirestore.Firestore | null = null;
let _authAdmin: admin.auth.Auth | null = null;

/**
 * Initialize Firebase Admin SDK with safer approach
 */
function initializeFirebaseAdmin() {
  // Skip if already attempted initialization
  if (_initialized || _initializationError) {
    return;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      console.log('Firebase Admin already initialized, retrieving existing app');
      const app = admin.app();
      _dbAdmin = app.firestore();
      _authAdmin = app.auth();
      _initialized = true;
      return;
    }

    console.log('Initializing Firebase Admin with simpler approach...');
    
    // Get the project ID from environment variable or use a default
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rental-spot-builder';
    
    // Try different initialization approaches
    
    // Approach 1: Initialize with just the project ID
    try {
      const app = admin.initializeApp({
        projectId
      });
      
      _dbAdmin = app.firestore();
      _authAdmin = app.auth();
      _initialized = true;
      console.log('Firebase Admin initialized with project ID successfully');
      return;
    } catch (error1) {
      console.log('First initialization approach failed:', error1);
      
      // Clean up failed initialization attempt
      try {
        const app = admin.app();
        await app.delete();
      } catch (e) {
        // Ignore errors during cleanup
      }
      
      // Approach 2: Try with applicationDefault
      try {
        const app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId
        });
        
        _dbAdmin = app.firestore();
        _authAdmin = app.auth();
        _initialized = true;
        console.log('Firebase Admin initialized with applicationDefault successfully');
        return;
      } catch (error2) {
        console.log('Second initialization approach failed:', error2);
        
        // Clean up failed initialization attempt
        try {
          const app = admin.app();
          await app.delete();
        } catch (e) {
          // Ignore errors during cleanup
        }
        
        // Approach 3: Try with service account file if available
        const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
        
        if (serviceAccountPath) {
          try {
            const resolvedPath = path.isAbsolute(serviceAccountPath)
              ? serviceAccountPath
              : path.resolve(process.cwd(), serviceAccountPath);
              
            if (fs.existsSync(resolvedPath)) {
              const serviceAccountContent = fs.readFileSync(resolvedPath, 'utf8');
              const serviceAccount = JSON.parse(serviceAccountContent);
              
              // Initialize with service account
              const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
              });
              
              _dbAdmin = app.firestore();
              _authAdmin = app.auth();
              _initialized = true;
              console.log('Firebase Admin initialized with service account successfully');
              return;
            }
          } catch (error3) {
            console.error('Service account initialization failed:', error3);
            _initializationError = error3;
          }
        }
        
        // If we get here, all initialization approaches failed
        _initializationError = 'All initialization approaches failed';
      }
    }
  } catch (error) {
    console.error('Error in Firebase Admin initialization:', error);
    _initializationError = error;
  }
}

// Try to initialize on module load
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.error('Failed to initialize Firebase Admin on module load:', error);
  _initializationError = error;
}

/**
 * Check if Firestore Admin is available
 */
export function isFirestoreAdminAvailable(): boolean {
  return _initialized && !!_dbAdmin;
}

/**
 * Get any initialization error that occurred
 */
export function getInitializationError(): any {
  return _initializationError;
}

/**
 * Get properties for admin interface
 */
export async function getAdminProperties() {
  if (!_dbAdmin) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await _dbAdmin.collection('properties').get();
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
  if (!_dbAdmin) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await _dbAdmin
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
  if (!_dbAdmin) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await _dbAdmin
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
  if (!_dbAdmin) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }
  
  try {
    await _dbAdmin
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
  if (!_dbAdmin) {
    console.error('Firestore not available');
    return { success: false, error: 'Firestore not available' };
  }
  
  try {
    await _dbAdmin
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
  if (!_dbAdmin) {
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

// Export Firestore and Auth instances for direct access if needed
export const dbAdmin = _dbAdmin;
export const authAdmin = _authAdmin;