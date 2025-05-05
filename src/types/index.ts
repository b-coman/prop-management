
import type { Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Use FirestoreTimestamp alias

// Type alias for values that might be Timestamps server-side but serialized for the client
// Allow null for optional dates
export type SerializableTimestamp = FirestoreTimestamp | string | number | Date | null; // Added Date

// Interface for a single block definition within a template or override
export interface WebsiteBlock {
    id: string; // e.g., "hero", "features", "location"
    type: string; // e.g., "hero", "experience", "features"
    // Optional default settings or content structures can be added here
    title?: string; // Example default title
    description?: string; // Example default description
}

// Represents the structure of a document in the 'websiteTemplates' collection
export interface WebsiteTemplate {
    id: string; // Document ID (e.g., "holiday-house")
    templateId: string; // Matches the document ID
    name: string; // e.g., "Holiday House Template"
    homepage?: WebsiteBlock[]; // Defines the blocks and their order for the homepage
    header?: { // Defines default header structure
        menuItems?: Array<{ label: string; url: string }>;
        logo?: { src: string; alt: string };
    };
    footer?: { // Defines default footer structure
        quickLinks?: Array<{ label: string; url: string }>;
        contactInfo?: { email?: string; phone?: string; address?: string };
        socialLinks?: Array<{ platform: string; url: string }>;
        showNewsletter?: boolean;
        newsletterTitle?: string;
        newsletterDescription?: string;
    };
    // Add defaults object to hold default content for each block
    defaults?: {
        [blockId: string]: any; // Keyed by block ID, value is the default content object for that block
    };
    // Add other template-specific fields if needed
}

// Represents the structure of a document in the 'properties' collection
// This stores the core, non-website-specific metadata
export interface Property {
  id: string; // Document ID, which is the property slug (e.g., "prahova-mountain-chalet")
  templateId: string; // ID of the WebsiteTemplate this property uses
  name: string;
  slug: string; // Should match the document ID
  description?: string; // Core description
  shortDescription?: string; // Core short description
  location: {
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  images?: Array<{ // Base images if needed, primarily used if overrides are missing
    url: string;
    alt: string;
    isFeatured?: boolean; // Base featured image
    'data-ai-hint'?: string;
  }>;
  amenities?: string[];
  pricePerNight: number;
  cleaningFee?: number;
  maxGuests: number;
  baseOccupancy: number;
  extraGuestFee?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  squareFeet?: number;
  checkInTime?: string;
  checkOutTime?: string;
  houseRules?: string[];
  cancellationPolicy?: string;
  ratings?: {
    average: number;
    count: number;
  };
  status?: 'active' | 'inactive' | 'draft'; // Added status
  schemaVersion?: number; // For future data migrations
  ownerId?: string; // Reference to the property owner (User ID)
  channelIds?: { // IDs for syncing with external platforms
      airbnb?: string | null;
      booking_com?: string | null;
      // Add other channels as needed
  };
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}


// Represents the structure of a document in the 'propertyOverrides' collection
// This stores per-property content and visibility settings
export interface PropertyOverrides {
    id?: string; // Document ID (property slug) - Optional as it matches the doc ID itself
    visibleBlocks?: string[]; // Array of block IDs to display from the template
    hero?: { // Override content specifically for the hero section
        backgroundImage?: string | null;
         'data-ai-hint'?: string;
         title?: string; // Allow overriding title
         subtitle?: string; // Allow overriding subtitle
        // Add other hero-specific overrides if needed (e.g., title, subtitle)
    };
    experience?: { // Override content for the experience section
        title?: string;
        welcomeText?: string; // Renamed from description for clarity
        highlights?: Array<{ icon: string; title: string; description: string }>;
    };
     host?: { // Override content for the host section
         name: string;
         imageUrl?: string | null;
         welcomeMessage: string;
         backstory: string;
         'data-ai-hint'?: string;
     };
    features?: Array<{ // Array of features to display
        icon?: string; // Icon name (map to component later)
        title: string;
        description: string;
        image?: string | null;
        'data-ai-hint'?: string;
    }>;
    location?: { // Overrides specific to location block (attractions primarily)
        title?: string; // Allow overriding title
        // Map settings could go here if they vary per property
    };
    attractions?: Array<{ // Array of nearby attractions
        name: string;
        distance?: string;
        description: string;
        image?: string | null;
        'data-ai-hint'?: string;
    }>;
    testimonials?: { // Now an object containing the reviews array
        title?: string; // Allow overriding title
        reviews: Array<{ // Array of selected testimonials
            id?: string;
            name: string;
            date?: string; // e.g., "May 2025" or "2025-05-15"
            rating: number;
            text: string;
            imageUrl?: string | null;
            'data-ai-hint'?: string;
        }>
    };
     gallery?: { // Gallery section might have its own title override
         title?: string;
     };
    images?: Array<{ // Gallery images (separate from hero/feature images)
        url: string;
        alt: string;
        isFeatured?: boolean; // Should generally be false if 'hero' has its own background logic
        tags?: string[]; // e.g., ["exterior", "living room", "view", "hero"]
        sortOrder?: number;
         'data-ai-hint'?: string;
    }>;
    cta?: { // Override content for the Call To Action section
        title?: string;
        description?: string;
        buttonText?: string;
        buttonUrl?: string; // Optional specific URL or anchor link
        backgroundImage?: string | null;
         'data-ai-hint'?: string;
    };
    // Add override fields for header/footer if needed
    // header?: { ... };
    // footer?: { ... };
    updatedAt?: SerializableTimestamp; // Track when overrides were last updated
}


// --- Other existing types ---

export interface Booking {
  id: string;
  propertyId: string; // Property SLUG
  guestInfo: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    userId?: string;
  };
  checkInDate: SerializableTimestamp;
  checkOutDate: SerializableTimestamp;
  numberOfGuests: number;
  pricing: {
    baseRate: number;
    numberOfNights: number;
    cleaningFee: number;
    extraGuestFee?: number;
    numberOfExtraGuests?: number;
    accommodationTotal: number;
    subtotal: number;
    taxes?: number;
    discountAmount?: number;
    total: number;
  };
  appliedCouponCode?: string | null; // Allow null
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentInfo: {
    stripePaymentIntentId: string;
    amount: number;
    status: string; // e.g., 'pending', 'succeeded', 'failed'
    paidAt: SerializableTimestamp | null;
  };
  notes?: string;
  source?: string; // e.g., 'website', 'airbnb', 'simulation'
  externalId?: string; // ID from external platform if applicable
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role: 'guest' | 'owner' | 'admin';
  properties?: string[]; // Array of property slugs owned/managed
  settings?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  };
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
  lastLogin?: SerializableTimestamp;
}

