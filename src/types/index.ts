import type { Timestamp } from 'firebase/firestore';

// Aligned with propertyExample structure
export interface Property {
  id: string; // Corresponds to Document ID
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  images: Array<{
    url: string;
    alt: string;
    isFeatured: boolean;
  }>;
  amenities: string[];
  // Renamed 'details' sub-object properties to top-level for consistency with previous version
  pricePerNight: number; // Was details.pricePerNight
  cleaningFee: number; // Was details.cleaningFee
  maxGuests: number; // Was details.maxGuests
  bedrooms: number; // Was details.bedrooms
  beds: number; // Was details.beds - Added based on existing usage
  bathrooms: number; // Was details.bathrooms
  squareFeet: number; // Was details.squareFeet
  // Renamed 'rules' sub-object properties to top-level for consistency
  checkInTime: string; // Was rules.checkInTime
  checkOutTime: string; // Was rules.checkOutTime
  houseRules: string[]; // Was rules.houseRules
  cancellationPolicy: string; // Was rules.cancellationPolicy
  // Added fields from propertyExample
  ratings?: { // Optional as it might not exist initially
    average: number;
    count: number;
  };
  createdAt?: Timestamp | string; // Allow string for example, use Timestamp in practice
  updatedAt?: Timestamp | string;
  ownerId?: string;
  isActive?: boolean;
}

// Aligned with bookingExample structure
export interface Booking {
  id: string; // Corresponds to Document ID
  propertyId: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string; // Optional as per example
    address?: string; // Optional
    city?: string; // Optional
    state?: string; // Optional
    country?: string; // Optional
    zipCode?: string; // Optional
    // Added userId for potential linking to a user account, aligning with security rules example
    userId?: string;
  };
  checkInDate: Timestamp | string; // Use Timestamp in practice, allow string for example/metadata
  checkOutDate: Timestamp | string; // Use Timestamp in practice, allow string for example/metadata
  numberOfGuests: number;
  pricing: {
    baseRate: number;
    numberOfNights: number;
    cleaningFee: number;
    subtotal: number;
    taxes?: number; // Optional as per example
    total: number;
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; // Added 'pending'
  paymentInfo: {
    stripePaymentIntentId: string; // Renamed from stripeCheckoutSessionId for clarity
    amount: number;
    status: string; // e.g., 'succeeded', 'pending', 'failed'
    paidAt: Timestamp | null | string; // Use Timestamp or null
  };
  notes?: string; // Optional
  source?: string; // Optional (e.g., 'website', 'airbnb')
  externalId?: string; // Optional
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

// Added User type based on userExample
export interface User {
  id: string; // Corresponds to Document ID (auth user ID)
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'guest' | 'owner' | 'admin'; // Added 'guest' role
  properties?: string[]; // Property IDs owned/managed
  settings?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  };
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  lastLogin?: Timestamp | string;
}

// Added Review type based on reviewExample
export interface Review {
  id: string; // Corresponds to Document ID
  propertyId: string;
  bookingId: string;
  guestName: string; // Or potentially guestId: string;
  rating: number;
  comment: string;
  photos?: string[];
  date: Timestamp | string;
  ownerResponse?: {
    comment: string;
    date: Timestamp | string;
  };
  isPublished?: boolean;
}

// --- Placeholder types (can be expanded later if needed) ---

// Minimal Availability type (can be expanded based on availabilityExample)
export interface Availability {
  id: string; // propertyId_YYYY-MM
  propertyId: string;
  month: string; // YYYY-MM
  // Simple representation, can be enhanced later
  unavailableDays: number[]; // Array of day numbers [3, 4, 5]
  updatedAt: Timestamp | string;
}

// Minimal Settings type (can be expanded based on settingsExample)
export interface GlobalSettings {
  taxRate?: number;
  defaultMinimumStay?: number;
  updatedAt?: Timestamp | string;
}

// Minimal SyncCalendar type (can be expanded based on syncCalendarExample)
export interface SyncCalendar {
  id: string; // Corresponds to Document ID
  propertyId: string;
  platform: string;
  importUrl?: string;
  exportUrl?: string;
  lastSyncedAt?: Timestamp | string;
  isActive?: boolean;
}
