// Firebase Admin SDK specifically for pricing operations
// This ensures proper initialization before use

import { initializeFirebaseAdminSafe, getFirestoreSafe } from './firebaseAdminSafe';
import * as admin from 'firebase-admin';

// Cache the initialization promise
let initPromise: Promise<admin.firestore.Firestore | null> | null = null;

/**
 * Get Firestore instance for pricing operations
 * Ensures Firebase Admin is initialized before returning the instance
 */
export async function getFirestoreForPricing(): Promise<admin.firestore.Firestore | null> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        console.log('[PRICING] Initializing Firebase Admin for pricing...');
        await initializeFirebaseAdminSafe();
        const db = getFirestoreSafe();
        if (!db) {
          console.error('[PRICING] Failed to get Firestore instance');
          return null;
        }
        console.log('[PRICING] Firebase Admin initialized successfully');
        return db;
      } catch (error) {
        console.error('[PRICING] Error initializing Firebase Admin:', error);
        return null;
      }
    })();
  }
  
  return initPromise;
}