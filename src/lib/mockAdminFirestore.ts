// src/lib/mockAdminFirestore.ts
// Mock Firestore implementation that doesn't require Firebase Admin initialization
export const runtime = 'nodejs';

// Sample data for local development
const SAMPLE_PROPERTIES = [
  {
    id: 'prahova-mountain-chalet',
    name: 'Prahova Mountain Chalet',
    location: 'Prahova, Romania',
    status: 'active',
    pricePerNight: 150
  },
  {
    id: 'coltei-apartment-bucharest',
    name: 'Coltei Apartment Bucharest',
    location: 'Bucharest, Romania',
    status: 'active',
    pricePerNight: 120
  }
];

const SAMPLE_SEASONAL_PRICING = {
  'prahova-mountain-chalet': [
    {
      id: 'winter-2023',
      propertyId: 'prahova-mountain-chalet',
      name: 'Winter Season 2023',
      seasonType: 'high',
      startDate: '2023-12-01',
      endDate: '2024-02-28',
      priceMultiplier: 1.5,
      minimumStay: 3,
      enabled: true
    },
    {
      id: 'summer-2024',
      propertyId: 'prahova-mountain-chalet',
      name: 'Summer Season 2024',
      seasonType: 'medium',
      startDate: '2024-06-01',
      endDate: '2024-08-31',
      priceMultiplier: 1.3,
      minimumStay: 2,
      enabled: true
    }
  ],
  'coltei-apartment-bucharest': [
    {
      id: 'holiday-season-2023',
      propertyId: 'coltei-apartment-bucharest',
      name: 'Holiday Season 2023',
      seasonType: 'high',
      startDate: '2023-12-20',
      endDate: '2024-01-05',
      priceMultiplier: 1.4,
      minimumStay: 2,
      enabled: true
    }
  ]
};

const SAMPLE_DATE_OVERRIDES = {
  'prahova-mountain-chalet': [
    {
      id: 'christmas-2023',
      propertyId: 'prahova-mountain-chalet',
      date: '2023-12-25',
      customPrice: 220,
      reason: 'Christmas Day',
      minimumStay: 3,
      available: true,
      flatRate: true
    },
    {
      id: 'new-years-eve-2023',
      propertyId: 'prahova-mountain-chalet',
      date: '2023-12-31',
      customPrice: 250,
      reason: 'New Year\'s Eve',
      minimumStay: 3,
      available: true,
      flatRate: true
    }
  ],
  'coltei-apartment-bucharest': [
    {
      id: 'christmas-2023-bucharest',
      propertyId: 'coltei-apartment-bucharest',
      date: '2023-12-25',
      customPrice: 180,
      reason: 'Christmas Day',
      minimumStay: 2,
      available: true,
      flatRate: true
    }
  ]
};

// Flag to show we're using mock data
let usingMockData = true;

/**
 * Check if Firestore simulation is available
 */
export function isFirestoreAvailable(): boolean {
  return true; // Always available since we're mocking
}

/**
 * Get all properties
 */
export async function getAdminProperties() {
  console.log('[MockFirestore] Using simulated properties data');
  return SAMPLE_PROPERTIES;
}

/**
 * Get seasonal pricing for a property
 */
export async function getAdminSeasonalPricing(propertyId: string) {
  console.log(`[MockFirestore] Using simulated seasonal pricing data for ${propertyId}`);
  return (SAMPLE_SEASONAL_PRICING as any)[propertyId] || [];
}

/**
 * Get date overrides for a property
 */
export async function getAdminDateOverrides(propertyId: string) {
  console.log(`[MockFirestore] Using simulated date overrides data for ${propertyId}`);
  return (SAMPLE_DATE_OVERRIDES as any)[propertyId] || [];
}

/**
 * Toggle date override availability (simulated)
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  console.log(`[MockFirestore] Toggling date override ${dateOverrideId} availability to ${available}`);
  
  // In a real implementation, this would update Firestore
  return { success: true, mockData: true };
}

/**
 * Toggle seasonal pricing status (simulated)
 */
export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  console.log(`[MockFirestore] Toggling seasonal pricing ${seasonId} status to ${enabled}`);
  
  // In a real implementation, this would update Firestore
  return { success: true, mockData: true };
}

/**
 * Generate price calendars (simulated)
 */
export async function generatePriceCalendar(propertyId: string) {
  console.log(`[MockFirestore] Generating price calendars for property ${propertyId}`);
  
  // In a real implementation, this would generate price calendars
  return { success: true, months: 12, mockData: true };
}

// Export a placeholder for dbAdmin to maintain interface compatibility
export const dbAdmin = {};