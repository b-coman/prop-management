// src/lib/firebaseAdminFacade.ts
// A facade that tries to use the real Firebase Admin, but falls back to mock implementation
export const runtime = 'nodejs';

// Import both real and mock implementations
import * as realFirebaseAdmin from './firebaseAdminSimple';
import * as mockFirebaseAdmin from './mockAdminFirestore';

// Track if we're using the mock implementation
let _usingMock = false;
let _initializationError: any = null;

// Determine if we should use the real or mock implementation
function shouldUseMock() {
  // Already determined we're using mock
  if (_usingMock) {
    return true;
  }
  
  // Check if real implementation is available
  const realIsAvailable = realFirebaseAdmin.isFirestoreAdminAvailable();
  
  if (!realIsAvailable) {
    // Store the initialization error if any
    _initializationError = realFirebaseAdmin.getInitializationError();
    
    // Use mock implementation
    _usingMock = true;
    console.log('⚠️ Using mock Firestore implementation due to initialization error');
    return true;
  }
  
  // Use real implementation
  console.log('✅ Using real Firebase Admin implementation');
  return false;
}

/**
 * Check if Firestore is available
 */
export function isFirestoreAvailable(): boolean {
  return shouldUseMock() 
    ? mockFirebaseAdmin.isFirestoreAvailable() 
    : realFirebaseAdmin.isFirestoreAdminAvailable();
}

/**
 * Check if we're using the mock implementation
 */
export function isUsingMockImplementation(): boolean {
  return shouldUseMock();
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
  return shouldUseMock()
    ? mockFirebaseAdmin.getAdminProperties()
    : realFirebaseAdmin.getAdminProperties();
}

/**
 * Get seasonal pricing for a property
 */
export async function getAdminSeasonalPricing(propertyId: string) {
  return shouldUseMock()
    ? mockFirebaseAdmin.getAdminSeasonalPricing(propertyId)
    : realFirebaseAdmin.getAdminSeasonalPricing(propertyId);
}

/**
 * Get date overrides for a property
 */
export async function getAdminDateOverrides(propertyId: string) {
  return shouldUseMock()
    ? mockFirebaseAdmin.getAdminDateOverrides(propertyId)
    : realFirebaseAdmin.getAdminDateOverrides(propertyId);
}

/**
 * Toggle date override availability
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  return shouldUseMock()
    ? mockFirebaseAdmin.toggleDateOverrideAvailability(dateOverrideId, available)
    : realFirebaseAdmin.toggleDateOverrideAvailability(dateOverrideId, available);
}

/**
 * Toggle seasonal pricing status
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  return shouldUseMock()
    ? mockFirebaseAdmin.toggleSeasonalPricingStatus(seasonId, enabled)
    : realFirebaseAdmin.toggleSeasonalPricingStatus(seasonId, enabled);
}

/**
 * Generate price calendars for a property
 */
export async function generatePriceCalendar(propertyId: string) {
  return shouldUseMock()
    ? mockFirebaseAdmin.generatePriceCalendar(propertyId)
    : realFirebaseAdmin.generatePriceCalendar(propertyId);
}

// Export Firestore instance for direct access if needed
export const dbAdmin = shouldUseMock() ? mockFirebaseAdmin.dbAdmin : realFirebaseAdmin.dbAdmin;