export interface Review {
  id: string;
  propertyId: string; // property slug
  bookingId: string;
  guestId?: string;
  guestName: string;
  rating: number;
  comment: string;
  photos?: string[];
  date: SerializableTimestamp;
  ownerResponse?: {
    comment: string;
    date: SerializableTimestamp;
  };
  isPublished: boolean;
}

// Represents availability for a single property for a single month
export interface Availability {
  id: string; // Document ID: propertySlug_YYYY-MM
  propertyId: string; // Property SLUG
  month: string; // Format: YYYY-MM
  available: { [day: number]: boolean }; // Map of day number to availability
  pricingModifiers?: { [day: number]: number }; // Optional: Price factor for specific days
  minimumStay?: { [day: number]: number }; // Optional: Minimum stay for specific days
  updatedAt: SerializableTimestamp;
}

export interface GlobalSettings {
  siteInfo?: {
    name?: string;
    contact?: { email?: string; phone?: string; };
    socialMedia?: { facebook?: string; instagram?: string; };
  };
  booking?: {
    defaultMinimumStay?: number;
    maxAdvanceBookingDays?: number;
    taxRate?: number;
  };
  maintenance?: {
    isMaintenanceMode?: boolean;
    maintenanceMessage?: string;
  };
  updatedAt: SerializableTimestamp;
}

export interface SyncCalendar {
  id: string;
  propertyId: string; // property slug
  platform: string; // e.g., 'airbnb', 'booking.com'
  calendarId?: string; // Platform-specific ID
  importUrl?: string; // iCal import URL
  exportUrl?: string; // iCal export URL (generated by your system)
  lastSyncedAt?: SerializableTimestamp;
  isActive: boolean;
}

// Represents a discount coupon
export interface Coupon {
    id: string; // Firestore document ID
    code: string; // The coupon code (e.g., "SUMMER25")
    discount: number; // Percentage discount (e.g., 25 for 25%)
    validUntil: SerializableTimestamp | null; // Expiry date of the coupon code itself
    description?: string; // Internal description
    isActive: boolean; // Whether the coupon is currently active
    createdAt: SerializableTimestamp;
    updatedAt?: SerializableTimestamp;
    // Optional: Restrict coupon to a specific property (using slug)
    propertyId?: string | null;
    // Optional: Restrict coupon to specific booking dates
    bookingValidFrom?: SerializableTimestamp | null;
    bookingValidUntil?: SerializableTimestamp | null;
    // Optional: Define periods when the coupon cannot be used
    exclusionPeriods?: Array<{ start: SerializableTimestamp; end: SerializableTimestamp }> | null;
    // Optional: Usage limits (can be added later)
    // maxUses?: number | null;
    // currentUses?: number;
}

// Type for the result of the createCouponAction
export type CreateCouponResult = {
  id?: string;
  code?: string;
  error?: string;
};
