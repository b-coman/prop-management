
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
  createdAt?: Timestamp; // Use Timestamp in Firestore - Made optional as example lacks it
  updatedAt?: Timestamp; // Use Timestamp in Firestore - Made optional as example lacks it
  ownerId?: string; // Reference to the property owner (User ID) - Made optional as example lacks it
  isActive?: boolean; // Made optional as example lacks it
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


// Store this content in the Firebase Console -> Firestore Database -> Rules tab
export const securityRulesExample = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(propertyId) {
      // Check if the user is signed in and if their UID matches the ownerId of the property document
      // Ensure the property document exists before accessing its data
      return isSignedIn() && exists(/databases/$(database)/documents/properties/$(propertyId)) &&
             get(/databases/$(database)/documents/properties/$(propertyId)).data.ownerId == request.auth.uid;
    }

    function isAdmin() {
      // Check if the user is signed in and if their user document has the role 'admin'
      // Ensure the user document exists before accessing its data
      return isSignedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Properties collection
    match /properties/{propertyId} {
      allow read: if true; // Anyone can read property listings
      allow create: if isSignedIn() && request.resource.data.ownerId == request.auth.uid; // Only signed-in users can create properties, and they must be the owner
      allow update: if isOwner(propertyId) || isAdmin(); // Only the owner or an admin can update
      allow delete: if isOwner(propertyId) || isAdmin(); // Only the owner or an admin can delete
    }

    // Availability collection
    match /availability/{documentId} {
       // Extract propertyId from documentId (e.g., "prop1_2024-12")
      let propertyId = documentId.split('_')[0];
      allow read: if true; // Anyone can read availability
      // Allow write only if the user is the owner of the corresponding property or an admin
      allow write: if isOwner(propertyId) || isAdmin();
    }

    // Bookings collection
    match /bookings/{bookingId} {
      // Allow create by anyone (e.g., through the website form/Stripe webhook)
      // Tighten this if necessary, e.g., require authentication for logged-in users
      allow create: if true;
      // Allow read only by the guest who made the booking (using userId), the property owner, or an admin
      allow read: if isSignedIn() &&
                     (request.auth.uid == resource.data.guestInfo.userId ||
                      isOwner(resource.data.propertyId) ||
                      isAdmin());
       // Allow update (e.g., status change) only by the property owner or admin
       // Guests might only be allowed to cancel, which could be a specific update rule
      allow update: if isOwner(resource.data.propertyId) || isAdmin();
       // Generally, bookings shouldn't be deleted directly, but marked as cancelled.
       // Allow delete only by admin for cleanup purposes if absolutely necessary.
      allow delete: if isAdmin();
    }

    // Users collection
    match /users/{userId} {
      // Allow users to read and write their own data
      // Allow admins to read/write any user data
      allow read, write: if request.auth.uid == userId || isAdmin();
      // Prevent users from changing their own role unless they are admin
      allow update: if request.auth.uid == userId && !(request.resource.data.role != resource.data.role) || isAdmin();
       // Only admins can create new user documents directly (usually handled by Auth triggers)
      allow create: if isAdmin();
    }

    // Reviews collection
    match /reviews/{reviewId} {
      allow read: if true; // Reviews are public
      // Allow create only if the user is signed in (they might need to have completed a booking - more complex rule)
      allow create: if isSignedIn();
      // Allow update (e.g., publishing, owner response) only by admin or property owner
      allow update: if isAdmin() || isOwner(resource.data.propertyId);
      // Allow delete only by admin
      allow delete: if isAdmin();
    }

    // Settings collection
    match /settings/global { // Assuming a single document with ID "global"
      allow read: if true; // Global settings are public
      allow write: if isAdmin(); // Only admins can change global settings
    }

    // SyncCalendars collection
    match /syncCalendars/{documentId} {
      // Allow read/write only by the property owner or an admin
      allow read, write: if isOwner(resource.data.propertyId) || isAdmin();
    }
  }
}
`;
