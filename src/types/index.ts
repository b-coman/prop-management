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
    coordinates: { // Using GeoPoint structure is better in Firestore, but keeping as object for simplicity here
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
  // Details moved to top-level
  pricePerNight: number;
  cleaningFee: number;
  maxGuests: number;
  bedrooms: number;
  beds: number; // Added from usage, assumed present in details
  bathrooms: number;
  squareFeet: number;
  // Rules moved to top-level
  checkInTime: string;
  checkOutTime: string;
  houseRules: string[];
  cancellationPolicy: string;
  // Added from propertyExample
  ratings?: {
    average: number;
    count: number;
  };
  createdAt: Timestamp; // Use Timestamp in Firestore
  updatedAt: Timestamp; // Use Timestamp in Firestore
  ownerId: string; // Reference to the property owner (User ID)
  isActive: boolean;
}

// Aligned with bookingExample structure
export interface Booking {
  id: string; // Corresponds to Document ID
  propertyId: string; // Reference to the property document
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string; // Optional
    address?: string; // Optional
    city?: string; // Optional
    state?: string; // Optional
    country?: string; // Optional
    zipCode?: string; // Optional
    userId?: string; // Optional: Link to User document if guest is a registered user
  };
  checkInDate: Timestamp; // Use Timestamp in Firestore
  checkOutDate: Timestamp; // Use Timestamp in Firestore
  numberOfGuests: number;
  pricing: {
    baseRate: number; // Price per night at time of booking
    numberOfNights: number;
    cleaningFee: number;
    subtotal: number; // baseRate * numberOfNights + cleaningFee
    taxes?: number; // Optional, can be calculated or stored
    total: number; // Final amount paid
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentInfo: {
    stripePaymentIntentId: string; // Store Payment Intent ID
    amount: number; // Should match pricing.total (in dollars)
    status: string; // e.g., 'succeeded', 'paid', 'requires_payment_method' from Stripe
    paidAt: Timestamp | null; // Timestamp when payment succeeded, or null
  };
  notes?: string; // Optional notes from the guest
  source?: string; // Optional: e.g., 'website', 'airbnb', 'booking.com'
  externalId?: string; // Optional: Booking ID from an external platform
  createdAt: Timestamp; // Firestore server timestamp
  updatedAt: Timestamp; // Firestore server timestamp
}

// Aligned with userExample structure
export interface User {
  id: string; // Corresponds to Auth User ID
  email: string; // From Auth
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'guest' | 'owner' | 'admin'; // Role determines permissions
  properties?: string[]; // Array of property IDs owned/managed by 'owner' or 'admin'
  settings?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  };
  createdAt: Timestamp; // Firestore server timestamp
  updatedAt: Timestamp; // Firestore server timestamp
  lastLogin?: Timestamp; // Updated on successful login
}

// Aligned with reviewExample structure
export interface Review {
  id: string; // Corresponds to Document ID
  propertyId: string;
  bookingId: string; // Link review to a specific booking
  guestId?: string; // Optional: Link to User document if guest is registered
  guestName: string; // Display name (can be anonymized if needed)
  rating: number; // e.g., 1-5 stars
  comment: string;
  photos?: string[]; // URLs of photos uploaded with the review
  date: Timestamp; // Date the review was submitted
  ownerResponse?: { // Optional response from the property owner
    comment: string;
    date: Timestamp;
  };
  isPublished: boolean; // Whether the review is visible on the site
}

// Aligned with availabilityExample structure (simplified for now)
// Note: Storing availability day-by-day can be complex.
// A simpler approach might be storing booked date ranges per property.
// This structure follows the example but might need refinement.
export interface Availability {
  id: string; // propertyId_YYYY-MM
  propertyId: string;
  month: string; // YYYY-MM format
  // Using an object might exceed Firestore document size limits for busy properties.
  // Consider storing booked ranges or using a dedicated availability service.
  available: { [day: number]: boolean }; // e.g., { 1: true, 2: false, ... }
  pricingModifiers?: { [day: number]: number }; // e.g., { 6: 1.2 } for 20% higher rate on day 6
  minimumStay?: { [day: number]: number }; // e.g., { 1: 2 } for 2-night min on day 1
  updatedAt: Timestamp;
}

// Aligned with settingsExample structure
export interface GlobalSettings {
  // Document ID should be 'global' or similar singleton ID
  siteInfo?: {
    name?: string;
    contact?: {
      email?: string;
      phone?: string;
    };
    socialMedia?: {
      facebook?: string;
      instagram?: string;
      // Add others as needed
    };
  };
  booking?: {
    defaultMinimumStay?: number;
    maxAdvanceBookingDays?: number;
    taxRate?: number; // e.g., 0.08 for 8%
  };
  maintenance?: {
    isMaintenanceMode?: boolean;
    maintenanceMessage?: string;
  };
  updatedAt: Timestamp;
}

// Aligned with syncCalendarExample structure
export interface SyncCalendar {
  id: string; // Corresponds to Document ID
  propertyId: string;
  platform: string; // e.g., 'airbnb', 'booking.com', 'vrbo'
  calendarId?: string; // Optional ID from the platform
  importUrl?: string; // URL to import external calendar data
  exportUrl?: string; // URL for external platforms to fetch this property's calendar
  lastSyncedAt?: Timestamp;
  isActive: boolean;
}
