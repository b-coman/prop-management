// src/lib/firebaseAdminIsolated.ts
// A minimal Firebase Admin implementation that works around initialization issues
export const runtime = 'nodejs';

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Store instances
let firebaseApp: admin.app.App | undefined;
let firestoreDb: FirebaseFirestore.Firestore | undefined;

// Attempt to initialize with a safe approach
try {
  // Only initialize if not already initialized
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase Admin with isolated approach...');
    
    // Try to create app with default config first (no credential)
    const appOptions: admin.AppOptions = {
      projectId: 'rentalspot-fzwom' // Hardcoded project ID from your valid service account
    };
    
    // Initialize app
    firebaseApp = admin.initializeApp(appOptions);
    console.log('Firebase Admin app initialized successfully');
    
    // Initialize Firestore
    try {
      firestoreDb = firebaseApp.firestore();
      console.log('Firestore initialized successfully');
    } catch (firestoreError) {
      console.error('Error initializing Firestore:', firestoreError);
      firestoreDb = undefined;
    }
  } else {
    console.log('Using existing Firebase Admin app');
    firebaseApp = admin.app();
    firestoreDb = firebaseApp.firestore();
  }
} catch (error) {
  console.error('Error during Firebase Admin initialization:', error);
  firebaseApp = undefined;
  firestoreDb = undefined;
}

/**
 * Check if Firestore is available
 */
export function isFirestoreAvailable(): boolean {
  return !!firestoreDb;
}

/**
 * Safely get a Firestore collection, with error handling
 */
export async function getCollection(collectionName: string) {
  if (!firestoreDb) {
    console.error('Firestore not available');
    return [];
  }
  
  try {
    const snapshot = await firestoreDb.collection(collectionName).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    return [];
  }
}

/**
 * Safely get a document from Firestore, with error handling
 */
export async function getDocument(collectionName: string, documentId: string) {
  if (!firestoreDb) {
    console.error('Firestore not available');
    return null;
  }
  
  try {
    const docRef = firestoreDb.collection(collectionName).doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error(`Error fetching document ${collectionName}/${documentId}:`, error);
    return null;
  }
}

/**
 * Get properties for admin interface
 */
export async function getAdminProperties() {
  return getCollection('properties');
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

// Export Firestore instance for direct access if needed
export const dbAdmin = firestoreDb;