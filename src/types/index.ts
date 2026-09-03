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

/**
 * Rich, vision-generated description of a gallery photo — the AI-readable field the ad/page selectors
 * reason over to decide if a photo FITS a goal/period/audience (promotion-system-architecture.md §4.2,
 * ad plan §14.2 `llmDescription`). Produced by `galleryVision.describeImage` (a vision model actually
 * LOOKS at the image); grounds ONLY in what's visible — never invents amenities. Far richer than
 * `alt`/`tags`: it captures season, mood, light, features, people, and which marketing angles fit.
 */
export interface AiImageDescription {
  summary: string;            // one line: what the photo shows
  setting: string;            // exterior | interior | garden | aerial | detail | ...
  season: string;             // autumn | winter | spring | summer | indeterminate
  timeOfDay: string;          // day | golden-hour | night | indeterminate
  mood: string;               // e.g. "cozy, warm", "tranquil", "lively"
  subjects: string[];         // concrete things visible: "cast-iron cauldron over a fire", "valley view"
  features: string[];         // amenities/features VISIBLE: "wood-burning stove", "terrace", "bunk beds"
  people: string;             // none | adults | children | family | mixed
  activities: string[];       // implied: "outdoor cooking", "kids playing"
  palette: string[];          // dominant colours: "golden", "warm wood"
  fitsAngles: string[];       // marketing angles it suits: "romantic", "family", "food-and-fire", "nature", "cozy-winter"
  model: string;              // provenance — which model described it
  describedAt: string;        // ISO timestamp
}

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
  /** Rich vision-generated description for AI ad/post selection (galleryVision.describeImage). */
  aiDescription?: AiImageDescription;
  sortOrder?: number; // For gallery ordering
  showInGallery?: boolean; // false = hidden from gallery (undefined/true = visible)
  thumbnailUrl?: string; // 400px thumbnail from Storage. Admin pickers only.
  /**
   * 1200px derivative. This is what guest-facing pages should render: cards,
   * grids, hero. Only the lightbox needs the full `url`. Optional because
   * images added before the display tier existed (or pasted as a raw URL)
   * never had one, so always read it as `displayUrl || url`.
   */
  displayUrl?: string;
  displayStoragePath?: string;
  /**
   * Kept in the library but withdrawn from active use: hidden from the gallery
   * and, importantly, excluded from the ad/post photo pool.
   *
   * This is what supersession should do rather than delete. An edited photo
   * replaces its source for selection purposes, but the source is still the
   * highest-fidelity thing we hold and the starting point for the next edit, so
   * throwing it away costs something and saves nothing.
   */
  archived?: boolean;
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

/**
 * How this property's copy should sound, in the owner's own terms.
 *
 * Written down because the alternative is the owner rewriting every generated line by hand: without
 * it each run starts from zero and produces competent, generic marketing Romanian. `examples` is the
 * load-bearing field — a model matches a demonstrated sentence far more reliably than it follows an
 * adjective like "warm", and `avoid` pairs are what actually kill a habit.
 *
 * Per-property on purpose: a mountain chalet and a city apartment do not share a voice.
 */
