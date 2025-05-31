# RentalSpot Booking System v2.0 - Complete Functional Specification

**Document Version**: 2.0  
**Last Updated**: May 31, 2025  
**Status**: Draft - Awaiting Functional Requirements  

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Specification](#architecture-specification)
3. [Business Logic & Rules](#business-logic--rules) ⚠️ **NEEDS DETAILS**
4. [User Workflows](#user-workflows) ⚠️ **NEEDS DETAILS**
5. [API Specifications](#api-specifications)
6. [Component Specifications](#component-specifications)
7. [Multi-Context Support](#multi-context-support) ⚠️ **NEEDS DETAILS**
8. [Error Handling & Edge Cases](#error-handling--edge-cases) ⚠️ **NEEDS DETAILS**
9. [Integration Requirements](#integration-requirements) ⚠️ **NEEDS DETAILS**
10. [Security & Validation](#security--validation) ⚠️ **NEEDS DETAILS**
11. [Performance Requirements](#performance-requirements)
12. [Testing Strategy](#testing-strategy)
13. [Implementation Plan](#implementation-plan)

---

## 1. System Overview

### Purpose
Build a reliable, high-performance booking system that allows users to check availability, view pricing, and complete bookings for rental properties with support for multiple languages, currencies, themes, and custom domains.

### Core Principles
- **Simplicity First**: Clear data flow, obvious responsibilities, no magic
- **Single Source of Truth**: BookingProvider manages all state
- **User-Triggered API Calls**: No automatic pricing updates
- **Data Persistence**: Booking state survives page refreshes
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### Key Features
- Real-time availability checking with calendar visualization
- Dynamic pricing with pre-calculated guest-based rates
- Three booking options: Book Now, Hold Booking, Contact Host (Inquiry)
- Multi-language support (EN/RO)
- Multi-currency support (EUR/USD/RON)
- Custom domain architecture
- Mobile-first responsive design
- Session persistence

---

## 2. Architecture Specification

### Component Hierarchy
```
/booking/check/[slug] (Route)
├── page.tsx (Server Component)
│   ├── Property data fetching (Firestore Admin SDK)
│   ├── Theme resolution
│   └── Hero image selection
│
└── BookingPage.tsx (Client Component)
    ├── Provider Stack
    │   ├── ThemeProvider
    │   ├── LanguageProvider  
    │   ├── CurrencyProvider
    │   └── BookingProvider (Single instance)
    │
    └── BookingLayout.tsx
        ├── PropertySidebar (Desktop ≥768px)
        ├── MobileHeader (Mobile <768px)
        └── BookingFlow.tsx
            ├── DateAndGuestSelector.tsx
            │   ├── DateSelector (Calendar)
            │   └── GuestSelector (Count picker)
            ├── PricingSummary.tsx (Always visible when data exists)
            ├── BookingActions.tsx (Book/Hold/Contact cards)
            └── BookingForms.tsx (Dynamic based on selected action)
                ├── BookingForm (Payment via Stripe)
                ├── HoldForm (Temporary reservation)
                └── ContactForm (Inquiry to host)
```

### State Management
```typescript
interface BookingState {
  // Property Information
  property: Property;
  propertySlug: string;
  
  // Date Selection
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestCount: number;
  
  // API Data (Fetched once per session)
  unavailableDates: Date[];
  isLoadingUnavailable: boolean;
  unavailableError: string | null;
  
  // API Data (User-triggered)
  pricing: PricingData | null;
  isLoadingPricing: boolean;
  pricingError: string | null;
  
  // UI State
  selectedAction: 'book' | 'hold' | 'contact' | null;
  
  // Form Data
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message?: string;
  };
}
```

### Data Flow Rules
1. **URL Parameters** → Parse once on mount → Update state → Persist to sessionStorage
2. **Unavailable Dates** → Fetch on mount → Store in state → Use for calendar display
3. **Pricing** → Fetch when user clicks "Check Price" → Store in state → Display in summary
4. **State Persistence** → Critical data saved to sessionStorage with property-specific keys
5. **No Circular Dependencies** → State changes never automatically trigger API calls

---

## 3. Business Logic & Rules ✅ **COMPLETE**

### 3.1 Pricing Logic
**Pre-Calculated Pricing System:**
- All prices are pre-calculated on the backend and stored in `priceCalendars` collection
- Price calendars are generated nightly and updated when pricing rules change
- Each calendar contains prices for every possible guest count for each day
- Frontend consumes these prices via API - no local calculations

**Backend Pricing Rules (for reference only - frontend doesn't implement these):**
- Base rates with weekend adjustments
- Seasonal pricing multipliers (minimum, low, standard, medium, high)
- Guest-based pricing (base occupancy + extra guest fees)
- Length-of-stay discounts
- Date-specific overrides (highest priority)
- Cleaning fees (fixed per booking)

**Frontend Pricing Consumption:**
- Calls `/api/check-pricing` with property, dates, and guest count
- Receives pre-calculated total from backend
- No local price calculations or formulas
- Guest count changes trigger new API calls for updated pricing

**Price Calendar Structure (stored in Firestore):**
```
{
  id: "{propertySlug}_{YYYY-MM}",
  days: {
    "1": {
      basePrice: 180,
      adjustedPrice: 180,
      prices: { "2": 180, "3": 205, "4": 230 }, // Pre-calculated per guest count
      available: true,
      minimumStay: 1
    }
  }
}
```

### 3.2 Availability Rules
**Unavailable Dates Sources:**
- Existing bookings (stored in availability collection)
- Active holds (temporary reservations)
- Date overrides with `available: false`
- Past dates (before today)

**Data Structure:**
- Availability stored monthly: `{propertySlug}_{YYYY-MM}`
- `available` map: day number → boolean
- `holds` map: day number → hold ID
- Dates unavailable if `available[day] === false` OR `holds[day]` exists

**Advance Booking:**
- No explicit maximum advance booking limit
- Availability data fetched for 12 months by default
- Can be extended via `months` parameter

**Back-to-back Bookings:**
- Check-in dates show actual unavailable dates
- Check-out dates show unavailable dates shifted +1 day
- Enables same-day checkout/check-in transitions

**Example Scenario:**
- Existing booking: Guest A has Dec 20-23 (checks out Dec 23)
- New booking: Guest B wants Dec 23-25 (checks in Dec 23)
- Dec 23 is both a checkout day AND a checkin day

**Calendar UI Behavior:**

1. **When selecting CHECK-IN date:**
   ```
   December 2024
   Mo Tu We Th Fr Sa Su
   18 19 20 21 22 23 24
   ✓  ✓  ❌  ❌  ❌  ✓  ✓
   ```
   - Dec 20-22: Strikethrough (unavailable - Guest A is there)
   - Dec 23: Available (Guest B can check in after Guest A checks out)
   - Logic: Shows raw unavailable dates from API

2. **When selecting CHECK-OUT date (after check-in selected):**
   ```
   December 2024 (if check-in is Dec 23)
   Mo Tu We Th Fr Sa Su
   18 19 20 21 22 23 24 25 26
   -  -  -  -  -  ✓  ❌  ✓  ✓
   ```
   - Dec 23: Selected check-in (highlighted)
   - Dec 24: Strikethrough (can't checkout same day as checkin)
   - Dec 25+: Available for checkout
   - Logic: Shifts unavailable dates +1 day AND blocks same-day checkout

**Implementation Notes:**
- Calendar component receives `unavailableDates` array
- For check-in selection: Display dates as-is
- For check-out selection: Transform dates by adding 1 day
- Minimum 1-night stay enforced (no same-day checkin/checkout)

### 3.3 Guest Validation
**Guest Limits (Required Fields):**
- `baseOccupancy`: Number of guests included in base price (required from API)
- `maxGuests`: Maximum allowed guests (required from API)
- **NO FALLBACKS**: Both fields MUST be provided by the API

**Error Handling:**
- If `baseOccupancy` is missing: Log error and show "Property configuration error"
- If `maxGuests` is missing: Log error and show "Property configuration error"
- Frontend must not assume defaults or provide fallback values

**Logging Requirements:**
```typescript
// When property data is received
if (!property.baseOccupancy) {
  logger.error('Missing required field: baseOccupancy', {
    propertyId: property.id,
    propertySlug: property.slug,
    namespace: 'booking:validation'
  });
}

if (!property.maxGuests) {
  logger.error('Missing required field: maxGuests', {
    propertyId: property.id,
    propertySlug: property.slug,
    namespace: 'booking:validation'
  });
}

**Pricing by Guest Count:**
- Frontend sends guest count to API
- Backend returns pre-calculated price for that guest count
- All guest-based calculations already done on backend

**Validation Rules:**
- Guest count must be ≥ 1
- Guest count must be ≤ maxGuests (required field from API)
- Properties without valid guest limits cannot be booked
- No specific age restrictions implemented

### 3.4 Date Validation Rules
**Two-Level Minimum Stay Architecture:**

**Level 1: Property-Level (Frontend Calendar Validation):**
- `property.defaultMinimumStay` - Required field, used for calendar date selection
- Prevents invalid date combinations before user submits
- Default value: 2 nights (configurable per property)
- **NO FALLBACKS** - Property must have this field

**Level 2: Date-Specific (Backend Pricing Validation):**
- Each date in price calendars has its own `minimumStay` value
- Priority order: Date override → Seasonal → Rules → Property default
- Only check-in date's minimum stay is checked
- Used for special events (e.g., "Christmas requires 7 nights")

**V2 UX Solution - Two-Level Minimum Stay:**

1. **Property-Level General Minimum Stay:**
   - Display prominently on booking page (e.g., "2 nights minimum")  
   - Used for calendar-level validation to prevent invalid selections
   - Field: `property.defaultMinimumStay` (required, no fallback)
   - Default value: 2 nights (configurable per property)

2. **Date-Specific Minimum Stay (Special Events):**
   - Handled via `/api/check-pricing` when validation fails
   - Returns specific requirements (e.g., "Christmas requires 7 nights")
   - UI provides helpful date suggestions for compliance

**Calendar Implementation:**
- Enforce property-level minimum stay in date selection
- Add to existing unavailable dates (don't replace them)
- Clear checkout if check-in change violates minimum stay
- Theme-aware visual feedback for date ranges

**Validation: `numberOfNights >= minimumStay`**
- Checked only when pricing is requested
- Uses check-in date's minimum stay value
- Logs error if validation fails

**Date Range Validation:**
- Check-out must be after check-in
- Both dates must be in the future
- Consecutive dates must all be available (no gaps)

**Business Rules:**
- No maximum stay limit implemented
- No specific check-in/check-out day restrictions
- Minimum advance booking: Same day allowed

---

## 4. User Workflows ✅ **COMPLETE**

### 4.1 Book Now Workflow (Implemented)
**Guest Information Required:**
- firstName: string (required)
- lastName: string (required)  
- email: string (required)
- phone: string (required)
- message: string (optional)

**Stripe Integration Process:**
1. User submits form → `createPendingBookingAction`
2. Creates pending booking in Firestore
3. Creates Stripe checkout session → `createCheckoutSession`
4. Redirects to Stripe hosted checkout page
5. User completes payment on Stripe
6. Stripe webhook confirms payment → `/api/webhooks/stripe/route.ts`
7. Updates booking status to "confirmed"
8. Sends confirmation email

**Post-Payment:**
- Booking marked as confirmed in Firestore
- Availability dates updated to unavailable
- Confirmation email sent to guest
- Redirect to booking success page

### 4.2 Hold Booking Workflow (Implemented)
**Hold Details:**
- Default duration: 15 minutes (configurable)
- Payment required: Hold fee via Stripe
- Hold marked as paid after Stripe webhook confirmation

**Hold Process:**
1. User submits hold request → `createHoldBookingAction`
2. Creates on-hold booking in Firestore with expiration
3. Creates Stripe checkout for hold fee → `createHoldCheckoutSession`
4. Payment confirms hold
5. User can convert to full booking within hold period

**Hold Expiration:**
- Automatic cleanup via background job (needs implementation)
- Dates become available again after expiration

### 4.3 Contact Host Workflow (Implemented)
**Required Information:**
- firstName: string (required)
- lastName: string (required)
- email: string (required)
- phone: string (optional)
- message: string (required)
- checkIn/checkOut: optional (for context)

**Inquiry Process:**
1. User submits inquiry → `createInquiryAction`
2. Creates inquiry document in Firestore
3. Email notification sent to property owner
4. No payment required

**Response Handling:**
- Inquiries stored in admin dashboard
- Property owners respond via email or admin interface
- No real-time messaging system implemented

### 4.4 Error Recovery Workflows
**Race Condition Handling:**
- Availability checked during booking submission
- Transaction-based booking creation prevents double bookings
- Clear error messages if dates become unavailable

**Payment Failure Recovery:**
- Stripe handles payment failures with retry options
- Pending bookings remain in system for retry
- Session timeout allows restart of booking process

**Session Management:**
- Critical booking data persisted in sessionStorage
- Booking flow can be resumed after page refresh
- URL parameters preserved for deep linking

---

## 5. API Specifications ✅ **COMPLETE**

### 5.1 Check Availability Endpoint
```typescript
GET /api/check-availability?propertySlug=string&months=number
POST /api/check-availability (also supported)

Request Parameters:
- propertySlug: string (required)
- months: number (optional, default 12)

Success Response (200): {
  unavailableDates: string[]; // ISO date strings (UTC)
  meta: {
    propertySlug: string;
    months: number;
    docsProcessed: number; // Number of Firestore docs processed
    dateCount: number; // Number of unavailable dates found
    version: string; // API version identifier
  };
}

Error Response (400): {
  error: string; // e.g., "Missing required parameter: propertySlug"
}

Error Response (500): {
  error: string;
  errorDetails?: string; // Technical error details
  errorType?: string; // e.g., "db_not_initialized"
  unavailableDates: []; // Always empty array on errors
  errorOccurred: true;
}

Implementation Details:
- Fetches from Firestore availability collection
- Processes monthly documents: {propertySlug}_{YYYY-MM}
- Returns dates where available[day] === false OR holds[day] exists
- Filters out past dates (before today) automatically
- Returns sorted ISO date strings for consistency
- POST method internally converts body to query params and calls GET
- Always returns unavailableDates array (empty on errors) to prevent client issues
- Handles Firestore 30-document query limit with batching
```

### 5.2 Check Pricing Endpoint
```typescript
POST /api/check-pricing

Request: {
  propertyId: string; // Note: called propertyId, not propertySlug
  checkIn: string; // YYYY-MM-DD format
  checkOut: string; // YYYY-MM-DD format
  guests: number;
}

Success Response: {
  available: true;
  pricing: {
    numberOfNights: number;
    accommodationTotal: number;
    cleaningFee: number;
    subtotal: number;
    lengthOfStayDiscount?: {
      appliedTier: number;
      discountPercentage: number;
      discountAmount: number;
    };
    couponDiscount?: {
      discountPercentage: number;
      discountAmount: number;
    };
    totalDiscountAmount: number;
    totalPrice: number; // Primary field (V2 standard)
    total: number; // Deprecated: Same value as totalPrice, kept for backward compatibility
    currency: string;
    dailyRates: Record<string, number>; // "YYYY-MM-DD" → price
  };
}

Unavailable Response: {
  available: false;
  reason: "unavailable_dates" | "minimum_stay";
  unavailableDates?: string[]; // If reason is unavailable_dates
  minimumStay?: number; // If reason is minimum_stay
  requiredNights?: number; // Deprecated: Same as minimumStay, kept for compatibility
}

Error Response (4xx/5xx status codes): {
  error: string; // Human-readable error message
  errorType?: string; // Optional: Error category (e.g., 'validation_error')
  errorDetails?: any; // Optional: Additional error context
}

Note: Unavailable dates/minimum stay are not errors - they return 200 OK with available: false

Implementation Details:
- Validates date range (checkOut > checkIn)
- Fetches pre-calculated price calendars from Firestore
- Looks up prices for specified guest count from calendar
- Sums daily rates for the date range
- Applies any stored length-of-stay discounts
- Returns both 'total' and 'totalPrice' for compatibility
- All complex pricing logic already applied during calendar generation

Note: V2 Frontend Standardization:
- V2 components should exclusively use 'totalPrice' field
- 'total' field is deprecated but maintained for backward compatibility
- Plan to remove 'total' field after full V2 migration is complete
- For minimum stay errors, use 'minimumStay' field (not 'requiredNights')
```

### 5.3 Booking Action Endpoints
```typescript
// Book Now - Creates immediate booking with payment
POST /api/bookings/create
Request: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message?: string;
  };
  // Payment handled via Stripe
}

// Hold Booking - Temporary reservation
POST /api/bookings/hold  
Request: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guestInfo: GuestInfo;
  holdDuration?: number; // Hours, default from property config
}

// Contact Host - Inquiry submission
POST /api/inquiries/create
Request: {
  propertyId: string;
  checkIn?: string; // Optional
  checkOut?: string; // Optional
  guests?: number; // Optional
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    message: string; // Required for inquiries
  };
}

Note: Specific booking endpoints need to be implemented
```

---

## 6. Component Specifications

### 6.1 BookingProvider
**Responsibilities:**
- Manage all booking state
- Handle all API calls
- Provide state to child components
- Persist critical data to sessionStorage
- Parse URL parameters on mount (including currency/language)
- Coordinate with existing currency/language contexts

**Complete State Interface:**
```typescript
interface BookingState {
  // Property & Basic Info
  property: Property;
  propertySlug: string;
  
  // Date Selection State
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestCount: number;
  
  // API Data State
  unavailableDates: Date[];
  isLoadingUnavailable: boolean;
  unavailableError: string | null;
  
  pricing: PricingResponse | null;
  isLoadingPricing: boolean;
  pricingError: string | null;
  
  // UI State
  selectedAction: 'book' | 'hold' | 'contact' | null;
  showMinStayWarning: boolean;
  
  // Form State
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    message?: string;
  };
}

interface BookingActions {
  // Date Management
  setCheckInDate: (date: Date | null) => void;
  setCheckOutDate: (date: Date | null) => void;
  setGuestCount: (count: number) => void;
  
  // API Calls
  fetchUnavailableDates: () => Promise<void>;
  fetchPricing: () => Promise<void>;
  
  // UI Actions
  setSelectedAction: (action: 'book' | 'hold' | 'contact' | null) => void;
  clearPricingError: () => void;
  dismissMinStayWarning: () => void;
  
  // Form Management
  updateGuestInfo: (info: Partial<GuestInfo>) => void;
  resetBookingState: () => void;
  
  // Legacy compatibility
  submitBooking: (type: BookingType) => Promise<BookingResult>;
}
```

**SessionStorage Strategy:**
```typescript
// Storage Keys (Property-Specific)
const STORAGE_KEYS = {
  checkInDate: `booking_${propertySlug}_checkIn`,
  checkOutDate: `booking_${propertySlug}_checkOut`,
  guestCount: `booking_${propertySlug}_guests`,
  selectedAction: `booking_${propertySlug}_action`,
  guestInfo: `booking_${propertySlug}_guestInfo`,
};

// What Gets Persisted vs Memory-Only
PERSISTED: checkInDate, checkOutDate, guestCount, selectedAction, guestInfo
MEMORY_ONLY: unavailableDates, pricing, loading states, errors

// When Storage is Cleared
- Property change (different slug)
- Successful booking completion  
- Explicit user action (reset button)
- NOT cleared on page refresh or navigation
```

**URL Parameter Handling:**
```typescript
// Supported URL Parameters
interface URLParams {
  checkIn?: string;    // Format: YYYY-MM-DD
  checkOut?: string;   // Format: YYYY-MM-DD  
  guests?: string;     // Format: number as string
  currency?: string;   // Format: CurrencyCode (USD, EUR, RON)
  language?: string;   // Format: LanguageCode (en, ro)
}

// Sync Behavior
- URL → State: On component mount only
- State → URL: Never (no URL updates)
- Invalid formats: Ignore parameter, log warning
- Missing dates: Use stored values or null

// Currency Resolution Priority
1. URL parameter (?currency=USD)
2. User context/session (from homepage visit)
3. Property default (property.baseCurrency from Firestore)

// Language Resolution Priority  
1. URL parameter (?language=en)
2. User context/session (from homepage visit)
3. Browser default (navigator.language)
```

### 6.2 DateAndGuestSelector
**Responsibilities:**
- Display calendar with unavailable dates marked
- Allow date range selection with back-to-back booking support
- Provide guest count picker
- Display "Check Price" button (always visible, state-dependent activation)
- Validate date ranges and minimum stay

**Check Price Button States (✅ Currently Working):**
- **Inactive state**: Disabled, muted theme colors when dates not selected
- **Active state**: Enabled, prominent theme colors when valid dates selected
- **Loading state**: Spinner + "Checking..." text during API call

**V2 Enhancement**: Add property-level minimum stay validation to calendar

**Component Integration:**
```typescript
// Props from BookingProvider
interface DateAndGuestSelectorProps {
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestCount: number;
  unavailableDates: Date[];
  isLoadingPricing: boolean;
  pricingError: string | null;
  property: Property; // For defaultMinimumStay
}

// Events to BookingProvider
interface DateSelectorEvents {
  onCheckInChange: (date: Date | null) => void;
  onCheckOutChange: (date: Date | null) => void;
  onGuestCountChange: (count: number) => void;
  onCheckPrice: () => void; // Triggers fetchPricing()
}
```

**Calendar Display Logic:**
```typescript
// For check-in calendar
const checkInDisabledDates = [
  ...unavailableDates, // Original unavailable dates (bookings, holds, etc.)
  ...getPastDates()    // Past dates
];

// For check-out calendar (after check-in selected)
const checkOutDisabledDates = [
  ...unavailableDates.map(date => addDays(date, 1)), // Back-to-back booking logic
  ...getDatesBeforeCheckIn(checkInDate),              // All dates before check-in
  ...getDatesBetween(checkInDate, minCheckoutDate),   // Property minimum stay enforcement
  checkInDate                                         // Can't checkout on check-in day
];

// Minimum stay validation
const minCheckoutDate = addDays(checkInDate, property.defaultMinimumStay);

// Minimum Stay Validation Logic
function getCheckOutDisabledDates(
  checkInDate: Date,
  unavailableDates: Date[],
  defaultMinimumStay: number
): Date[] {
  return [
    ...unavailableDates.map(date => addDays(date, 1)), // Back-to-back booking logic
    ...getDatesBeforeCheckIn(checkInDate),              // All dates before check-in
    ...getDatesBetween(checkInDate, addDays(checkInDate, defaultMinimumStay)), // Min stay enforcement
    checkInDate // Same day checkout prevention
  ];
}

// Handle check-in changes with minimum stay validation
const handleCheckInChange = (newCheckIn: Date | null) => {
  if (newCheckIn && checkOutDate) {
    const nightsBetween = getDaysBetween(newCheckIn, checkOutDate);
    if (nightsBetween < property.defaultMinimumStay) {
      setCheckOutDate(null); // Clear checkout
      setShowMinStayWarning(true);
      // Will show: "Please select checkout date (minimum {X} nights)"
    }
  }
  setCheckInDate(newCheckIn);
};
```

**Visual States (Theme-Aware):**
- Available dates: Normal appearance, clickable
- Unavailable dates: Strikethrough, not clickable
- Selected check-in: Highlighted with `var(--theme-primary)`
- Selected check-out: Highlighted with `var(--theme-primary)`
- Valid date range: `var(--theme-primary-light)` background between dates
- Invalid date range: `var(--theme-error-light)` background (brief flash before clearing)
- Past dates: Grayed out, not clickable

**Minimum Stay UX Flow:**
1. User selects check-in → Calendar disables invalid checkout dates
2. User selects valid checkout → Green/blue range highlighting (theme-dependent)
3. User changes check-in that violates minimum stay → Brief red flash → Checkout clears → Warning message
4. User must reselect valid checkout date

### 6.3 PricingSummary
**Responsibilities:**
- Display pricing breakdown when available
- Show loading state during price checks
- Support collapsible view on mobile
- Display in user's selected currency

### 6.4 BookingActions ✅ **PRESERVE AS-IS**
**Current Implementation (Working - Do Not Rebuild):**
- Shows three action cards: Book Now, Hold, Contact
- Enables only when pricing is available
- Handles action selection correctly
- Displays appropriate messaging per action
- **V2 Integration**: Use existing component with clean state from BookingProvider

### 6.5 BookingForms ✅ **PRESERVE AS-IS** 
**Current Implementation (Working - Do Not Rebuild):**
- Renders appropriate form based on selected action
- Collects and validates guest information properly
- Handles form submission with Stripe integration
- Shows success/error states correctly
- **V2 Integration**: Connect to simplified BookingProvider state

### 6.6 Error Handling Strategy
**Error Types & User Messages:**
```typescript
interface BookingErrors {
  // API Errors
  UNAVAILABLE_FETCH_FAILED: "Unable to load availability. Please try again.";
  PRICING_FETCH_FAILED: "Unable to calculate pricing. Please try again.";
  NETWORK_ERROR: "Connection error. Please check your internet.";
  
  // Validation Errors  
  INVALID_DATE_RANGE: "Please select valid check-in and check-out dates.";
  MIN_STAY_VIOLATION: "Minimum {X} nights required from this date.";
  GUEST_COUNT_INVALID: "Please select between 1 and {maxGuests} guests.";
  
  // Required Field Errors (No Fallbacks)
  MISSING_BASE_OCCUPANCY: "Property configuration error. Please contact support.";
  MISSING_MAX_GUESTS: "Property configuration error. Please contact support.";
  MISSING_DEFAULT_MIN_STAY: "Property configuration error. Please contact support.";
}
```

**Error Recovery Patterns:**
```typescript
// Retry Logic
- Auto-retry: None (user must manually retry)
- Retry button: Show for API failures after 2 seconds
- Error persistence: Clear on successful operation
- Fallback: Graceful degradation (disable features vs crash)

// Logging Requirements (Following V2 Strategy)
logger.error('Failed to fetch pricing from API', error, {
  propertyId: property.id,
  propertySlug: property.slug,
  dates: { checkIn, checkOut },
  guestCount,
  namespace: 'booking:api'
});

// Missing Required Fields
if (!property.baseOccupancy) {
  logger.error('Missing required field: baseOccupancy', {
    propertyId: property.id,
    propertySlug: property.slug,
    namespace: 'booking:validation'
  });
  // Show error message, disable booking functionality
}
```

---

## 7. Multi-Context Support ✅ **COMPLETE**

### 7.1 Multi-Language Support (Implemented)
**Supported Languages:**
- English (en) - Default
- Romanian (ro)

**Language Routing:**
- URL-based: `/properties/slug/en/booking` or `/properties/slug/ro/booking`
- Custom domains: `domain.com/en/booking` or `domain.com/ro/booking`
- Middleware handles language detection and routing

**Translation System:**
- `t()` function for UI translations (key-based lookup)
- `tc()` function for content translations (multilingual objects)
- Translation files in `/public/locales/[lang].json`
- SSR-compatible with lazy loading

**Fallback Strategy:**
1. User-selected language (stored in localStorage)
2. URL language parameter
3. Browser Accept-Language header
4. Default to English

**Missing Translation Handling:**
- Falls back to key name if translation missing
- Console warnings in development mode
- Graceful degradation to English

### 7.2 Multi-Currency Support (Implemented)
**Supported Currencies:**
- USD 🇺🇸 (US Dollar)
- EUR 🇪🇺 (Euro) 
- RON 🇷🇴 (Romanian Leu)

**Exchange Rate Management:**
- Rates stored in Firestore at `appConfig/currencyRates`
- Real-time conversion via `convertToSelectedCurrency()`
- Fallback rates embedded for offline support
- Property base currency validation

**Currency Features:**
- User preference stored in sessionStorage
- URL parameter override support (`?currency=USD`)
- Price formatting with proper symbols and locale
- Precision handling for different currencies

**Implementation:**
- CurrencyContext provides global currency state
- `useCurrency()` hook for components
- Theme-aware currency switcher UI

### 7.3 Custom Domain Architecture (Implemented)
**Domain Configuration:**
- Property documents have `customDomain` field
- DNS points custom domain to main application
- Middleware resolves domain → property slug mapping

**Routing Process:**
1. Request: `custom-domain.com/booking/check`
2. Middleware looks up property by customDomain
3. Internal rewrite to `/properties/[slug]/booking/check`
4. Property-specific rendering with custom domain context

**SSL & Security:**
- Automatic SSL via hosting platform
- CORS configuration for custom domains
- Same security model as main domain

### 7.4 Theme System (Implemented)
**Available Themes:**
- `forest` - Green nature theme
- `ocean` - Blue water theme  
- `luxury` - Dark elegant theme
- `modern` - Clean minimal theme
- `airbnb` - Airbnb-style theme

**Theme Assignment:**
- Properties have `themeId` field
- Template-level theme inheritance
- Override via URL parameter (`?theme=ocean`)

**Theme Implementation:**
- CSS custom properties for dynamic theming
- Theme-aware component styling
- Consistent color palette across themes
- Theme loading screen prevents flash

**Usage:**
- ThemeProvider manages global theme state
- `useTheme()` hook for components
- Theme-specific image assets
- Email template theming (planned)

---

## 8. Error Handling & Edge Cases ✅ **COMPLETE**

### 8.1 Network & API Errors

**API Timeout Handling:**
- Default timeout: 10 seconds for all API calls
- Timeout errors show user-friendly message: "Request timed out. Please try again."
- Manual retry button provided (no auto-retry)
- Loading states prevent multiple simultaneous requests

**Retry Logic Strategy:**
```typescript
// Manual retry only - no automatic retries
const handleRetry = async () => {
  setError(null);
  setIsLoading(true);
  try {
    await fetchFunction();
  } catch (error) {
    logger.error('Retry failed', error, { namespace: 'booking:retry' });
    setError('Still unable to connect. Please check your internet connection.');
  }
};

// Retry button appears after 2 seconds of error display
const showRetryButton = errorDisplayTime > 2000;
```

**Rate Limiting Response:**
- HTTP 429 responses handled gracefully
- Show message: "Too many requests. Please wait a moment and try again."
- Exponential backoff for retry attempts (if user retries manually)
- Log rate limit incidents for monitoring

**Server Maintenance Handling:**
- HTTP 503 responses detected
- Show maintenance message: "System temporarily unavailable for maintenance."
- Hide retry options during maintenance windows
- Graceful degradation: disable booking, show contact information

**Partial API Failures:**
- Availability API failure: Show "Unable to load calendar" + contact form only
- Pricing API failure: Show "Unable to calculate pricing" + contact form
- Both APIs working: Full booking functionality
- Never crash the entire page - always provide fallback options

### 8.2 Data Validation Errors

**Client-Side Validation Rules:**
```typescript
interface ValidationRules {
  // Date Validation
  checkInDate: {
    required: true;
    futureDate: true;
    availableDate: true;
  };
  checkOutDate: {
    required: true;
    afterCheckIn: true;
    minimumStay: property.defaultMinimumStay;
  };
  
  // Guest Validation
  guestCount: {
    min: 1;
    max: property.maxGuests;
    integer: true;
  };
  
  // Guest Info Validation
  firstName: { required: true; minLength: 1; maxLength: 50; };
  lastName: { required: true; minLength: 1; maxLength: 50; };
  email: { required: true; emailFormat: true; maxLength: 100; };
  phone: { required: true; minLength: 10; maxLength: 20; };
  message: { maxLength: 1000; }; // Optional field
}
```

**Server-Side Validation Failure Handling:**
- Parse validation errors from API responses
- Map server errors to specific form fields
- Display field-specific error messages
- Prevent form submission until all errors resolved
- Log validation failures for debugging

**User Error Messages:**
```typescript
const ERROR_MESSAGES = {
  // Date Errors
  INVALID_CHECK_IN: "Please select a valid check-in date.",
  INVALID_CHECK_OUT: "Please select a valid check-out date.",
  DATES_UNAVAILABLE: "Selected dates are not available. Please choose different dates.",
  MINIMUM_STAY_VIOLATION: "Minimum {X} nights required from this date.",
  
  // Guest Errors
  INVALID_GUEST_COUNT: "Please select between 1 and {maxGuests} guests.",
  
  // Contact Info Errors
  REQUIRED_FIELD: "This field is required.",
  INVALID_EMAIL: "Please enter a valid email address.",
  INVALID_PHONE: "Please enter a valid phone number.",
  
  // System Errors
  NETWORK_ERROR: "Unable to connect. Please check your internet connection.",
  SERVER_ERROR: "Something went wrong. Please try again.",
  MAINTENANCE_MODE: "System temporarily unavailable for maintenance."
};
```

**Form Submission Prevention:**
- Disable submit buttons when validation fails
- Show validation summary for multiple errors
- Use HTML5 validation attributes for basic checks
- JavaScript validation for complex business rules

**Accessibility Requirements:**
- Error messages use `aria-describedby` attributes
- Focus management on first error field
- Screen reader announcements for dynamic errors
- High contrast error styling (red text + icons)
- Keyboard navigation preserved during error states

### 8.3 Race Conditions

**Dates Becoming Unavailable During Booking:**
```typescript
// Double-check availability before payment
const handleBookingSubmission = async (formData) => {
  // 1. Revalidate availability immediately before payment
  const availabilityCheck = await checkAvailability({
    propertyId,
    checkIn: formData.checkIn,
    checkOut: formData.checkOut
  });
  
  if (!availabilityCheck.available) {
    showError("These dates are no longer available. Please select new dates.");
    return; // Stop booking process
  }
  
  // 2. Proceed with payment if still available
  await createStripeCheckoutSession(formData);
};
```

**Concurrent Booking Prevention:**
- Firestore transaction-based booking creation
- Optimistic locking on availability documents
- Double-check availability in webhook processing
- Handle "already booked" errors gracefully

**Payment Processing Edge Cases:**
```typescript
// Handle Stripe webhook delays
const handlePaymentSuccess = async (sessionId) => {
  try {
    // Update booking status atomically
    await db.runTransaction(async (transaction) => {
      const bookingRef = db.collection('bookings').doc(bookingId);
      const booking = await transaction.get(bookingRef);
      
      if (booking.data()?.status === 'pending') {
        // Confirm booking and mark dates unavailable
        transaction.update(bookingRef, { status: 'confirmed', paidAt: new Date() });
        
        // Update availability
        const availabilityRef = db.collection('availability').doc(`${propertySlug}_${month}`);
        transaction.update(availabilityRef, {
          [`available.${day}`]: false
        });
      }
    });
  } catch (error) {
    logger.error('Payment confirmation failed', error, {
      sessionId,
      bookingId,
      namespace: 'booking:payment'
    });
    // Webhook will retry automatically
  }
};
```

**Inventory Change Handling:**
- Real-time availability updates not implemented (polling not needed)
- Manual refresh button for users who suspect changes
- Clear cache and refetch on user request
- Show timestamp of last availability check

### 8.4 Session Management

**Session Persistence Strategy:**
```typescript
const SESSION_CONFIG = {
  // SessionStorage Lifetime
  duration: 'browser_session', // Until browser/tab closes
  
  // What Gets Persisted
  persistent_data: [
    'checkInDate',
    'checkOutDate', 
    'guestCount',
    'selectedAction',
    'guestInfo' // Form data
  ],
  
  // What Stays in Memory Only
  memory_only: [
    'unavailableDates', // Refetch on reload
    'pricing',          // Refetch on reload
    'loading_states',   // Reset on reload
    'error_messages'    // Reset on reload
  ]
};
```

**Session Timeout Handling:**
- No explicit session timeout (browser-managed)
- Data persists until tab/browser closes
- Fresh API calls on page reload (data may be stale)
- No server-side session management needed

**Browser Refresh Behavior:**
```typescript
const handlePageLoad = () => {
  // 1. Restore form data from sessionStorage
  const savedState = restoreSessionData(propertySlug);
  
  // 2. Refetch fresh data (never trust cached API responses)
  fetchUnavailableDates(); // Always refetch
  
  // 3. Re-validate pricing if dates exist
  if (savedState.checkInDate && savedState.checkOutDate) {
    // Don't auto-fetch pricing - let user click "Check Price" again
    showMessage("Please check pricing again to ensure current rates.");
  }
};
```

**Multiple Tab Handling:**
- Each tab has independent sessionStorage
- No cross-tab synchronization implemented
- Each tab can complete booking independently
- Race condition handled by Firestore transactions
- User warned if booking fails due to concurrent attempt

**Data Loss Prevention:**
```typescript
// Save form data on every change
const handleFormFieldChange = (field: string, value: any) => {
  updateGuestInfo({ [field]: value });
  
  // Persist immediately to sessionStorage
  sessionStorage.setItem(
    `booking_${propertySlug}_guestInfo`,
    JSON.stringify(guestInfo)
  );
};

// Warn before navigation if form has data
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (hasUnsavedFormData()) {
    event.preventDefault();
    return "You have unsaved booking information. Are you sure you want to leave?";
  }
};
```

**Error Recovery Patterns:**
- All user inputs preserved during errors
- Error states clear on successful operations
- Failed API calls don't clear form data
- Retry operations restore previous state
- Graceful degradation maintains core functionality

---

## 9. Integration Requirements ✅ **COMPLETE**

### 9.1 Payment Integration (Stripe) ✅ **FULLY IMPLEMENTED**

**Stripe Products Used:**
- **Stripe Checkout**: Session-based hosted payment pages
- **Payment Intents**: Payment tracking and status management
- **Coupons**: Dynamic percentage-based discount system
- **Webhooks**: Real-time payment event processing

**Payment Flow Architecture:**
```typescript
// Two Payment Types Supported
interface PaymentTypes {
  FULL_BOOKING: {
    action: 'createCheckoutSession';
    description: 'Complete booking with full payment';
    successUrl: '/booking/success';
    metadata: { bookingId, propertyId, dates, guests };
  };
  
  HOLD_BOOKING: {
    action: 'createHoldCheckoutSession';
    description: 'Hold reservation with deposit';
    amount: 'configurable_hold_fee';
    successUrl: '/booking/hold-success';
    metadata: { holdId, propertyId, expirationTime };
  };
}
```

**Payment Processing Flow:**
1. **Checkout Session Creation** → Server action creates Stripe session
2. **User Payment** → Stripe handles payment processing securely
3. **Webhook Notification** → `/api/webhooks/stripe` receives payment confirmation
4. **Status Updates** → Booking confirmed, availability blocked, emails sent
5. **External Sync** → Platform synchronization triggered (if configured)

**Supported Payment Methods:**
- All Stripe-supported payment methods (cards, digital wallets)
- Multi-currency support: USD, EUR, RON
- Automatic currency conversion based on user preference
- Real-time exchange rates with cached fallbacks

**Webhook Implementation:**
```typescript
// Webhook Events Handled
const SUPPORTED_EVENTS = [
  'checkout.session.completed',     // Primary payment confirmation
  'payment_intent.succeeded',       // Secondary confirmation
  'payment_intent.payment_failed'   // Error handling
];

// Security & Reliability
- Stripe signature verification
- Idempotent processing (safe retries)
- Comprehensive error logging
- Transaction-based database updates
```

**Refund Process:**
- Manual refunds through Stripe dashboard
- Booking status updates via admin interface
- Automatic availability restoration
- Email notifications to guests
- **Note**: Automated refund API not currently implemented

### 9.2 Email System ✅ **FULLY IMPLEMENTED**

**Email Service Provider:**
- **Development**: Ethereal (test email service with preview URLs)
- **Production**: Configurable SMTP (AWS SES, SendGrid, Mailgun)
- **Framework**: Nodemailer with flexible transporter configuration

**Email Template System:**
```typescript
interface EmailTemplates {
  // Guest Communications
  BOOKING_CONFIRMATION: {
    languages: ['en', 'ro'];
    personalizedData: [property, booking, guest, pricing];
    formats: ['html', 'text'];
  };
  
  HOLD_CONFIRMATION: {
    languages: ['en', 'ro'];
    includesConversionInstructions: true;
    expirationTimer: true;
  };
  
  INQUIRY_CONFIRMATION: {
    autoResponse: true;
    expectationSetting: true;
  };
  
  // Host Communications
  BOOKING_NOTIFICATION: {
    hostDetails: true;
    guestInformation: true;
    bookingSummary: true;
  };
  
  INQUIRY_NOTIFICATION: {
    guestMessage: true;
    responseInstructions: true;
  };
}
```

**Email Trigger Events:**
- Successful booking payment confirmation (via Stripe webhook)
- Hold booking creation and payment
- Guest inquiry submission
- Booking cancellation or modification
- Host responses to inquiries
- Automated reminder emails (check-in instructions)

**Personalization Features:**
- Guest name and contact information
- Property-specific details and images
- Booking dates, pricing breakdown, currency
- Custom host messages and property rules
- Multilingual content based on user language preference
- Property branding and theme colors

**Email Delivery Monitoring:**
- SMTP transport error handling
- Delivery failure logging and retry logic
- Email preview URLs in development
- Production email tracking (via provider)

**Accessibility & Compliance:**
- HTML and plain text versions
- Mobile-responsive email templates
- Unsubscribe mechanisms where required
- GDPR-compliant data handling

### 9.3 Analytics & Tracking ⚠️ **PARTIAL IMPLEMENTATION**

**Current Implementation Status:**
- **Schema Ready**: Property-level analytics configuration exists
- **Google Analytics**: Framework prepared but not active
- **Event Tracking**: Not implemented
- **Conversion Tracking**: Not implemented

**Available Configuration:**
```typescript
interface PropertyAnalytics {
  enabled: boolean;
  googleAnalyticsId?: string;
  // Additional providers can be added
}
```

**Required Implementation for V2:**
```typescript
// Essential Tracking Events
const BOOKING_EVENTS = {
  // Funnel Tracking
  'page_view': { page: 'booking_check', property: slug },
  'dates_selected': { checkIn, checkOut, nights },
  'guests_selected': { count, property_max },
  'pricing_viewed': { total, currency, nights },
  'booking_initiated': { type: 'book|hold|contact' },
  'payment_started': { amount, currency },
  'booking_completed': { id, total, property },
  
  // Error Tracking
  'availability_error': { property, dates },
  'pricing_error': { property, dates, guests },
  'payment_failed': { reason, amount },
  'form_validation_error': { field, error },
  
  // Performance Tracking
  'api_response_time': { endpoint, duration },
  'page_load_time': { page, duration }
};
```

**Privacy Considerations:**
- GDPR compliance for EU users
- Cookie consent management
- User opt-out mechanisms
- Data anonymization for analytics
- No personally identifiable information in tracking

**Recommended Analytics Providers:**
- **Google Analytics 4**: Standard web analytics
- **Stripe Analytics**: Payment funnel analysis
- **Property-specific**: Custom dashboard for hosts

### 9.4 SMS Notifications ⚠️ **FRAMEWORK ONLY**

**Current Status**: Service structure exists but requires provider integration

**Planned Implementation:**
- **Provider**: Twilio (package already installed)
- **Use Cases**: 
  - Booking confirmations
  - Check-in day instructions and house rules
  - Emergency contact notifications
  - Last-minute booking updates

**Required Setup:**
```typescript
// Environment Variables Needed
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=your_twilio_number

// Service Implementation Required
const client = twilio(accountSid, authToken);
await client.messages.create({
  body: messageContent,
  from: twilioPhoneNumber,
  to: guestPhoneNumber,
});
```

### 9.5 Property Management Systems (PMS) ⚠️ **FRAMEWORK ONLY**

**Current Status**: Comprehensive framework prepared but placeholder implementations

**Platform Integration Framework:**
```typescript
interface ChannelIntegrations {
  airbnb: {
    listingId?: string;
    apiIntegration: 'planned';
    features: ['availability_sync', 'price_sync', 'booking_import'];
  };
  
  booking_com: {
    propertyId?: string;
    xmlIntegration: 'planned';
    features: ['availability_sync', 'rate_sync'];
  };
  
  vrbo: {
    listingId?: string;
    apiIntegration: 'planned';
    features: ['calendar_sync', 'booking_notifications'];
  };
}
```

**Synchronization Requirements:**
```typescript
// Availability Synchronization
const syncAvailability = async (propertySlug: string, dates: Date[]) => {
  // Mark dates unavailable across all connected platforms
  await Promise.all([
    updateAirbnbListingAvailability(propertySlug, dates, false),
    updateBookingComListingAvailability(propertySlug, dates, false),
    updateVrboListingAvailability(propertySlug, dates, false)
  ]);
};

// Booking Import from External Platforms
const importExternalBooking = async (platformBooking: ExternalBooking) => {
  // 1. Validate booking data
  // 2. Create internal booking record
  // 3. Block availability in other platforms
  // 4. Send host notification
};
```

**Data Mapping Requirements:**
- Property ID mapping between platforms
- Date format standardization
- Price/currency conversion
- Guest information mapping
- Booking status synchronization

**Error Handling for External APIs:**
- Rate limiting and quota management
- API downtime graceful degradation
- Retry logic with exponential backoff
- Sync failure notifications to hosts
- Manual override capabilities

**Authentication Requirements:**
- OAuth 2.0 flow for platform authorization
- Secure token storage and refresh
- Platform-specific API credentials
- Multi-property authorization management

### 9.6 Additional System Integrations

**Currency Exchange Service ✅ IMPLEMENTED:**
- Real-time currency conversion
- Cached exchange rates in Firestore
- Fallback rates for offline scenarios
- Support for USD, EUR, RON

**Backup & Data Export ✅ IMPLEMENTED:**
- Firestore backup functionality
- Property data export capabilities
- Booking export for accounting
- Manual data recovery procedures

**Image & Asset Management ✅ IMPLEMENTED:**
- Hero image fetching and optimization
- Property gallery management
- Theme-specific asset loading
- CDN integration for performance

**Required Future Integrations:**
- **Customer Support**: Help desk or chat integration
- **Marketing Automation**: Guest communication workflows
- **Accounting Integration**: QuickBooks, Xero export
- **Insurance Integration**: Booking protection services
- **Cleaning Management**: Automated cleaner scheduling

---

## 10. Security & Validation ⚠️ **REQUIRES HARDENING**

### 10.1 Input Validation

**Current Implementation Status: 6/10 - Good Foundation, Needs Enhancement**

**Client-Side Validation ✅ IMPLEMENTED:**
```typescript
// Zod Schema Validation (Comprehensive)
interface ValidationSchemas {
  PriceCalendarSchema: {
    location: '/src/lib/pricing/pricing-schemas.ts';
    features: ['type_safety', 'runtime_validation', 'error_messages'];
  };
  
  BookingFormValidation: {
    implementation: 'react_hook_form';
    fields: ['dates', 'guests', 'contact_info'];
    realTimeValidation: true;
  };
  
  PropertyValidation: {
    adminForms: 'complete_zod_validation';
    requiredFields: ['baseOccupancy', 'maxGuests', 'defaultMinimumStay'];
    dataIntegrity: 'enforced';
  };
}
```

**Server-Side Validation ⚠️ PARTIAL:**
- **API Endpoints**: Basic validation in pricing/availability APIs
- **Missing**: Comprehensive validation middleware for all endpoints
- **Risk**: Client-side validation can be bypassed

**Input Sanitization ⚠️ BASIC IMPLEMENTATION:**
```typescript
// Current Sanitization (src/lib/sanitize.ts)
const BASIC_SANITIZATION = {
  stripHtmlTags: 'basic_regex_implementation',
  sanitizeEmail: 'email_format_validation',
  sanitizePhone: 'phone_number_cleaning',
  
  // SECURITY GAP: Not sufficient for production
  limitations: [
    'no_advanced_xss_protection',
    'no_sql_injection_prevention',
    'no_script_tag_detection'
  ]
};
```

**Required V2 Security Enhancements:**
```typescript
// Production-Ready Validation Pipeline
const SECURITY_PIPELINE = {
  step1: 'input_type_validation',        // Zod schemas
  step2: 'format_validation',            // Email, phone, date formats
  step3: 'business_rule_validation',     // Min stay, guest limits
  step4: 'xss_sanitization',             // DOMPurify integration
  step5: 'sql_injection_prevention',     // Parameterized queries
  step6: 'rate_limiting_check',          // Per-IP throttling
  step7: 'audit_logging'                 // Security event tracking
};
```

**File Upload Security (Not Currently Implemented):**
- **Status**: No file upload functionality
- **Future Requirements**: Virus scanning, type validation, size limits
- **Recommendation**: Implement when needed with strict security controls

### 10.2 XSS Prevention & Security Headers

**Current XSS Protection: 4/10 - Basic, Needs Enhancement**

**Existing Protection:**
- React JSX auto-escaping (built-in)
- Basic HTML tag stripping
- Sanitized state management hook (`useSanitizedState`)

**Critical Security Gaps:**
```typescript
const SECURITY_GAPS = {
  content_security_policy: 'not_implemented',
  xss_protection_headers: 'missing',
  content_type_options: 'missing',
  advanced_sanitization: 'insufficient',
  
  // High-risk areas
  user_generated_content: [
    'guest_messages',
    'inquiry_text',
    'property_descriptions'
  ]
};
```

**Required V2 Security Implementation:**
```typescript
// Comprehensive XSS Prevention
const XSS_PROTECTION = {
  // 1. Content Security Policy
  csp_headers: {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' stripe.com; style-src 'self' 'unsafe-inline'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  },
  
  // 2. Advanced Sanitization
  sanitization: {
    library: 'DOMPurify',
    server_side: 'sanitize-html',
    real_time: 'client_validation'
  },
  
  // 3. Output Encoding
  encoding: {
    html_entities: 'automatic',
    url_encoding: 'for_redirects',
    json_escaping: 'for_api_responses'
  }
};
```

### 10.3 Authentication & Authorization

**Current Implementation: 5/10 - Good Architecture, Critical Security Issue**

**Firebase Authentication Integration ✅ IMPLEMENTED:**
- Admin route protection via `AdminAuthCheck` component
- Session-based authentication with cookies
- Token verification through Firebase Admin SDK

**🚨 CRITICAL SECURITY VULNERABILITY:**
```typescript
// IMMEDIATE FIX REQUIRED (src/lib/auth-helpers.ts)
if (process.env.NODE_ENV === 'development') {
  return { authenticated: true, admin: true }; // BYPASSES ALL SECURITY
}
```

**Current Authorization Model:**
```typescript
interface AuthModel {
  guest_users: {
    registration_required: false;
    booking_capability: 'full_access';
    data_collection: 'minimal_required_only';
  };
  
  admin_users: {
    authentication: 'firebase_admin';
    access_control: 'role_based';
    protected_routes: ['/admin/*'];
  };
  
  property_owners: {
    implementation: 'pending';
    planned_features: ['property_management', 'booking_overview'];
  };
}
```

**Required V2 Security Hardening:**
```typescript
const AUTH_SECURITY_V2 = {
  // 1. Remove Development Bypass
  development_security: 'enforce_authentication_always',
  
  // 2. Session Management
  session_security: {
    csrf_protection: 'implement',
    session_timeout: '30_minutes',
    session_rotation: 'on_privilege_escalation',
    secure_cookies: 'https_only'
  },
  
  // 3. Access Control
  rbac_implementation: {
    roles: ['guest', 'admin', 'property_owner'],
    permissions: 'granular_resource_access',
    audit_trail: 'all_admin_actions'
  }
};
```

### 10.4 Data Privacy & GDPR Compliance

**Current Implementation: 2/10 - Minimal, Requires Complete Implementation**

**Current Privacy Measures:**
- Basic privacy policy links in footer
- Minimal data collection for bookings
- No explicit consent mechanisms

**🚨 GDPR Compliance Gaps:**
```typescript
const GDPR_GAPS = {
  cookie_consent: 'not_implemented',
  data_processing_agreements: 'missing',
  user_rights_implementation: {
    data_access: 'not_available',
    data_deletion: 'not_available',
    data_portability: 'not_available',
    rectification: 'not_available'
  },
  
  privacy_by_design: {
    data_minimization: 'partial',
    purpose_limitation: 'undefined',
    retention_periods: 'undefined'
  }
};
```

**Required GDPR Implementation for V2:**
```typescript
const GDPR_COMPLIANCE_V2 = {
  // 1. Consent Management
  cookie_consent: {
    banner: 'implement_cookie_banner',
    granular_controls: 'analytics_marketing_functional',
    consent_storage: 'user_preferences_database'
  },
  
  // 2. Data Subject Rights
  user_rights_api: {
    '/api/gdpr/export': 'user_data_export',
    '/api/gdpr/delete': 'account_deletion',
    '/api/gdpr/rectify': 'data_correction'
  },
  
  // 3. Data Processing
  data_handling: {
    collection_basis: 'legitimate_interest_contract',
    retention_booking_data: '7_years_tax_compliance',
    retention_marketing: '2_years_consent_based',
    anonymization: 'analytics_data_after_1_year'
  },
  
  // 4. Privacy Policy
  privacy_documentation: {
    what_data: 'clear_enumeration',
    why_collected: 'specific_purposes',
    third_parties: 'stripe_email_providers',
    user_rights: 'how_to_exercise',
    contact_info: 'data_protection_officer'
  }
};
```

### 10.5 Rate Limiting & DDoS Protection

**Current Implementation: 0/10 - Not Implemented**

**🚨 CRITICAL SECURITY GAP:**
- No rate limiting on any endpoints
- No protection against API abuse
- No DDoS mitigation
- No brute force protection

**Required V2 Implementation:**
```typescript
const RATE_LIMITING_V2 = {
  // 1. API Rate Limiting
  api_protection: {
    '/api/check-availability': '100_requests_per_hour_per_ip',
    '/api/check-pricing': '50_requests_per_hour_per_ip',
    '/api/webhooks/*': 'stripe_signature_validation_only',
    '/api/admin/*': '1000_requests_per_hour_per_authenticated_user'
  },
  
  // 2. Booking Protection
  booking_throttling: {
    booking_attempts: '5_per_property_per_day_per_ip',
    form_submissions: '10_per_hour_per_ip',
    failed_payments: '3_attempts_then_24h_cooldown'
  },
  
  // 3. Implementation Strategy
  middleware: {
    library: 'express_rate_limit',
    storage: 'redis_cluster',
    distributed: 'multi_server_sync',
    bypass: 'authenticated_admin_users'
  }
};
```

### 10.6 Audit Logging & Security Monitoring

**Current Implementation: 8/10 - Excellent Foundation**

**Comprehensive Logging System ✅ IMPLEMENTED:**
```typescript
// Advanced Logging (src/lib/logger.ts)
const LOGGING_FEATURES = {
  structured_logging: {
    namespaces: 'feature_based_categorization',
    metadata: 'contextual_information',
    performance_aware: 'zero_overhead_when_disabled'
  },
  
  security_features: {
    data_sanitization: 'prevents_sensitive_data_leakage',
    error_handling: 'safe_error_messages',
    audit_trail: 'user_actions_and_system_events'
  },
  
  configuration: {
    environment_based: 'dev_prod_separation',
    runtime_toggles: 'feature_flag_integration',
    external_services: 'sentry_integration_ready'
  }
};
```

**V2 Security Monitoring Enhancements:**
```typescript
const SECURITY_MONITORING_V2 = {
  // 1. Security Event Logging
  security_events: {
    authentication_failures: 'track_failed_login_attempts',
    authorization_violations: 'access_denied_events',
    input_validation_failures: 'malicious_input_attempts',
    rate_limit_violations: 'abuse_attempt_tracking'
  },
  
  // 2. Automated Alerting
  alerts: {
    multiple_failed_logins: 'potential_brute_force',
    unusual_booking_patterns: 'fraud_detection',
    api_abuse: 'rate_limit_violations',
    system_errors: 'availability_issues'
  },
  
  // 3. Compliance Logging
  compliance: {
    gdpr_requests: 'data_subject_right_requests',
    admin_actions: 'administrative_privilege_usage',
    data_access: 'who_accessed_what_when'
  }
};
```

### 10.7 Infrastructure Security

**Environment Security: 6/10 - Good Practices, Needs Hardening**

**Current Security Measures:**
- Environment-based configuration separation
- Secret management through environment variables
- Feature flags for production/development control

**Required V2 Security Hardening:**
```typescript
const INFRASTRUCTURE_SECURITY_V2 = {
  // 1. Secret Management
  secrets: {
    rotation: 'automated_key_rotation',
    storage: 'encrypted_environment_variables',
    access_control: 'principle_of_least_privilege'
  },
  
  // 2. Network Security
  network: {
    https_enforcement: 'strict_transport_security',
    certificate_management: 'automated_renewal',
    ip_whitelisting: 'admin_access_restrictions'
  },
  
  // 3. Database Security
  database: {
    firestore_rules: 'strict_read_write_permissions',
    backup_encryption: 'encrypted_backups',
    access_logging: 'database_query_auditing'
  }
};
```

### 10.8 Security Checklist for V2 Implementation

**🚨 Critical (Must Fix Before Production):**
- [ ] Remove development authentication bypass
- [ ] Implement rate limiting on all API endpoints
- [ ] Add comprehensive input validation to all endpoints
- [ ] Implement GDPR cookie consent system
- [ ] Add security headers (CSP, HSTS, etc.)

**⚠️ High Priority:**
- [ ] Enhanced XSS protection with DOMPurify
- [ ] CSRF protection for authenticated actions
- [ ] Data subject rights API implementation
- [ ] Security monitoring and alerting
- [ ] Session timeout and management

**📋 Medium Priority:**
- [ ] Privacy policy and terms of service pages
- [ ] Advanced audit logging
- [ ] Automated security testing
- [ ] Penetration testing before launch

**Current Security Maturity Score: 4.3/10**
**V2 Target Score: 9.0/10**

This security assessment reveals a system with excellent architectural foundations but critical gaps that must be addressed before production deployment. The logging system is exceptional, and the validation framework is solid, but authentication bypass, rate limiting, and GDPR compliance require immediate attention.

---

## 11. Performance Requirements

### 11.1 Loading Performance
- Initial page render: <500ms
- Unavailable dates API: <300ms
- Pricing API: <500ms
- Booking submission: <2s
- Zero Cumulative Layout Shift (CLS = 0)

### 11.2 Runtime Performance
- Smooth 60fps animations
- <100ms response to user interactions
- Efficient calendar rendering for large date ranges
- Optimized bundle size (<500KB gzipped)

### 11.3 Scalability Requirements
- Support 1000+ concurrent users
- Handle 10,000+ properties
- 99.9% uptime SLA
- Auto-scaling based on traffic

---

## 12. Testing Strategy

### 12.1 Unit Testing
- All components tested in isolation
- State management logic coverage
- Utility function validation
- Error boundary testing

### 12.2 Integration Testing  
- API endpoint functionality
- Payment flow testing
- Email delivery verification
- Database integration testing

### 12.3 End-to-End Testing
- Complete booking flows
- Multi-language functionality
- Cross-browser compatibility
- Mobile device testing

### 12.4 Performance Testing
- Load testing booking endpoints
- Calendar rendering performance
- Memory leak detection
- Bundle size monitoring

---

## 13. Implementation Plan - Preserve Working Code

### ✅ **KEEP AS-IS** (Working Components)
1. **API Endpoints**:
   - `/api/check-availability` - Complete and robust
   - `/api/check-pricing` - Full business logic implemented
   - All Stripe integration endpoints and webhooks

2. **Server Actions**:
   - `createPendingBookingAction` - Booking creation
   - `createHoldBookingAction` - Hold booking creation  
   - `createInquiryAction` - Contact host functionality
   - `createCheckoutSession` - Stripe payment setup
   - `createHoldCheckoutSession` - Hold payment setup

3. **Form Components**:
   - `BookingForm` - Full booking with Stripe integration
   - `HoldForm` - Hold booking functionality
   - `ContactHostForm` - Inquiry submission
   - All form validation and submission logic

4. **Utility Services**:
   - `availabilityService.ts` - API calls and caching
   - Hero image fetching logic
   - Property data fetching
   - Currency conversion functions
   - Language translation system

5. **UI Components**:
   - `BookingSummary` - Pricing display (needs integration)
   - All theme-related components
   - Language/currency switchers
   - Mobile/desktop layout components

### 🔄 **REBUILD/REFACTOR** (Broken State Management)

1. **BookingProvider** - Simplify state management
2. **BookingContainer** - Remove complex orchestration
3. **AvailabilityContainer** - Clean up circular dependencies
4. **Storage initialization** - Fix clearing logic
5. **Component coordination** - Simplify data flow

### 🆕 **NEW REQUIREMENTS** (V2 Enhancements)

1. **Property Schema Enhancement**: ✅ **COMPLETED**
   - Added `defaultMinimumStay: number` field to Property interface
   - Updated all property documents in Firestore with value 2
   - Updated admin form to include this field
   - Updated sample JSON files and documentation

2. **Calendar-Level Minimum Stay**:
   - Implement property minimum stay validation in date selection
   - Theme-aware visual feedback for date ranges
   - Check-in change handling with checkout clearing

### 🧪 **V2 Implementation Checklist**

#### **Phase 1: BookingProvider V2**
- [ ] Create simplified BookingProvider with complete state interface
- [ ] Implement property-specific sessionStorage strategy
- [ ] Add URL parameter parsing (including currency/language)
- [ ] Integrate with existing currency/language contexts
- [ ] Add comprehensive error handling with logging
- [ ] Implement minimum stay validation logic

#### **Phase 2: Component Integration**
- [ ] Update DateAndGuestSelector to use new provider interface
- [ ] Add minimum stay calendar validation
- [ ] Preserve existing BookingActions component (no changes)
- [ ] Preserve existing BookingForms component (no changes)
- [ ] Test all existing functionality works with new provider

#### **Phase 3: Error Handling**
- [ ] Implement all error types with user-friendly messages
- [ ] Add retry mechanisms for API failures
- [ ] Validate all required property fields on mount
- [ ] Test graceful degradation scenarios

#### **Phase 4: Testing & Validation**
- [ ] Test all URL parameter combinations
- [ ] Test currency/language fallback scenarios
- [ ] Test minimum stay validation edge cases
- [ ] Test session persistence across page refreshes
- [ ] Verify Stripe integration still works perfectly
- [ ] Test all theme color variations

### 🎯 **Implementation Strategy**

#### Phase 1: Clean State Management (Week 1)
- Build simplified BookingProvider v2
- Preserve all existing API calls and services
- Keep session storage keys compatible
- Test with existing forms

#### Phase 2: Component Integration (Week 2)  
- Integrate existing BookingSummary component
- Wire up existing form components
- Preserve all Stripe functionality
- Keep hero image and property display

#### Phase 3: Layout & Flow (Week 3)
- Clean up container components
- Preserve mobile/desktop layouts
- Keep theme system intact
- Maintain language/currency switching

#### Phase 4: Testing & Polish (Week 4)
- Test all existing booking flows
- Verify Stripe integration works
- Confirm mobile responsiveness
- Test multi-language/currency

### 📋 **Compatibility Requirements**

1. **API Compatibility**:
   - Keep all existing API endpoint calls
   - Maintain request/response formats
   - Preserve caching logic

2. **Form Compatibility**:
   - Use existing form components as-is
   - Keep validation rules
   - Maintain Stripe integration

3. **Storage Compatibility**:
   - Keep sessionStorage key format
   - Maintain URL parameter handling
   - Preserve language/currency persistence

4. **UI Compatibility**:
   - Keep existing BookingSummary
   - Maintain theme system
   - Preserve responsive layouts

This approach minimizes risk by keeping all the complex, working functionality (APIs, Stripe, forms) and only rebuilding the broken state management layer.

---

## V2 Specification Status Summary

### ✅ **COMPLETED SECTIONS**

All major specification sections are now complete with comprehensive implementation details:

1. **✅ Business Logic & Rules** - Complete pricing model, availability rules, minimum stay architecture
2. **✅ User Workflows** - Detailed booking flows (Book/Hold/Contact), error recovery processes
3. **✅ Multi-Context Support** - Language/currency/theme/domain handling fully documented
4. **✅ Error Handling & Edge Cases** - Network failures, race conditions, session management
5. **✅ Integration Requirements** - Stripe, email, analytics, PMS integrations documented
6. **✅ Security & Validation** - Comprehensive security audit with implementation requirements

### 📋 **IMPLEMENTATION READINESS**

**Core Foundation (Ready for Implementation):**
- ✅ Complete state management architecture
- ✅ API consumption patterns defined
- ✅ Component preservation strategy
- ✅ Migration plan with feature flags
- ✅ Error handling and recovery patterns

**Security Hardening (Critical Before Production):**
- 🚨 Remove development authentication bypass
- 🚨 Implement rate limiting
- 🚨 Add GDPR compliance measures
- ⚠️ Enhance XSS protection
- ⚠️ Add security headers

**Optional Enhancements:**
- 📋 Analytics implementation
- 📋 SMS notifications
- 📋 PMS integrations

### 🎯 **NEXT STEPS**

The V2 specification is **ready for implementation**. The migration plan provides a clear 20-day roadmap with:
- Side-by-side development approach
- Preservation of all working functionality
- Feature flag-based gradual rollout
- Comprehensive testing strategy

**Ready to proceed with V2 implementation when approved.**