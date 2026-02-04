// Firebase Admin SDK specifically for pricing operations
// This ensures proper initialization before use

import { initializeFirebaseAdminSafe, getFirestoreSafe } from './firebaseAdminSafe';
import * as admin from 'firebase-admin';
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

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
        await initializeFirebaseAdminSafe();
        const db = getFirestoreSafe();
        if (!db) {
          logger.error('Failed to get Firestore instance for pricing');
          return null;
        }
        logger.debug('Firestore initialized for pricing operations');
        return db;
      } catch (error) {
        logger.error('Error initializing Firestore for pricing', error as Error);
        return null;
      }
    })();
  }

  return initPromise;
}
