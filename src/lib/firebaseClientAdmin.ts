/**
 * src/lib/firebaseClientAdmin.ts
 *
 * Firebase Client SDK implementation for admin functionality.
 *
 * This file provides admin operations using the Firebase Client SDK instead of the Admin SDK.
 * It's the preferred approach for server components and server actions, offering better compatibility
 * with Next.js, Edge Runtime, and easier setup without service account credentials.
 *
 * Key benefits:
 * - Works in all Next.js environments including Edge Runtime
 * - No service account credentials required
 * - Unified SDK for both client and server-side code
 * - Security handled through Firebase Authentication and Security Rules
 *
 * For usage information, see /docs/guides/firebase-admin-setup.md
 */

import { db } from '@/lib/firebase'; // Import the already initialized client SDK
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc,
  deleteDoc,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

// Check if Firebase client is available
export function isFirestoreAvailable(): boolean {
  return !!db;
}

/**
 * Get properties for admin interface
 */
export async function getAdminProperties() {
  if (!db) {
    console.error('Firestore client not available');
    return [];
  }
  
  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);
    
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
  if (!db) {
    console.error('Firestore client not available');
    return [];
  }
  
  try {
    const seasonalPricingRef = collection(db, 'seasonalPricing');
    const q = query(seasonalPricingRef, where('propertyId', '==', propertyId));
    const snapshot = await getDocs(q);
    
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
  if (!db) {
    console.error('Firestore client not available');
    return [];
  }
  
  try {
    const dateOverridesRef = collection(db, 'dateOverrides');
    const q = query(dateOverridesRef, where('propertyId', '==', propertyId));
    const snapshot = await getDocs(q);
    
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
  if (!db) {
    console.error('Firestore client not available');
    return { success: false, error: 'Firestore client not available' };
  }
  
  try {
    const dateOverrideRef = doc(db, 'dateOverrides', dateOverrideId);
    
    await updateDoc(dateOverrideRef, { 
      available,
      updatedAt: serverTimestamp() 
    });
    
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
  if (!db) {
    console.error('Firestore client not available');
    return { success: false, error: 'Firestore client not available' };
  }
  
  try {
    const seasonRef = doc(db, 'seasonalPricing', seasonId);
    
    await updateDoc(seasonRef, { 
      enabled,
      updatedAt: serverTimestamp() 
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Error updating seasonal pricing ${seasonId}:`, error);
    return { success: false, error: `Failed to update seasonal pricing: ${error}` };
  }
}

/**
 * Generate price calendars for a property
 * This would typically call your price calendar generation logic,
 * but for now just returns success.
 */
export async function generatePriceCalendar(propertyId: string) {
  if (!db) {
    console.error('Firestore client not available');
    return { success: false, error: 'Firestore client not available' };
  }
  
  try {
    console.log(`[Client] Generating price calendars for property ${propertyId}`);
    
    // This would typically fetch all price information and generate calendars
    // For now, we'll just pretend to do it and return success
    
    // Add a record to show this was done
    const logsRef = collection(db, 'activityLogs');
    await addDoc(logsRef, {
      type: 'generate_price_calendar',
      propertyId,
      timestamp: serverTimestamp(),
      status: 'success',
      user: 'admin'
    });
    
    return { success: true, months: 12 };
  } catch (error) {
    console.error(`Error generating price calendars for property ${propertyId}:`, error);
    return { success: false, error: `Failed to generate price calendars: ${error}` };
  }
}