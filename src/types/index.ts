

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
    'data-ai-hint'?: string; // Allow the data-ai-hint attribute
  }>;
  amenities: string[];
  // Details moved to top-level
  pricePerNight: number;
  cleaningFee: number;
  maxGuests: number; // Absolute maximum guests allowed
  baseOccupancy: number; // Number of guests included in the base price
  extraGuestFee: number; // Fee per additional guest per night
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
  createdAt?: Timestamp; // Use Timestamp in Firestore
  updatedAt?: Timestamp; // Use Timestamp in Firestore
  ownerId?: string; // Reference to the property owner (User ID)
  isActive?: boolean;
  // Fields for external platform synchronization
  airbnbListingId?: string;
  bookingComListingId?: string;
}

// Aligned with bookingExample structure
export interface Booking {
  id: string; // Corresponds to Document ID
  propertyId: string; // Reference to the property document
  guestInfo: {
    firstName: string;
    lastName?: string; // Made optional based on usage
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
    baseRate: number; // Price per night at time of booking (for base occupancy)
    numberOfNights: number;
    cleaningFee: number;
    extraGuestFee?: number; // Store the fee applied at the time of booking
    numberOfExtraGuests?: number; // Number of guests exceeding base occupancy
    accommodationTotal: number; // (baseRate + extraGuestFee * numberOfExtraGuests) * numberOfNights
    subtotal: number; // accommodationTotal + cleaningFee
    taxes?: number; // Optional, can be calculated or stored
    discountAmount?: number; // Optional: Amount discounted via coupon
    total: number; // Final amount paid (subtotal + taxes - discountAmount)
  };
  appliedCouponCode?: string; // Store the code that was applied
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

// Aligned with availabilityExample structure
// Represents the document structure in Firestore `availability` collection.
export interface Availability {
  id: string; // Document ID: propertyId_YYYY-MM
  propertyId: string;
  month: string; // Format: YYYY-MM
  available: { [day: number]: boolean }; // Map of day number (1-31) to availability status
  pricingModifiers?: { [day: number]: number }; // Optional: Map of day number to price multiplier (e.g., 1.2 for 20% increase)
  minimumStay?: { [day: number]: number }; // Optional: Map of day number to minimum stay requirement
  updatedAt: Timestamp; // Firestore server timestamp
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

// Firestore 'coupons' collection structure
export interface Coupon {
    id: string; // Document ID (can be the coupon code itself for easy lookup)
    code: string; // The actual coupon code string
    discount: number; // Percentage discount (e.g., 10 for 10%)
    validUntil: Timestamp; // The timestamp when the coupon expires
    description?: string; // Optional description of the coupon
    isActive: boolean; // Whether the coupon can currently be used
    createdAt: Timestamp; // Firestore server timestamp for when it was created
    // Optional: Add usage limits if needed
    // maxUses?: number;
    // currentUses?: number;
}

// Added type definition for the server action result
export type CreateCouponResult = {
  id?: string;
  code?: string;
  error?: string;
};