export interface BrandVoice {
  /** The language the copy is written in — the voice is not portable across languages. */
  language: string;
  /** Rules, most important first. Short and testable beats a paragraph of adjectives. */
  principles: string[];
  /** Real lines the owner wrote or approved. Worth more than any principle. */
  good: string[];
  /** Rejected phrasings, ideally as `wrong -> right`, so the model learns the correction. */
  avoid: string[];
  /** Anything that does not fit the above — house facts that shape tone, names to use, etc. */
  notes?: string;
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
  /** How copy for this property should sound. Read by the ad copywriter on every generation. */
  brandVoice?: BrandVoice;
  advertisedRateType?: 'starting' | 'average' | 'special' | 'nightly'; // Type of advertised rate
  baseCurrency: CurrencyCode; // The currency in which pricePerNight & advertisedRate are set
  cleaningFee?: number;
  maxGuests: number;
  /**
   * The cap on ADULTS, which is a separate constraint from `maxGuests` rather than a share of it.
   * The rule is `adults <= maxAdults` AND `adults + children <= maxGuests`, so a 7-person house that
   * sleeps at most 5 adults takes 5+2 and 4+3 alike. See `@/lib/occupancy` for the one implementation.
   *
   * There is deliberately no `maxChildren`. It existed, held 2, and was rendered as "5 adulți + 2
   * copii" — a pair that sums correctly and still understates the house, because it reads as the only
   * legal party. No constant can express the ceiling on children: it moves with the adult count.
   */
  maxAdults?: number;
  /**
   * The age below which a guest counts as a child, when the property states one.
   *
   * Only used to TELL people the rule - it changes no price, because a child above base occupancy
   * costs the same as an adult (deliberately; see plans/occupancy-adults-children.md). Optional and
   * never defaulted: inventing "under 14" for a property that never said so would be stating a policy
   * on the owner's behalf, so the sentence simply does not appear.
   */
  childMaxAge?: number;
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
  // NOTE: `channelIds` was removed 2026-08-07. It was declared but null on every property and read by
  // nothing — a fourth channel vocabulary (`booking_com`) that existed only in the type. Channels now
  // live in the `channels` collection; see src/lib/channels.ts for the one canonical vocabulary.
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

/**
 * Why a lead never became a guest. This changes the next message more than almost any other fact,
 * and the four cases are NOT interchangeable:
 *   unavailable — we could not serve the dates. Nothing negative happened; a later "that constraint
 *                 is gone" message is welcome.
 *   declined    — they chose not to (price, went elsewhere, a quote went quiet). Weak ground: do not
 *                 re-offer the same terms as though nothing had happened.
 *   unservable  — a structural mismatch we cannot fix (payment method, capacity, pets). Usually do
 *                 not re-contact unless the constraint itself changed.
 *   unresolved  — the conversation simply stopped. Unknown; a light re-open, not a follow-up.
 */
export type NonConversionReason = 'unavailable' | 'declined' | 'unservable' | 'unresolved';

/**
 * A period someone asked for. Doubles as DEMAND TELEMETRY: a request we could not fill is evidence
 * about pricing and calendar pressure that no booking record can show, because it never became one.
 */
export interface RequestedPeriod {
  start: string;        // 'YYYY-MM-DD'
  end: string;          // 'YYYY-MM-DD'
  askedOn: string;      // 'YYYY-MM-DD'
  outcome: 'unavailable' | 'declined' | 'booked' | 'unresolved';
  note?: string;
}

export interface Guest {
  id: string;
  /**
   * 'lead' = contacted us directly but never stayed. Absent/'guest' = has stayed (the historical
   * default). Leads live on this collection rather than a parallel one so that threads, notes,
   * consent, suppression, frequency caps and the send gateway — all keyed on a guest doc — work
   * unchanged, and so a lead who books keeps its id, and with it its whole conversation history.
   */
  kind?: 'guest' | 'lead';
  /**
   * How much to trust `firstName`. WhatsApp hands over a push-name that may be a nickname, all
   * caps, emoji-laden, or absent entirely — greeting someone by it is a real risk.
   */
  nameSource?: 'booking' | 'pushname' | 'manual' | 'unknown';
  leadSource?: string;                        // 'whatsapp' | 'phone' | 'website' | ...
  /**
   * HOW they reached us, for a booking typed in by hand. `source` says which CHANNEL the money came
   * through ('direct', 'airbnb'); this says what actually produced the conversation. A guest who
   * taps WhatsApp on the booking page and books over the phone is entered as source 'direct' and is
   * then indistinguishable from someone who found the site on Google — so the talk buttons generate
   * clicks we can count and bookings we can never attribute to them. One field closes that.
   */
  referredBy?: 'whatsapp' | 'phone' | 'email' | 'returning_guest' | 'referral' | 'website' | 'other' | null;
  firstContactAt?: string;                    // 'YYYY-MM-DD' — a lead's recency anchor (there is no stay)
  nonConversionReason?: NonConversionReason;
  requestedPeriods?: RequestedPeriod[];
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
  status?: 'ok' | 'no-chat' | 'empty'; // 'no-chat'/'empty' = processed, nothing to store (still a signal + resumable)
  lastMessageTs?: string;     // ts of the newest captured message — drives incremental top-up
  firstFetchedAt?: SerializableTimestamp;
  lastFetchedAt?: SerializableTimestamp;
}

/**
 * One immutable capture of a conversation, exactly as parsed, before reconciliation.
 * `whatsappThreads/{guestId}` is the derived view; this is the source of record — the insurance
 * that lets a thread be rebuilt when the chat itself is gone (disappearing timers, trimmed phones).
 */
export interface WhatsAppThreadImport {
  id: string;
  guestId: string;
  phone: string;
  source: 'export' | 'scrape';
  label: string;              // export filename / capture label
  messageCount: number;
  firstTs?: string;
  lastTs?: string;
  messages: WhatsAppMessage[];
  importedAt: SerializableTimestamp;
}

// ============================================================================
// Guest notes — the interactions that never touched WhatsApp
// ============================================================================

/**
 * `call`/`inperson` are real two-way TOUCHES: they prove engagement and they count against pacing
 * floors (you must not send a "we haven't spoken in a while" message the day after a phone call).
 * `observation` is something the owner noticed, not an exchange — context only, never a touch.
 */
export type GuestNoteKind = 'call' | 'inperson' | 'observation';

/** A specific claim a note licenses the copywriter to make, tagged as `note:<key>` in factsUsed. */
export interface GuestNoteFact {
  key: string;
  value: string;
}

/**
 * One recorded interaction or observation that lives outside the message vault — overwhelmingly a
 * phone call. Without these, a relationship conducted by phone is invisible: the system reads three
 * unanswered outbound WhatsApps and concludes "silent — never replied" about someone who was warm
 * and enthusiastic on the phone. That inversion is the reason this type exists.
 *
 * A note is OWNER RECALL, not system truth. It is unverified, it can be wrong, and it goes stale.
 * So it is truth-tiered: `assertable` decides whether the copywriter may state it at all, `facts`
 * narrows that to specific claims, and `expiresAt` retires notes whose relevance has a shelf life
 * ("planning something for October" is worthless in December).
 */
export interface GuestNote {
  id: string;
  guestId: string;
  occurredAt: string;          // 'YYYY-MM-DD' — when it HAPPENED, not when it was typed
  kind: GuestNoteKind;
  text: string;                // the owner's own words
  initiatedBy?: 'owner' | 'guest';
  /** May the copywriter assert this? Default false — a note shapes tone; it does not license claims. */
  assertable: boolean;
  /** Specific assertable claims. Only meaningful when `assertable` is true. */
  facts?: GuestNoteFact[];
  /** Withheld from packs after this date. */
  expiresAt?: string;          // 'YYYY-MM-DD'
  createdAt: SerializableTimestamp;
  createdBy?: string;
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
  | 'draft'          // Firestore-only proposal, editable, NO Meta objects exist yet (nothing on Meta)
  | 'pushed'         // pushed to Meta (PAUSED, zero spend, Meta policy-reviewing) — awaiting Go-live
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
/**
 * AdOutcome — the FROZEN learning record for one finished campaign (id == adCampaigns id == utm_campaign).
 * Written once by `finalizeAdOutcome` at `endTime + settleDays`, so learnings are stable and auditable
 * rather than drifting as late bookings trickle in. Keeps Meta's MODELED attribution (`metaReported`)
 * strictly separate from our FIRST-PARTY utm→booking join (`utmAttributed`) — they are different
 * numbers and must never be conflated (Fable finding). `caveats` carries the machine-readable honesty.
 */
export interface AdOutcome {
  id: string;
  propertyId: string;
  capturedAt: SerializableTimestamp;
  settleDays: number;
  // ── what we tried (denormalized so it survives later proposal/doc edits) ──
  window: { start: string; end: string; nights: number } | null;
  occasion: string | null;
  goal: string | null;
  audience: string | null;
  creativeBrief: string | null;
  copyCount: number;
  photos: string[];                 // storagePaths from the proposal
  cities: Array<{ key?: string; name: string; radius: number }>;
  dailyBudgetMinor: number;
  endTime: string;
  source: 'opportunity-engine' | 'manual';
  // ── what happened ──
  finalEffectiveStatus: string;
  delivery: { spend: number; impressions: number; clicks: number; ctr: number; cpc: number };
  metaReported: { purchases: number; purchaseValue: number; roas: number };   // Meta MODELED — not first-party
  utmAttributed: { bookings: number; revenue: number; bookingIds: string[] }; // FIRST-PARTY utm→booking join (a floor)
  verdict: 'converted' | 'clicked-no-booking' | 'no-delivery' | 'rejected' | 'never-activated';
  caveats: string[];
}

/**
 * AdLearnings — the compact "weak priors" block added to the ad-planner pack (Fable §1.5). RAW rows +
 * the statistical METHOD, never conclusions/"winner" labels — the same facts+method+constraints
 * discipline as the rest of the pack, which is also exactly the right small-n statistics. `available`
 * is false until the first outcome exists (ships dark, prompts no-op).
 */
export interface AdLearnings {
  available: boolean;
  campaignsCompleted: number;
  totals: { spend: number; impressions: number; clicks: number; utmBookings: number; utmRevenue: number };
  campaigns: Array<{
    occasion: string | null;
    goal: string | null;
    audience: string | null;
    window: string;
    cities: string[];
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    metaPurchases: number;
    utmBookings: number;
    utmRevenue: number;
    verdict: AdOutcome['verdict'];
    angle: string;                  // creativeBrief, truncated
  }>;
  note: string;                     // the statistical contract, shipped verbatim to the LLM
}

/**
 * A photo the copywriter WANTED for a theme the brief needs but the gallery can't supply (Fable §2.1).
 * It always anchors to the nearest REAL photo (never "invent a scene"), and carries a ready-to-paste
 * generation prompt so the operator can produce it in their own image-AI and upload the result (which
 * then gets auto-described). The manual-generation v1 — the honest "the system tells you what's
 * missing and how to make it" flow, before any paid generation gateway exists.
 */
export interface AdAssetGap {
  need: string;                    // what's missing, e.g. "a family at the fire pit at winter dusk"
  nearestAssetPath: string;        // a REAL offered gallery storagePath — the base to edit
  nearestAssetUrl?: string;        // for the review preview
  whyInsufficient: string;         // why the nearest real photo falls short
  transform: 'relight' | 'populate_people' | 'seasonal';
  generationPrompt: string;        // guarded, ready to paste into an image-AI (built server-side)
}

export interface AdCampaign {
  id: string;
  propertyId: string;
  segmentId?: string;
  metaCampaignId?: string;
  metaAdSetIds?: string[];
  metaAdIds?: string[];
  audienceRef?: string;
  objective?: string;              // e.g. 'OUTCOME_SALES'
  /**
   * The ad set's `optimization_goal`, when it is NOT the default implied by `objective`.
   *
   * Normally the two are locked together by `campaignBuilder` (sales -> OFFSITE_CONVERSIONS,
   * traffic -> LANDING_PAGE_VIEWS), so storing it would be redundant. It stops being redundant the
   * moment an operator retunes a live ad set: on 20 Aug birou-veverite was switched to
   * OFFSITE_CONVERSIONS on CONTENT_VIEW while its campaign stayed OUTCOME_TRAFFIC, which Meta
   * accepts. Without this field the record here says "traffic" and Meta says "conversions", and the
   * next person to read the doc draws the wrong conclusion about why delivery changed.
   */
  optimizationGoal?: string;
  /** The pixel event the ad set optimises toward, e.g. 'CONTENT_VIEW'. Meta's name, not ours. */
  optimizationEvent?: string;
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
  /**
   * True between the moment the Generate flow writes the row and the moment the plan+creative chain
   * lands on it. The row exists first so the console can show the run immediately — the chain takes
   * 60-90s, longer than Safari will hold a fetch open. A row left `generating` well past that means
   * the run died mid-flight; `generateError` carries the reason when there is one.
   */
  generating?: boolean;
  generateError?: string;
  generateStage?: string | null;
  /**
   * Opportunity-Engine proposal content (promotion-system-architecture.md §4.2) — the AI-drafted
   * plan + copy + photos, stored so the operator can REVIEW it in the console before approving
   * (the Meta chain already exists — Model A). Present only on drafts created via the "Generate from
   * an opportunity" flow (`generateAdProposalAction` / `proposeAd`), absent on manual composes.
   */
  proposal?: {
    source: 'opportunity-engine';
    occasion?: { name: string | null; start: string; end: string; nights: number } | null;
    /** The operator's outcome + audience steering, shown at review so it's clear what shaped the ad. */
    goal?: string | null;
    audience?: string | null;
    copy: CopyVariant[];
    photos: Array<{ storagePath: string; url: string }>;
    cities: Array<{ name: string; radius: number }>;
    /** Country codes, when a retargeting draft targets country-wide so the audience is not clipped. */
    countries?: string[];
    /** RETARGETING — the custom audiences this draft reaches. Empty/absent ⇒ a prospecting draft. */
    audiences?: Array<{ id: string; name: string }>;
    creativeBrief: string;
    rationale: string;
    /** Photos the AI wanted but the gallery lacks — each with a ready generation prompt (manual-gen v1). */
    assetGaps?: AdAssetGap[];
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
 * `'traffic'` → `'OUTCOME_TRAFFIC'`, plan REVISIONS S1).
 *
 * Pick by BUDGET, not by ambition. Meta needs roughly 50 optimisation events
 * per ad set per week to leave the learning phase. A small daily budget will
 * never produce that many purchases, so a `'sales'` campaign at that size
 * delivers semi-blind — our first live campaign spent 30 days and recorded
 * zero purchases, giving the optimiser nothing to learn from. `'traffic'`
 * optimises for landing-page views, which the same budget produces by the
 * dozen, and our own first-party utm→booking join still measures what actually
 * converted.
 */
export type AdObjective = 'sales' | 'traffic';

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
 * One Meta custom audience, in the platform-NEUTRAL shape the planner and composer share.
 *
 * `name` is carried alongside the id purely so a brief, a validation error and the admin review
 * screen can all say WHICH audience without a second Meta round-trip. Meta only needs the id.
 */
export interface AudienceTarget {
  id: string;
  name: string;
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
    /** Primary control (2b). Mapped to `geo_locations.cities`; `location_types` is no longer sent (Meta retired it). */
    cities: CityTarget[];
    /** Fallback ONLY — used as `geo_locations.countries` when `cities` is empty (backward-compatible with 2a's whole-country targeting). */
    countries?: string[];
    /**
     * RETARGETING. When non-empty the ad set targets these Meta custom audiences, and the composer
     * turns Advantage+ audience expansion OFF — expansion delivers to people OUTSIDE the audience,
     * which defeats the entire point of retargeting, and it also caps `age_min` at 25.
     *
     * Meta still requires a geo target on a retargeting ad set, so `cities` or `countries` must
     * still be present; the audience narrows that geo, it does not replace it.
     */
    customAudiences?: AudienceTarget[];
    /** Audiences to exclude — e.g. a hashed customer list, so you stop paying to reach people who already booked. */
    excludedCustomAudiences?: AudienceTarget[];
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