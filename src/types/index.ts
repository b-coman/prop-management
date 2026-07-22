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
  /**
   * Plain string (legacy) or bilingual. It is rendered as a visible caption in
   * the gallery lightbox, not just as an accessibility attribute, so it is
   * translatable. Always read it through tc() on the client or
   * serverTranslateContent() on the server — never interpolate it directly.
   */
  alt: string | { en: string; ro: string };
  isFeatured?: boolean;
  'data-ai-hint'?: string; // For AI image generation hints
  tags?: string[]; // For gallery filtering
  sortOrder?: number; // For gallery ordering
  showInGallery?: boolean; // false = hidden from gallery (undefined/true = visible)
  thumbnailUrl?: string; // Resized thumbnail URL from Storage
  storagePath?: string; // Firebase Storage path for full image
  thumbnailStoragePath?: string; // Firebase Storage path for thumbnail
  blurDataURL?: string; // Tiny base64 blur placeholder for loading UX
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
    metaPixelId?: string; // Meta (Facebook/Instagram) Pixel / dataset id — per property
    // Growth Ad Engine (Phase 0) — per-property Meta Ads config. Agency-shaped:
    // metaTokenRef is a key into the META_ADS_TOKENS secret map, NOT the token
    // itself, and may be shared across properties under one agency BM. See
    // src/services/growth/metaAds/adContext.ts.
    metaAdAccountId?: string;       // "act_<id>"
    metaPageId?: string;            // Facebook Page id (ads publish AS a Page)
    metaInstagramActorId?: string;  // IG actor id, for IG placements
    metaTokenRef?: string;          // key into META_ADS_TOKENS
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
  // Dedicated Open Graph / social-share image (Facebook, Instagram, Twitter link previews).
  // Absolute URL or a path under /public (e.g. "/images/properties/<slug>/og-image.jpg").
  // Should be a purpose-cropped 1200x630 (1.91:1) JPG under ~300KB. Optional — when unset,
  // metadata generation falls back to the "/images/properties/<slug>/og-image.jpg" convention
  // path (if that file exists), then to the property's featured photo. See src/lib/og-image.ts.
  ogImage?: string;
  pricingConfig?: {
    weekendAdjustment: number;
    weekendDays: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
    lengthOfStayDiscounts?: Array<{
      nights: number;
      discountPercent: number;
    }>;
  };
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
  bookedAt?: SerializableTimestamp; // When the reservation was made on the platform
  cancelledAt?: SerializableTimestamp; // When the cancellation happened
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
  country?: string; // Guest country (from booking guestInfo)
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
  // --- Growth Engine (dark-launched — see plans/growth-engine.md §5) ---
  channelConsent?: ChannelConsent;
  consentLog?: ConsentLogEntry[];
  segmentIds?: string[];
  lastCampaignAt?: SerializableTimestamp;
  rfm?: GuestRFM;
  createdAt: SerializableTimestamp;
  updatedAt: SerializableTimestamp;
}

// ============================================================================
// Growth Engine (dark-launched — see plans/growth-engine.md §5)
// ============================================================================

export type ChannelType = 'whatsapp' | 'sms' | 'email';
export type ConsentState = 'opted_in' | 'opted_out' | 'unknown';

export interface ChannelConsent {
  whatsapp?: ConsentState;
  sms?: ConsentState;
  email?: ConsentState;
}

export interface ConsentLogEntry {
  channel: ChannelType;
  state: ConsentState;
  source: string; // e.g. 'booking', 'stop-keyword', 'admin', 'import'
  at: SerializableTimestamp;
}

