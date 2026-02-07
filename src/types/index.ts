// src/types/index.ts
import type { Timestamp } from 'firebase/firestore';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'RON'] as const;
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];

// Representing Firestore Timestamps for client-side (can be Date, string, or Firestore Timestamp)
import type { FieldValue } from 'firebase/firestore';
export type SerializableTimestamp = Timestamp | Date | string | FieldValue;

// Multilingual string type for i18n support
export type MultilingualString = {
  en: string; // English is required as default
  ro?: string; // Romanian is optional
  [languageCode: string]: string | undefined;
};

export interface PropertyImage {
  url: string;
  alt: string;
  isFeatured?: boolean;
  'data-ai-hint'?: string; // For AI image generation hints
  tags?: string[]; // For gallery filtering
  sortOrder?: number; // For gallery ordering
  thumbnailUrl?: string; // Resized thumbnail URL from Storage
  storagePath?: string; // Firebase Storage path for full image
  thumbnailStoragePath?: string; // Firebase Storage path for thumbnail
}

export interface Location {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Property {
  id: string; // Document ID from Firestore (which is the slug)
  slug: string; // URL-friendly identifier, same as id
  name: MultilingualString;
  description?: MultilingualString;
  shortDescription?: MultilingualString;
  location: Location;
  images?: PropertyImage[]; // Array of image objects
  amenityRefs?: string[]; // References to amenity collection
  pricePerNight: number; // Base price per night in property's baseCurrency
  advertisedRate?: number; // Numeric value in property's baseCurrency
  advertisedRateType?: 'starting' | 'average' | 'special' | 'nightly'; // Type of advertised rate
  baseCurrency: CurrencyCode; // The currency in which pricePerNight & advertisedRate are set
  cleaningFee?: number;
  maxGuests: number;
  baseOccupancy: number; // Number of guests included in pricePerNight
  defaultMinimumStay: number; // Required minimum nights for booking
  extraGuestFee?: number; // Fee per additional guest per night, in property's baseCurrency
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  squareFeet?: number;
  propertyType?: 'entire_place' | 'chalet' | 'cabin' | 'villa' | 'apartment' | 'house' | 'cottage' | 'studio' | 'bungalow';
  bedConfiguration?: Array<{
    roomName: string;
    beds: Array<{
      type: 'king' | 'queen' | 'double' | 'single' | 'sofa_bed' | 'bunk' | 'crib';
      count: number;
    }>;
  }>;
  checkInTime?: string;
  checkOutTime?: string;
  houseRules?: MultilingualString[];
  cancellationPolicy?: MultilingualString;
  ratings?: {
    average: number;
    count: number;
  };
  status?: 'active' | 'inactive' | 'draft'; // Property status
  templateId: string; // ID of the website template to use
  themeId?: string; // ID of the design theme to use
  ownerId?: string; // User ID of the property owner
  ownerEmail?: string; // Email address for notifications (inquiries, bookings)
  channelIds?: { // For external platform sync
    airbnb?: string;
    booking_com?: string;
    vrbo?: string;
  };
  analytics?: {
    enabled: boolean;
    googleAnalyticsId?: string;
  };
  customDomain?: string | null;
  useCustomDomain?: boolean;
  // New fields for booking options
  holdFeeAmount?: number; // Amount for the hold fee
  holdDurationHours?: number; // Duration in hours that the hold is valid
  holdFeeRefundable?: boolean; // Whether the hold fee is refundable when booking is completed
  enableHoldOption?: boolean; // Toggle for enabling the hold option
  enableContactOption?: boolean; // Toggle for enabling the contact option
  contactPhone?: string; // Per-property contact phone (used in structured data & footer)
  contactEmail?: string; // Per-property contact email (used in structured data & footer)
  icalExportToken?: string; // Secret token for iCal export URL
  icalExportEnabled?: boolean; // Toggle iCal export on/off
  googlePlaceId?: string;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}
export interface Availability {
  id: string; // Document ID, e.g., propertySlug_YYYY-MM
  propertyId: string; // Slug of the property
  month: string; // Format: YYYY-MM
  available: {
    [day: number]: boolean; // Day of month (1-31) -> true (available), false (booked)
  };
  // New field to mark holds (optional, could also query bookings collection)
  holds?: {
     [day: number]: string | null; // Day of month -> bookingId of the hold, or null if no hold
  };
  pricingModifiers?: {
    [day: number]: number; // Day of month -> price multiplier (e.g., 1.2 for 20% higher)
  };
  minimumStay?: {
    [day: number]: number; // Day of month -> minimum nights
  };
  externalBlocks?: {
    [day: number]: string | null; // Day of month -> feedId (source of external block)
  };
  updatedAt?: SerializableTimestamp;
}

export interface ICalFeed {
  id: string; // Firestore document ID
  propertyId: string; // Property slug
  name: string; // User label, e.g. "Airbnb", "Booking.com"
  url: string; // External iCal feed URL
  enabled: boolean;
  lastSyncAt?: string | null;
  lastSyncStatus?: 'success' | 'error' | 'pending';
  lastSyncError?: string | null;
  lastSyncEventsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuestInfo {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  userId?: string; // If the guest is a registered user
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface BookingPricing {
  baseRate: number; // Nightly rate in property's base currency
  numberOfNights: number;
  cleaningFee: number; // In property's base currency
  extraGuestFee?: number; // Total extra guest fee for the stay, in property's base currency
  numberOfExtraGuests?: number;
  accommodationTotal: number; // (baseRate * nights) + extraGuestFee, in property's base currency
  subtotal: number; // accommodationTotal + cleaningFee, in property's base currency
  taxes?: number; // In property's base currency
  discountAmount?: number; // In property's base currency
  total: number; // Final total in property's base currency
  currency: CurrencyCode; // The currency used for all monetary values in this pricing object (should be property's baseCurrency)
}
export interface PaymentInfo {
  stripePaymentIntentId?: string;
  amount: number; // Amount paid, should be in the currency of booking.pricing.currency
  status: 'pending' | 'succeeded' | 'failed' | 'paid' | 'unknown'; // Extended status
  paidAt?: SerializableTimestamp | null;
}

// Supported languages for user preferences
export const SUPPORTED_LANGUAGES = ['en', 'ro'] as const;
export type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

export interface TouchData {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  referrer: string | null;
  landingPage: string | null;
  timestamp: string;
}

export interface BookingAttribution {
  firstTouch?: TouchData | null;
  lastTouch?: TouchData | null;
  gclid?: string | null;
  fbclid?: string | null;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

export interface Booking {
  id: string; // Document ID from Firestore
  propertyId: string; // Slug of the property
  guestInfo: GuestInfo;
  checkInDate: SerializableTimestamp;
  checkOutDate: SerializableTimestamp;
  numberOfGuests: number;
  pricing: BookingPricing; // Holds all pricing details including the currency
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'payment_failed' | 'on-hold'; // Added 'on-hold' status
  paymentInfo: PaymentInfo;
  notes?: string;
  source?: string; // e.g., 'website', 'airbnb', 'booking.com', 'direct', 'travelmint'
  externalId?: string; // ID from external platform if applicable
  imported?: boolean; // true for historically imported bookings (skip email crons)
  numberOfAdults?: number;
  numberOfChildren?: number;
  appliedCouponCode?: string | null; // Store the applied coupon code
  language?: LanguageCode; // User's preferred language at time of booking (for emails)
  // New fields for holds
  holdFee?: number; // Amount paid for the hold
  holdUntil?: SerializableTimestamp | null; // Timestamp when the hold expires
  holdPaymentId?: string | null; // Stripe PaymentIntent ID for the hold fee
  convertedFromHold?: boolean; // Flag if this booking was converted from a hold
  convertedFromInquiry?: string | null; // Inquiry ID if converted from an inquiry
  reviewRequestSentAt?: SerializableTimestamp; // When review request email was sent
  checkoutEmailSentAt?: SerializableTimestamp;
  returnIncentiveSentAt?: SerializableTimestamp;
  returnIncentiveCouponCode?: string;
  seasonalReminderSentAt?: SerializableTimestamp;
  attribution?: BookingAttribution;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}

export interface Guest {
  id: string;
  email?: string; // Normalized lowercase (optional for imported guests without email)
  firstName: string;
  lastName?: string;
  phone?: string;
  normalizedPhone?: string; // E.164 format for dedup (e.g., +40723184334)
  language: LanguageCode;
  sources?: string[]; // Platforms guest has booked through (airbnb, booking.com, direct, etc.)
  bookingIds: string[];
  propertyIds: string[];
  totalBookings: number;
  totalSpent: number;
  currency: CurrencyCode;
  firstBookingDate: SerializableTimestamp;
  lastBookingDate: SerializableTimestamp;
  lastStayDate?: SerializableTimestamp;
  reviewSubmitted: boolean;
  tags: string[];
  unsubscribed: boolean;
  unsubscribedAt?: SerializableTimestamp;
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
}

export interface Inquiry {
  id: string; // Document ID from Firestore
  propertySlug: string;
  checkIn: SerializableTimestamp;
  checkOut: SerializableTimestamp;
  guestCount: number;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string; // Optional phone
  };
  message: string;
  status: "new" | "responded" | "converted" | "closed";
  language?: LanguageCode; // User's preferred language at time of inquiry (for emails)
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
  responses?: Array<{ // Array of response messages
    message: string;
    createdAt: SerializableTimestamp;
    fromHost: boolean; // True if message is from host, false if from guest
  }>;
  // New fields for inquiry
  totalPrice?: number;
  currency?: CurrencyCode;
  attribution?: BookingAttribution;
}


export interface User {
  id: string; // Firebase Auth User ID
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Admin role types
  role?: 'super_admin' | 'property_owner';
  // Property slugs this user can manage (for property_owner role)
  managedProperties?: string[];
  // True if user was auto-created from SUPER_ADMIN_EMAILS env var
  autoProvisioned?: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
  lastLogin?: SerializableTimestamp;
}

export type ReviewSource = 'direct' | 'google' | 'booking.com' | 'airbnb' | 'manual';

export interface Review {
  id: string;
  propertyId: string;
  bookingId?: string;
  guestName: string;
  rating: number;             // 1-5
  comment: string;
  photos?: string[];
  date: SerializableTimestamp;
  source: ReviewSource;
  sourceUrl?: string;
  language?: string;
  ownerResponse?: {
    comment: string;
    date: SerializableTimestamp;
  };
  isPublished: boolean;
  createdAt: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}

export interface WebsiteTemplate {
  id: string; // e.g., "holiday-house"
  templateId: string; // duplicate for consistency if needed, same as id
  name: string;
  homepage: Array<{ id: string; type: string; [key: string]: any }>; // Array of block definitions
  header: {
    menuItems: Array<{ label: string; url: string }>;
    logo: { src: string; alt: string };
    [key: string]: any;
  };
  footer: {
    quickLinks: Array<{ label: string; url: string }>;
    contactInfo: { email: string; phone: string; address: string };
    socialLinks: Array<{ platform: string; url: string }>;
    showNewsletter?: boolean;
    newsletterTitle?: string;
    newsletterDescription?: string;
    copyrightText?: string; // Default copyright, can be overridden
    [key: string]: any;
  };
  defaults?: { // Default content for blocks
    [blockId: string]: any; // e.g., hero: { title: "Default Title", ... }
  };
  // other template-wide settings
}

export interface PropertyHeroOverride {
  backgroundImage?: string | null;
  'data-ai-hint'?: string;
  title?: string | null;
  subtitle?: string | null;
  price?: number | null; // If hero block displays a price different from property.advertisedRate
  showRating?: boolean;
  showBookingForm?: boolean;
   bookingForm?: {
    position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'compressed' | 'large';
  };
}

export interface PropertyExperienceHighlight {
  icon: string; // Icon name (e.g., "Mountain", "Users")
  title: string;
  description: string;
}
export interface PropertyExperienceOverride {
  title?: string;
  description?: string; // Welcome message
  highlights?: PropertyExperienceHighlight[];
}

export interface PropertyHostOverride {
  name?: string;
  image?: string | null; // URL to host photo
  'data-ai-hint'?: string;
  description?: string; // Welcome message from host
  backstory?: string; // Host's backstory related to the property
}

export interface PropertyFeatureOverride {
  icon?: string;
  title: string;
  description: string;
  image?: string | null; // URL to feature image
  'data-ai-hint'?: string;
}

export interface PropertyLocationOverride {
  title?: string; // e.g., "Explore Comarnic & Beyond"
  // mapCenter can come from property.location.coordinates
}

export interface PropertyAttractionOverride {
  name: string;
  distance?: string;
  description: string;
  image?: string | null; // URL to attraction image
  'data-ai-hint'?: string;
}

export interface PropertyReviewOverride {
  name: string;
  date?: string; // e.g., "June 2023"
  rating: number;
  text: string;
  imageUrl?: string | null; // URL to guest photo
  'data-ai-hint'?: string;
}

export interface PropertyTestimonialsOverride {
  title?: string;
  // overallRating comes from property.ratings.average
  reviews?: PropertyReviewOverride[];
}

export interface PropertyCtaOverride {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string; // Optional: specific URL or anchor link
  backgroundImage?: string | null;
  'data-ai-hint'?: string;
}

export interface PropertyOverrides {
  id?: string; // Document ID from Firestore (propertySlug)
  visibleBlocks?: string[];
  amenityRefs?: string[]; // References to amenity IDs in the amenities collection
  featureRefs?: string[]; // References to feature IDs in the features collection
  hero?: Partial<PropertyHeroOverride>;
  experience?: Partial<PropertyExperienceOverride>;
  host?: Partial<PropertyHostOverride>;
  features?: PropertyFeatureOverride[]; // Array of features (deprecated - use featureRefs)
  location?: Partial<PropertyLocationOverride>; // For title override mainly
  attractions?: PropertyAttractionOverride[]; // Array of attractions
  testimonials?: Partial<PropertyTestimonialsOverride>; // For title override, reviews array
  images?: PropertyImage[]; // For the gallery section, distinct from hero image
  cta?: Partial<PropertyCtaOverride>;
  // Add other overridable block structures as needed
  [key: string]: any; // Allow other dynamic properties
}

// Amenity document structure
export interface Amenity {
  id: string;
  name: MultilingualString;
  category: MultilingualString;
  icon: string;
  order?: number;
}

// Feature document structure  
export interface Feature {
  id: string;
  title: MultilingualString;
  description: MultilingualString;
  icon: string;
  order: number;
}

export interface Coupon {
  id: string; // Firestore document ID
  code: string; // The coupon code string (e.g., "SUMMER20")
  discount: number; // Percentage discount (e.g., 20 for 20%)
  validUntil: SerializableTimestamp; // Expiry date of the coupon
  isActive: boolean; // Whether the coupon is currently active
  description?: string; // Optional internal description
  propertyId?: string | null; // Optional: Restrict coupon to a specific property slug
  bookingValidFrom?: SerializableTimestamp | null; // Optional: Coupon valid for bookings starting from this date
  bookingValidUntil?: SerializableTimestamp | null; // Optional: Coupon valid for bookings ending by this date
  exclusionPeriods?: Array<{ start: SerializableTimestamp; end: SerializableTimestamp }> | null; // Optional: Date ranges when coupon is NOT valid
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
  // Potentially add usageLimits, minSpend, etc. in the future
}

// Pricing response interface for booking API calls
export interface PricingResponse {
  dailyRates: Record<string, number>;
  totalPrice: number;
  total: number; // Alternative total field
  averageNightlyRate: number;
  subtotal: number;
  cleaningFee: number;
  accommodationTotal: number; // Accommodation subtotal
  currency: CurrencyCode;
  minimumStay?: number;
  requiredNights?: number;
  numberOfNights: number;
  taxes?: number;
  // Additional properties to match PriceCalculationResult
  basePrice: number;
  baseRate?: number; // Alternative base rate field
  extraGuestFeeTotal: number;
  extraGuestFee?: number; // Alternative extra guest fee field
  discountAmount: number;
  numberOfExtraGuests: number;
  lengthOfStayDiscount?: {
    amount: number;
    percentage: number;
    discountAmount: number;
    discountPercentage: number;
  };
  couponDiscount?: {
    amount: number;
    code: string;
    discountAmount: number;
    discountPercentage?: number;
  };
}

// Pricing calculation result used by booking form components
export interface PriceCalculationResult {
  basePrice: number;
  baseRate?: number;
  extraGuestFeeTotal: number;
  extraGuestFee?: number;
  cleaningFee: number;
  subtotal: number;
  accommodationTotal?: number;
  discountAmount: number;
  total: number;
  totalPrice?: number;
  taxes?: number;
  currency: CurrencyCode;
  numberOfNights: number;
  numberOfExtraGuests: number;
}

export interface HousekeepingContact {
  id: string;
  propertyId: string;
  name: string;
  phone: string;              // E.164 format
  language: 'ro' | 'en';
  role: string;               // 'cleaning', 'maintenance', etc.
  enabled: boolean;
  notifyMonthly: boolean;
  notifyDaily: boolean;
  notifyChanges: boolean;
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
}

export interface HousekeepingMessage {
  id: string;
  propertyId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  type: 'monthly' | 'daily' | 'change' | 'manual';
  messageBody: string;
  twilioSid?: string;
  status: 'sent' | 'failed';
  error?: string;
  bookingId?: string;
  changeType?: 'new' | 'cancelled';
  createdAt: SerializableTimestamp;
}