export interface GuestRFM {
  recencyDays: number;
  frequency: number;
  monetary: number;
  score: number;
  segmentTag?: string; // e.g. 'vip', 'at-risk', 'lapsed'
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/**
 * Declarative audience filter evaluated against the `guests` collection.
 * All conditions are ANDed; range objects are inclusive.
 */
export interface SegmentDefinition {
  propertyId?: string;                          // guests.propertyIds array-contains
  lastStaySeason?: Season[];                    // season of lastStayDate
  monthsSinceLastBooking?: { min?: number; max?: number };
  monthsSinceLastStay?: { min?: number; max?: number };
  minTotalBookings?: number;                    // >= (repeat guests)
  maxTotalBookings?: number;                    // <=
  minTotalSpent?: number;
  countryIn?: string[];                         // ISO-2 codes
  countryNotIn?: string[];
  tagsInclude?: string[];                       // guest.tags intersects
  hasChannel?: ChannelType;                     // reachable via this channel
  excludeUnsubscribed?: boolean;                // default true
}

export interface Segment {
  id: string;
  name: string;
  definition: SegmentDefinition;
  dynamic: boolean;          // recomputed each use vs snapshot
  propertyId?: string;
  cachedCount?: number;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}

export type MessageLogStatus =
  | 'dry-run'      // would-send; recorded but NOT delivered (dark launch)
  | 'sending'      // claim written before delivery; blocks a concurrent/duplicate send (idempotency)
  | 'queued'       // handed to the manual-send outbox; awaiting the owner's one-tap send
  | 'sent'         // handed to provider
  | 'delivered'    // provider delivery confirmation
  | 'suppressed'   // blocked by suppression / consent / unsubscribe
  | 'skipped'      // no reachable contact / dedup
  | 'failed';      // provider error

export interface MessageLog {
  id: string;
  guestId: string;
  propertyId?: string | null; // which property this message was for (audit/reporting)
  channel: ChannelType;
  campaignId?: string | null;
  templateName?: string | null;
  status: MessageLogStatus;
  reason?: string | null;      // for suppressed / skipped / failed
  providerId?: string | null;  // e.g. Twilio SID
  to?: string | null;          // masked contact
  variables?: Record<string, string> | null;
  at?: SerializableTimestamp;
}

/** The owner's manual-send queue: rendered messages awaiting a one-tap wa.me send. */
export type OutboxStatus =
  | 'approved_pending_send'  // queued by a campaign; awaiting the owner
  | 'claimed'                // pulled by the Shortcut, not yet confirmed sent
  | 'sent'                   // owner sent it (Shortcut callback)
  | 'skipped';               // owner chose not to send

export interface OutboxMessage {
  id: string;
  campaignId?: string | null;
  guestId: string;
  propertyId?: string | null;
  phone: string;                  // E.164, ready for wa.me
  body: string;                   // rendered message text
  language: LanguageCode;
  status: OutboxStatus;
  messageLogId?: string | null;   // gateway claim doc, flipped to 'sent' on callback
  claimedAt?: SerializableTimestamp | null;
  sentAt?: SerializableTimestamp | null;
  finalText?: string | null;      // what the owner actually sent (edit capture)
  createdAt?: SerializableTimestamp;
}

// --- WhatsApp conversation history (verbatim vault) ---
// The backfilled, per-guest conversation record. Immutable source of truth for the
// intelligence layer (voice, engagement, grounding). Admin-only, never client-written.
// See plans/engagement-system.md §7.0/§7.1.

export type WhatsAppDirection = 'in' | 'out'; // 'out' = owner→guest, 'in' = guest→owner
export type WhatsAppMessageType = 'text' | 'media' | 'link' | 'system';

export interface WhatsAppMessage {
  ts: string;                 // Bucharest local wall-clock, 'YYYY-MM-DDTHH:MM:SS' — sortable, DST-safe
  direction: WhatsAppDirection;
  sender: string;             // display name / number from WhatsApp's data-pre-plain-text
  text: string;
  type: WhatsAppMessageType;
}

export interface WhatsAppThread {
  id: string;                 // == guestId
  guestId: string;
  phone: string;              // E.164, the number the thread belongs to
  messages: WhatsAppMessage[];
  messageCount: number;
  lastMessageTs?: string;     // ts of the newest captured message — drives incremental top-up
  firstFetchedAt?: SerializableTimestamp;
  lastFetchedAt?: SerializableTimestamp;
}

export interface SuppressionEntry {
  id: string;
  normalizedPhone?: string;
  email?: string;
  channel?: ChannelType | 'all';   // default 'all'
  reason: string;                  // 'stop-keyword' | 'unsubscribe' | 'bounce' | 'manual'
  source: string;
  at?: SerializableTimestamp;
}

/** Per-property Growth Engine configuration (M1). Stored at growthConfig/{propertyId}. */
export interface GrowthPropertyConfig {
  reactivationEnabled: boolean;              // does auto-reactivation run for this property?
  reactivationCohort: 'locals' | 'all';      // 'locals' = RO/MD + unknown; 'all' = everyone
  reactivationTemplate: string;              // marketing template name for the Day-90 touch
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled';

export interface CampaignStats {
  audienceSize: number;
  attempted: number;
  sent: number;
  dryRun: number;
  suppressed: number;
  skipped: number;
  failed: number;
}

/** An owner-written message variant for the manual message step (per language). */
export interface MessageVariant {
  language: LanguageCode;
  body: string; // may contain {name} / {property} / {link}
}

export interface Campaign {
  id: string;
  name: string;
  propertyId: string;
  channel: ChannelType;
  templateName: string;
  variables?: Record<string, string>;   // default template variables
  segmentId?: string;                    // reference to a saved segment (optional)
  segmentDefinition: SegmentDefinition;  // inline snapshot always present
  audienceGuestIds?: string[];           // hand-picked audience (manual message-step campaigns)
  messageVariants?: MessageVariant[];    // owner-written copy variants (set at approve)
  scheduleAt?: SerializableTimestamp | null;
  status: CampaignStatus;
  stats?: CampaignStats;
  approvedBy?: string | null;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
  sentAt?: SerializableTimestamp | null;
}

/**
 * Growth Ad Engine (Meta Ads) — `adCampaigns` collection doc status. Every
 * Meta-side create lands PAUSED regardless of this status (see
 * src/services/growth/metaAds/client.ts); this is OUR operator-approval state
 * machine that `adExecutionGateway.activateCampaign` gates on before it will
 * ever un-pause the Meta campaign (plan §13 H5).
 */
export type AdCampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'failed';

/**
 * `adCampaigns` collection doc — Growth Ad Engine (Meta) campaign tracking
 * (plan §4). Money fields are in Meta's MINOR UNITS (bani for RON) — always
 * suffixed `Minor` to make the unit explicit and impossible to confuse with a
 * major-unit RON amount (plan §13 M3). Phase 0 only depends on `propertyId`,
 * `metaCampaignId`, `status`, and `spendCapMinor` (what `adExecutionGateway`
 * gates activation on); the remaining fields land with Phase 2 campaign
 * creation but are declared now so the shape is stable.
 */
export interface AdCampaign {
  id: string;
  propertyId: string;
  segmentId?: string;
  metaCampaignId?: string;
  metaAdSetIds?: string[];
  metaAdIds?: string[];
  audienceRef?: string;
  objective?: string;              // e.g. 'OUTCOME_SALES'
  dailyBudgetMinor?: number;       // bani
  endTime?: string;                // ISO 8601 — the ad set's end_time; used by the approve-step spend-cap arithmetic
  spendCapMinor?: number;          // bani — required (snapshotted) before activation
  status: AdCampaignStatus;
  effectiveStatus?: string;        // Meta's effective_status, mirrored by the Phase-2 reconciliation cron
  creativeRef?: string;
  /** Phase 2b (§9f) — the Meta `image_hash`(es) the creative was built from; 1 = single-image `object_story_spec`, 2+ = Dynamic Creative `asset_feed_spec`. */
  assetHashes?: string[];
  /** Phase 2b — `assetHashes.length`, denormalized for a list view (e.g. "3 photos, dynamic") without reading the array. */
  imageCount?: number;
  approvedBy?: string;
  approvalSnapshot?: {
    dailyBudgetMinor?: number;
    spendCapMinor?: number;
    creativeRef?: string;
    at?: SerializableTimestamp;
  };
  insights?: {
    spend: number;
    impressions: number;
    clicks: number;
    bookings?: number;
    roas?: number;
  };
  lastSyncedAt?: SerializableTimestamp;
  createdAt?: SerializableTimestamp;
  updatedAt?: SerializableTimestamp;
}

/**
 * Growth Ad Engine — platform-NEUTRAL copy for one ad (Phase 2a Build A, plan
 * REVISIONS S1; genuinely multi-variant since Phase 2b). 2a composed with
 * exactly ONE variant; 2b allows up to `MAX_COPY_VARIANTS` (5, mirrors Meta's
 * `asset_feed_spec.bodies[]`/`titles[]` ≤5-each limit,
 * docs/meta-ads-infrastructure-2026.md §10) — `adComposer` maps 1 variant to
 * the single-image `object_story_spec.link_data` path and 2+ to the Dynamic
 * Creative `asset_feed_spec` path (§9f).
 */
export interface CopyVariant {
  primary: string;
  headline?: string;
  cta: AdCallToAction;
}

/**
 * Neutral ad objective — the Meta adapter (`metaAds/campaignBuilder`) maps
 * this to the platform's real objective enum (`'sales'` → `'OUTCOME_SALES'`,
 * plan REVISIONS S1). 2a supports only `'sales'`.
 */
export type AdObjective = 'sales';

/**
 * Neutral call-to-action — the Meta adapter maps this to Meta's CTA enum.
 * Only `'learn_more'` is LIVE-VERIFIED against the account
 * (docs/meta-ads-infrastructure-2026.md §9c); the others are UNVERIFIED —
 * spike-test before relying on them in production (plan REVISIONS S6).
 */
export type AdCallToAction = 'learn_more' | 'book_now' | 'contact_us';

/**
 * Growth Ad Engine — a single city geo-target (Phase 2b,
 * docs/meta-ads-infrastructure-2026.md §9f). `key` is Meta's opaque
 * `adgeolocation` identifier (resolved via `metaAds/geo.searchCities`) —
 * cities MUST be targeted by `key`, NEVER by `name`; `name`/`region` here are
 * for display only (e.g. an admin form's selected-city chip). `radius` is
 * ALWAYS kilometers — the Meta adapter hardcodes `distance_unit:'kilometer'`
 * (§9f's verified shape), no miles option in the neutral layer.
 */
export interface CityTarget {
  key: string;
  name: string;
  region?: string;
  radius: number;
}

/**
 * `adComposer.composeAndCreateAd` input — the platform-NEUTRAL compose
 * boundary (plan "The seam"). Nothing Meta-specific may leak in here (S1) —
 * everything platform-specific lives downstream, in `metaAds/*`.
 *
 * Phase 2b (docs/meta-ads-infrastructure-2026.md §9f) widened this from 2a's
 * shape in two ways: `assetRef` (one image) → `assetRefs` (1-`MAX_IMAGES`
 * images — 2+ triggers the Dynamic Creative `asset_feed_spec` path); and
 * `targeting.{ageMin,ageMax}` is GONE — the baked default is
 * `advantage_audience:1` (Advantage+ Audience), and per §9f that flag OWNS
 * demographics, rejecting a hard `age_min`/`age_max` outright (err
 * 100/1870188-9). `targeting.cities[]` is the new primary control; `countries`
 * is kept ONLY as a fallback for when no city is selected (2a's original
 * whole-country targeting still works, just without cities).
 */
export interface ComposeAndCreateAdInput {
  propertyId: string;
  assetRefs: Array<{
    /** 2b only supports the existing property gallery; `kind:'catalog'` is an additive future concept (S7). */
    kind: 'gallery';
    /** Full Firebase Storage path — NEVER a thumbnail. Asserted to start with `properties/${propertyId}/` (ownership, S7). */
    storagePath: string;
    /**
     * sha256 of the image bytes — OPTIONAL. Used only as a fast pre-download
     * cache probe (`metaAds/adImages.uploadImageToAccount`'s `UploadImageInput.contentHash`
     * is itself optional); the authoritative hash is always recomputed from the
     * actual downloaded bytes, so a caller (e.g. the console compose form,
     * which only knows a gallery image's `storagePath`) never needs to compute
     * this up front.
     */
    contentHash?: string;
  }>;
  /** 1 element ⇒ single-image `object_story_spec` path; 2+ (or 2+ `copy` variants) ⇒ Dynamic Creative `asset_feed_spec` path (§9f). Up to `MAX_COPY_VARIANTS` (5). */
  copy: CopyVariant[];
  objective: AdObjective;
  /** Should be the property's canonical custom domain, not a `*.hosted.app` URL — a mismatch breaks `conversion_domain` attribution (plan REVISIONS S8). */
  landingBaseUrl: string;
  /** Bani (minor units) — NEVER major-unit RON (plan §13 M3). Enforced ≤ `MAX_DAILY_BUDGET_MINOR` server-side (B2). */
  dailyBudgetMinor: number;
  targeting: {
    /** Primary control (2b). Mapped to `geo_locations.cities` + `location_types:['home','recent']` (§9f). */
    cities: CityTarget[];
    /** Fallback ONLY — used as `geo_locations.countries` when `cities` is empty (backward-compatible with 2a's whole-country targeting). */
    countries?: string[];
  };
  /** ISO 8601 — REQUIRED in 2a (plan REVISIONS B2): bounds the ad set's real spend window (Meta's 500 RON campaign-level spend-cap floor is too high for a small first test). */
  endTime: string;
}

/**
 * `adImageCache` collection doc — per-(platform, ad account, content hash)
 * dedup cache for uploaded creative images (plan REVISIONS B4). Doc id is
 * `${platform}_${accountId}_${contentHash}` (`accountId` WITHOUT the `act_`
 * prefix). Written only by `metaAds/adImages.uploadImageToAccount`; Firestore
 * rules make it Admin-SDK-only (`write: if false`).
 */
export interface AdImageCacheDoc {
  platform: 'meta';
  accountId: string;
  contentHash: string;
  imageHash: string;
  uploadedAt?: SerializableTimestamp;
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

/** Extended review with platform-specific rich metadata from Airbnb/Booking.com imports */
export interface RichReview extends Review {
  sourceReviewId?: string;
  sourceListingId?: string;
  // Airbnb
  subRatings?: Record<string, number>;
  tags?: Record<string, string[]>;
  stayDates?: string;
  profilePicturePath?: string;
  // Booking.com
  sourceRating?: number;
  title?: string;
  positiveReview?: string;
  negativeReview?: string;
  guestCountry?: string;
  additionalRatings?: Record<string, number>;
  translatedFrom?: string;
  hasHostReply?: boolean;
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