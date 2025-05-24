# Booking API Calls Refactoring Plan
**Date**: May 22, 2025  
**Status**: Implementation Plan  
**Priority**: High  

## Executive Summary

This document outlines a comprehensive refactoring plan to eliminate duplicate API calls and centralize booking data management in the RentalSpot-Builder application. The current architecture suffers from multiple components making simultaneous API calls for the same data, resulting in poor performance, race conditions, and inconsistent user experience.

## Problem Analysis

### Current Architecture Issues

#### 1. Multiple API Call Sources
The system currently has **6-10+ API calls** triggered simultaneously when users interact with the booking interface:

**Pricing API Calls:**
- `BookingContext` → Auto-fetches via `fetchAvailabilityAndPricing()`
- `GuestSelector` → Direct calls to `/api/check-pricing`
- `ClientBookingWrapper` → Dynamic pricing fetch (lines 51-72)

**Availability API Calls:**
- `BookingContext` → Auto-fetches unavailable dates
- `useAvailabilityCheck` hook → Independent fetching
- `IndependentAvailabilityChecker` → Local state + fetching
- Direct component calls → `getUnavailableDatesForProperty()`

#### 2. Duplicate Service Files
- `/src/services/availabilityService.ts` (main)
- `/src/components/booking/services/availabilityService.ts` (duplicate)

#### 3. Context Complexity Multipliers
The multi-context architecture amplifies the API call problem:

- **Multi-Language Support**: Language changes trigger component re-renders
- **Multi-Currency Support**: Currency changes require pricing recalculations
- **Multi-Theme Support**: Theme changes may remount components
- **URL Parameter Support**: Guest count, dates, and language from URL

#### 4. Component Hierarchy Issues
```
BookingClientLayout
├── BookingProvider (BookingContext - makes centralized API calls)
│   └── ClientBookingWrapper (makes direct API calls)
│       └── BookingCheckLayout
│           └── BookingContainer (conditional provider)
│               └── AvailabilityContainer
│                   └── EnhancedAvailabilityChecker
│                       └── GuestSelector (makes direct API calls)
```

#### 5. Multiple Pricing Display Locations
**Left-Side Displays:**
- Desktop Sidebar (`BookingCheckLayout`) - Property card with total price
- Mobile Accordion - Expandable property details with pricing
- `ClientBookingWrapper` - Dynamic pricing calculations

**Main Content Displays:**
- `BookingSummary` - Detailed pricing breakdown
- Mobile Sticky Header - Total price display

### Performance Impact

**Current State Evidence (from Browser Logs):**
- Multiple simultaneous requests with different IDs: `mayidag2w2g` and `mayidag6m21`
- 2-3 simultaneous API calls for pricing data
- 2-4 simultaneous API calls for availability data
- Race conditions between different fetchers
- Inconsistent loading states across components
- Multiple network requests for identical data

**Observed Browser Log Pattern:**
```
[Log] [BookingContext] mayidag2w2g 🚀 SINGLE API CALL: fetchAvailabilityAndPricing started
[Log] [BookingContext] mayidag6m21 🚀 SINGLE API CALL: fetchAvailabilityAndPricing started
[Log] [BookingContext] Debouncing fetch call
[Log] [BookingContext] Debouncing fetch call
```

**User Experience Issues:**
- Loading indicators appearing/disappearing inconsistently
- Temporary price mismatches between components
- Slow response times due to network congestion
- Browser console flooding with API call logs
- Two separate BookingContext instances mounting simultaneously

## Current System Capabilities

### Supported Features

#### URL Parameter Support
- **Guest Count**: `?guests=3` ✅
- **Dates**: `?checkIn=2025-05-28&checkOut=2025-05-31` ✅
- **Currency**: `?currency=eur` ✅

#### Language Support
- **Path-Based Routing**: `/en/` and `/ro/` ✅
- **Custom Domain Support**: `prahova-chalet.ro/en/booking/check` ✅
- **Platform Domain Support**: `rentalspot.com/properties/slug/en/booking/check` ✅

#### Custom Domain Architecture
- Domain-to-property mapping via Firestore
- Properties have `customDomain` and `useCustomDomain` fields
- Middleware handles domain resolution
- Examples: `prahova-chalet.ro` → `prahova-mountain-chalet`

#### Multi-Context Support
- **BookingContext**: Centralized booking state management
- **LanguageContext**: Multi-language support (EN/RO)
- **CurrencyContext**: Multi-currency support (EUR/USD/RON)
- **ThemeContext**: Dynamic theme switching

### Data Storage Analysis

#### BookingContext Centralized Data
The BookingContext already stores ALL required data:

**Pricing Data:**
```typescript
interface PricingDetails {
  accommodationTotal: number;
  cleaningFee: number;
  subtotal: number;
  total: number;
  totalPrice: number;
  currency: CurrencyCode;
  dailyRates?: Record<string, number>;
  lengthOfStayDiscount?: object | null;
  couponDiscount?: object | null;
  datesFetched?: {
    checkIn: string;
    checkOut: string;
    guestCount: number;
  };
  timestamp: number;
}
```

**Availability Data:**
```typescript
unavailableDates: Date[];
isAvailabilityLoading: boolean;
availabilityError: string | null;
isAvailable: boolean | null;
```

**Booking State:**
```typescript
propertySlug: string | null;
checkInDate: Date | null;
checkOutDate: Date | null;
numberOfGuests: number;
numberOfNights: number;
selectedCurrency: CurrencyCode;
// ... guest information fields
```

#### API Response Analysis
The API already calculates guest-level pricing correctly:

**Pricing Calculation Logic:**
```typescript
if (guests <= property.baseOccupancy) {
  // Use base occupancy price
  dailyPrices[dateStr] = dayPrice.baseOccupancyPrice;
} else {
  // Use specific price tier OR base + extra guest fees
  const occupancyPrice = dayPrice.prices?.[guests.toString()];
  if (occupancyPrice) {
    dailyPrices[dateStr] = occupancyPrice;
  } else {
    const extraGuests = guests - property.baseOccupancy;
    const extraGuestFee = property.extraGuestFee || 0;
    dailyPrices[dateStr] = dayPrice.baseOccupancyPrice + (extraGuests * extraGuestFee);
  }
}
```

## Strategic Decisions Made

### API Enhancement vs Current Architecture
**Discussion**: Whether to enhance API to return all guest pricing tiers vs fixing current architecture
**Decision**: Two-phase approach
1. **Phase 1**: Fix current architecture (immediate impact)
2. **Phase 2**: Enhance API for optimization (future improvement)
**Rationale**: Immediate problem resolution with minimal changes, then optimize

### Surgical vs Complete Rewrite
**Question**: Whether to make surgical interventions or complete architectural overhaul
**Decision**: Surgical interventions with minimal breaking changes
**Rationale**: 
- Lower risk of introducing new bugs
- Faster implementation timeline
- Preserves all existing functionality
- Easier testing and validation

### URL Parameter Strategy
**Discussion**: Whether to shorten URL parameters for shareability
**Decision**: Keep existing parameter names, use external URL shortening if needed
**Benefits**: Maintain readability, easier debugging, no parameter mapping

### Theme Handling in URLs
**Decision**: Store theme in Firestore (`properties/{slug}/themeId`), not in URL
**Rationale**: Keeps URLs clean, allows property owners to control branding

## Refactoring Strategy

### Phase 1: Immediate Cleanup (Eliminate Duplicate API Calls)

#### Objective
Implement a **two-API architecture** with separate concerns and user-controlled pricing updates while maintaining all existing functionality.

#### Minimal Intervention Principle
**Critical Constraint**: Keep code interventions as focused as possible to appropriate files only.

**No Changes To:**
- ✅ **API Response Structures**: Both `/api/check-availability` and `/api/check-pricing` response formats unchanged
- ✅ **Backend Logic**: `/api/check-pricing` endpoint completely untouched
- ✅ **Existing UI Layout**: No modifications to current layout or styling
- ✅ **Component Props**: Existing component interfaces preserved
- ✅ **Other Functionalities**: Any features outside of booking API call management untouched

**Minimal UI Changes Required:**
- 🎯 **"Check Price" Button**: Always visible, consistently placed UI element for user-controlled pricing updates
- 🎯 **Button State Management**: Enabled/disabled states based on date selection and loading status

**Only Changes To:**
- 🎯 **Internal API call logic**: How and when APIs are called
- 🎯 **Data flow management**: Where API responses are stored and accessed
- 🎯 **SDK migration**: `/api/check-availability` internal implementation only
- 🎯 **Context state management**: BookingContext fetch functions and triggers

#### Refined Approach Decision
After comprehensive analysis, we decided to **keep two separate API endpoints** but with clear separation of concerns:

**Rationale for Two Endpoints:**
- **Different Scope**: `/api/check-availability` returns ALL unavailable dates (12 months), `/api/check-pricing` handles specific date ranges with pricing
- **Performance**: Availability = lightweight calendar data, Pricing = pre-calculated price retrieval from Firestore
- **Reusability**: Calendar components need availability without pricing data
- **Caching Strategy**: Availability data changes less frequently than pricing data

#### API Architecture Strategy

**`/api/check-availability`** (Session-Persistent):
- **Purpose**: Load ALL unavailable dates for property calendar
- **SDK Migration**: **Change from Client SDK to Admin SDK** using the same authentication and initialization approach as `/api/check-pricing`
- **Frequency**: **Once per property session** - persistent throughout user session
- **Triggers**: Only when property loads or changes

**`/api/check-pricing`** (User-Controlled):
- **Purpose**: Retrieve pre-calculated pricing for specific date range and guest count
- **SDK**: **Keep Admin SDK** (no changes to this endpoint)
- **Frequency**: **User-initiated** via "Check Price" button + **initial load** (if URL has dates)
- **Triggers**: Initial load (if URL has both checkIn and checkOut dates) + user button clicks

#### URL-Based Initial Loading Strategy

**Initial Page Load Logic:**
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const hasCheckIn = urlParams.get('checkIn');
  const hasCheckOut = urlParams.get('checkOut');
  const guestsParam = urlParams.get('guests');
  
  // Always fetch availability for the property (once per session)
  if (propertySlug && unavailableDates.length === 0) {
    fetchAvailability();
  }
  
  // Fetch pricing ONLY if both dates are present in URL
  if (propertySlug && hasCheckIn && hasCheckOut) {
    const guestCount = determineGuestCount(guestsParam, property);
    fetchPricing(hasCheckIn, hasCheckOut, guestCount);
  }
}, [propertySlug]);
```

**Smart Guest Count Handling (Verified Logic):**
```typescript
const determineGuestCount = (guestsParam: string | null, property: Property): number => {
  if (!guestsParam) {
    return property.baseOccupancy || 2; // Matches existing GuestPicker default
  }
  
  const requestedGuests = parseInt(guestsParam, 10);
  if (isNaN(requestedGuests)) {
    return property.baseOccupancy || 2; // Consistent with current behavior
  }
  
  // Cap at max guests allowed
  return Math.min(requestedGuests, property.maxGuests || 10);
};
```

**Note**: This logic is verified to match the existing behavior in `/src/components/booking/guest-picker.tsx:28` where `baseOccupancy` is used as the default guest count.

#### Implementation Steps

##### Step 1: SDK Migration for /api/check-availability
**File**: `/src/app/api/check-availability/route.ts`

**Current Issue**: Uses Client SDK which may have cloud compatibility issues
```typescript
// CURRENT (Client SDK):
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
```

**Solution**: Migrate to Admin SDK pattern (using existing pricing infrastructure)
```typescript
// NEW (Admin SDK - verified pattern):
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';
const db = await getFirestoreForPricing();
```

**Rationale**: The `getFirestoreForPricing()` function is confirmed to be the correct Admin SDK initialization pattern. Despite its name suggesting pricing-specific usage, it returns a standard Admin SDK Firestore instance suitable for all operations including availability queries.

##### Step 2: Separate BookingContext Fetch Functions
**File**: `/src/contexts/BookingContext.tsx`

**Current Issue**: Combined `fetchAvailabilityAndPricing()` always calls both APIs
```typescript
// CURRENT: Always calls both APIs
const fetchAvailabilityAndPricing = async () => {
  const unavailableDates = await getUnavailableDatesForProperty(slug);
  const pricing = await getPricingForDateRange(slug, dates, guests);
  // ...
};
```

**Solution**: Separate functions with different trigger logic
```typescript
// NEW: Separate functions
const fetchAvailability = useCallback(async () => {
  // Only call /api/check-availability
  const unavailableDates = await getUnavailableDatesForProperty(propertySlug);
  setUnavailableDates(unavailableDates);
}, [propertySlug]);

const fetchPricing = useCallback(async (checkIn, checkOut, guests) => {
  // Only call /api/check-pricing
  const pricingResponse = await getPricingForDateRange(propertySlug, checkIn, checkOut, guests);
  setPricingDetails(pricingResponse);
}, [propertySlug]);

// Separate trigger logic
useEffect(() => {
  // Availability: Once per property, persist during session
  if (propertySlug && unavailableDates.length === 0) {
    fetchAvailability();
  }
}, [propertySlug]); // Only property changes trigger availability fetch
```

##### Step 3: Fix GuestSelector Component
**File**: `/src/components/booking/sections/common/GuestSelector.tsx`

**Current Issue**: Makes direct API calls when guest count changes

**Solution**: Remove all direct API calls, use context only
```typescript
// REMOVE: Lines 35-204 (all direct API call logic)

// REPLACE WITH: Context-only approach
const { setNumberOfGuests } = useBooking();

const decrementGuests = () => {
  if (value > minGuests) {
    const newCount = value - 1;
    onChange(newCount); // Update UI immediately
    setNumberOfGuests(newCount); // Update context (no auto-fetch)
  }
};
```

##### Step 4: Add "Check Price" Button UI
**Files**: Key components where users control pricing updates

**Placement Strategy:**
- **Optimal UX Location**: Close to date and guest selectors where users make changes
- **Recommended**: `/src/components/booking/sections/availability/EnhancedAvailabilityChecker.tsx` - Central location near both date selection and guest controls
- **Alternative**: `/src/components/booking/sections/common/GuestSelector.tsx` - If component layout requires separate placement

**Approach**: **Always Visible Button** - Add permanently visible "Check Price" button for consistent user control

**Current API Reality**: `/api/check-pricing` only returns pricing for the specific guest count requested, not all occupancy levels. Therefore, guest count changes require new API calls.

**UI Design Decision**: Button remains always visible for consistent user experience and predictable interface behavior.

```typescript
// Add "Check Price" button component - Always Visible
const CheckPriceButton = () => {
  const { 
    fetchPricing, 
    isPricingLoading, 
    checkInDate, 
    checkOutDate, 
    numberOfGuests 
  } = useBooking();
  
  const handleCheckPrice = () => {
    if (checkInDate && checkOutDate) {
      fetchPricing(checkInDate, checkOutDate, numberOfGuests);
    }
  };
  
  return (
    <Button 
      onClick={handleCheckPrice} 
      disabled={isPricingLoading || !checkInDate || !checkOutDate}
    >
      {isPricingLoading ? 'Calculating...' : 'Check Price'}
    </Button>
  );
};

// Button States:
// - Enabled: When dates are selected and not loading
// - Disabled: When dates missing or API call in progress  
// - Loading: Shows "Calculating..." during API call
// - Always Visible: Consistent UI placement

// Modify existing user interactions to update context only
const handleGuestChange = (newCount) => {
  setNumberOfGuests(newCount); // Update context only
  // Remove direct API calls from GuestSelector
  // User can click "Check Price" to get updated pricing
};
```

**Benefits of Always Visible Approach:**
- ✅ **Consistent UI**: No layout shifts from appearing/disappearing buttons
- ✅ **User Training**: Users learn where pricing control is located
- ✅ **Predictable Behavior**: Button always available when needed
- ✅ **Accessibility**: Screen readers maintain consistent navigation
- ✅ **Simpler Code**: No complex visibility logic required

##### Step 5: Fix ClientBookingWrapper Component
**File**: `/src/components/booking/client-booking-wrapper.tsx`

**Current Issue**: Makes independent pricing fetches (lines 51-72)

**Solution**: Read from BookingContext, remove direct fetching
```typescript
// REMOVE: Lines 51-72 (dynamic pricing fetch logic)

// REPLACE WITH: Context-only approach
const { pricingDetails, isPricingLoading, pricingError } = useBooking();
```

##### Step 6: Consolidate Availability Services
**Action**: Remove duplicate service file
- Keep: `/src/services/availabilityService.ts`
- Remove: `/src/components/booking/services/availabilityService.ts`

**Update Imports**: Ensure all components import from the main service location

##### Step 7: Eliminate useAvailabilityCheck Hook Dependencies
**Files**: Components using `useAvailabilityCheck`

**Solution**: Replace with BookingContext usage
```typescript
// REPLACE:
const { unavailableDates, isLoading } = useAvailabilityCheck();

// WITH:
const { unavailableDates, isAvailabilityLoading } = useBooking();
```

#### Race Condition Prevention

**Critical Design Decision**: Prevent pricing updates from triggering availability re-fetches

**Problem Avoided**:
```typescript
// User clicks "Check Price"
→ /api/check-pricing called
→ Response updates BookingContext pricingDetails
→ BookingContext useEffect detects change  
→ Auto-triggers fetchAvailabilityAndPricing() ❌
→ Calls /api/check-availability again (unnecessary!)
```

**Solution Implemented**:
- **Separate useEffect triggers**: Availability only triggers on property change
- **No cross-triggering**: Pricing updates don't affect availability fetching
- **Session persistence**: Availability loaded once per property, persisted throughout session
- **User-controlled pricing**: Only triggered by button clicks or initial URL load

```typescript
// Availability: Property-scoped, session-persistent
useEffect(() => {
  if (propertySlug && unavailableDates.length === 0) {
    fetchAvailability(); // Once per property
  }
}, [propertySlug]); // Only property changes

// Pricing: User-initiated only (no auto-triggers)
const handleCheckPrice = () => {
  fetchPricing(checkInDate, checkOutDate, numberOfGuests);
};
```

#### Expected Results After Phase 1
- **API Calls Optimized**: Availability = 1 per session, Pricing = 1 per session (if URL has dates) + user-controlled
- **Performance Improved**: No unnecessary re-fetching, faster response times
- **User Experience Enhanced**: Always visible pricing control, consistent and predictable interface
- **Interface Stability**: No layout shifts from dynamic button behavior
- **Architecture Simplified**: Separate concerns, no race conditions
- **Cloud Compatibility**: Admin SDK throughout server-side operations

### Phase 2: Enhanced API Response (Optional Optimization)

#### Objective
Eliminate API calls when changing guest count by returning all guest pricing tiers in a single call.

#### API Enhancement
**Current API Response:**
```json
{
  "available": true,
  "pricing": {
    "total": 2560,
    "currency": "EUR",
    "guestCount": 3
  }
}
```

**Enhanced API Response:**
```json
{
  "available": true,
  "pricing": {
    "total": 2560,
    "currency": "EUR",
    "guestCount": 3
  },
  "guestPricingTiers": {
    "2": {"total": 2400, "dailyRates": {...}},
    "3": {"total": 2560, "dailyRates": {...}},
    "4": {"total": 2720, "dailyRates": {...}},
    "5": {"total": 2880, "dailyRates": {...}}
  }
}
```

#### Implementation Benefits
- **Zero API calls** when changing guest count
- **Instant price updates** in UI
- **Better user experience** with immediate feedback
- **Future-proof** for advanced pricing UI features

### Phase 3: Shareable Link Enhancement (Future Feature)

#### Complete URL Structure
Based on current architecture supporting custom domains and language routing:

**Custom Domain Format:**
```
https://prahova-chalet.ro/en/booking/check?checkIn=2025-05-28&checkOut=2025-05-31&guests=5&currency=eur
```

**Platform Domain Format:**
```
https://rentalspot.com/properties/prahova-mountain-chalet/en/booking/check?checkIn=2025-05-28&checkOut=2025-05-31&guests=5&currency=eur
```

#### Additional URL Parameters to Support
- **Language**: Already supported via path (`/en/`, `/ro/`)
- **Theme**: Retrieved from Firestore (`properties/{slug}/themeId`) - no URL parameter needed
- **Currency**: Add `?currency=eur` support
- **All booking state**: Complete booking context serialization

#### Implementation Requirements
1. **URL Generation Utility**: Function to create complete shareable URLs
2. **URL Parsing Enhancement**: Support all booking parameters
3. **Query Parameter Language Support**: Add `?lang=en` as alternative to path-based
4. **Shareable Link Component**: UI for generating and copying links

#### URL Length Considerations
**Decision**: Keep existing URL parameter names (not shortened) for clarity and maintainability
- Current: `?checkIn=2025-05-28&checkOut=2025-05-31&guests=5&currency=eur`
- **Rationale**: External URL shortening services can handle length if needed
- **Benefits**: Readable URLs, easier debugging, no parameter mapping needed

## Root Cause Analysis

### Discovery Process

Our investigation revealed the core issues through:

1. **Browser Log Analysis**: Identified multiple simultaneous API calls with different request IDs (`mayidag2w2g` vs `mayidag6m21`)
2. **Component Tree Investigation**: Found multiple BookingProvider instances mounting simultaneously
3. **Service File Audit**: Discovered duplicate availability services in different locations
4. **Context Architecture Review**: Understood how multi-context complexity amplifies API calls
5. **URL Parameter Investigation**: Confirmed existing support for guests, dates, language parameters
6. **Custom Domain Verification**: Validated the existing custom domain architecture

### The "Pure UI" Component Evolution

The architectural journey went through several phases:
1. **Initial Problem**: Components making direct API calls (multiple sources)
2. **First Attempt**: Centralized fetching in BookingContext (single API call architecture)
3. **Second Issue**: Components still triggering manual fetches alongside auto-fetch
4. **Pure UI Solution**: Components only read from context, no direct API calls
5. **Remaining Challenge**: Multiple context instances bypassing coordination

### Timeout-Based Debouncing Analysis

Investigation revealed existing sophisticated debouncing mechanisms:
- `isFetchingRef` and `lastFetchTimeRef` for preventing infinite loops
- 1-second minimum between fetch calls within same context
- Advanced request coordination within single BookingContext instance
- **Critical Gap**: Debouncing only works within single context - multiple instances bypass it

### Multiple Context Instance Problem

**Root Cause Identified**: 
- `BookingContainer` creates conditional provider
- `booking-client-layout` creates another provider  
- Two separate contexts = two separate debouncing systems
- Each context thinks it's the only one making calls

**Why Multiple Contexts Exist**:
- **Self-Contained Components**: Each component tried to be self-sufficient with its own provider
- **Nested Provider Pattern**: BookingContainer embedded in pages that already have BookingProvider
- **Component Reusability**: Components designed to work independently but end up nested
- **Not React StrictMode**: Investigation confirmed this wasn't causing double mounting

**Evidence from Logs**:
```
[Log] [BookingContext] Created new session: 1747866136593-fdpjl7s8q for property: prahova-mountain-chalet
[Log] [BookingContext] Reusing existing session: 1747866136593-fdpjl7s8q for property: prahova-mountain-chalet
```
Shows two separate BookingContext instances mounting for same property

## Technical Implementation Details

### BookingContext Auto-Fetch Logic
The existing auto-fetch mechanism in BookingContext handles data fetching correctly:

```typescript
// Effect to auto-fetch BOTH availability and pricing when property/dates/guests change
React.useEffect(() => {
  // Debouncing logic prevents excessive calls
  const now = Date.now();
  if (now - lastFetchTimeRef.current < 1000) {
    console.log(`[BookingContext] Debouncing fetch call`);
    return;
  }
  
  // Prevent infinite loops
  if (isFetchingRef.current) {
    console.log(`[BookingContext] Skipping fetch: Already fetching`);
    return;
  }
  
  // Smart fetch conditions
  if (storedPropertySlug && !isPricingLoading && !isAvailabilityLoading) {
    const needsAvailabilityFetch = unavailableDates.length === 0;
    const needsPricingFetch = checkInDate && checkOutDate && numberOfNights > 0 && (
      !pricingDetails || 
      (pricingDetails.datesFetched && (
        pricingDetails.datesFetched.checkIn !== checkInDate.toISOString() ||
        pricingDetails.datesFetched.checkOut !== checkOutDate.toISOString() ||
        pricingDetails.datesFetched.guestCount !== numberOfGuests
      ))
    );
    
    if (needsAvailabilityFetch || needsPricingFetch) {
      fetchAvailabilityAndPricing();
    }
  }
}, [storedPropertySlug, checkInDate, checkOutDate, numberOfNights, numberOfGuests]);
```

### Conditional Provider Logic
The existing conditional provider in BookingContainer prevents nested providers:

```typescript
const ConditionalBookingProvider = ({ children }: { children: React.ReactNode }) => {
  try {
    useBooking(); // Try to access existing context
    console.log(`[BookingContainer] ✅ Using existing BookingProvider`);
    return <>{children}</>;
  } catch {
    console.log(`[BookingContainer] 🆕 Creating new BookingProvider`);
    return (
      <BookingProvider propertySlug={property.slug}>
        {children}
      </BookingProvider>
    );
  }
};
```

### Session Storage Integration
BookingContext uses `useSyncedSessionStorage` for data persistence:

```typescript
const [unavailableDates, setUnavailableDatesInternal] = useSyncedSessionStorage<Date[]>(
  `${storagePrefix}unavailableDates`, 
  [],
  { prefix: '' }
);

const [pricingDetails, setPricingDetailsInternal] = useSyncedSessionStorage<PricingDetails | null>(
  `${storagePrefix}pricingDetails`, 
  null,
  { prefix: '' }
);
```

This ensures booking data persists across page navigation and browser refreshes.

## Risk Assessment

### Low Risk Changes (Phase 1)
- **GuestSelector modification**: Simple replacement of API call with context usage - **internal logic only**
- **ClientBookingWrapper cleanup**: Remove redundant fetching logic - **internal logic only**
- **Service consolidation**: Remove duplicate files, update imports - **internal structure only**
- **BookingContext refactoring**: Separate fetch functions - **internal state management only**
- **SDK migration**: `/api/check-availability` internal implementation - **server-side only**

**All changes are internal implementation details with zero user-facing modifications.**

### Medium Risk Changes
- **Component dependency updates**: Ensure all useAvailabilityCheck usages are replaced
- **Testing across contexts**: Verify behavior with language/currency/theme changes

### High Risk Changes (Phase 2+)
- **API modifications**: Requires backend changes and testing
- **URL structure changes**: May affect existing bookmarks and external links

## Testing Strategy

### Phase 1 Testing
1. **API Call Monitoring**: Verify reduction from multiple to single calls
2. **Functional Testing**: Ensure all booking features work correctly
3. **Cross-Context Testing**: Test with language, currency, and theme changes
4. **URL Parameter Testing**: Verify initialization from URL parameters
5. **Custom Domain Testing**: Test with both custom and platform domains

### Performance Metrics
- **Before**: Count API calls per user interaction
- **After**: Verify single API call per interaction
- **Loading Time**: Measure improvement in response times
- **User Experience**: Verify consistent loading states

### Browser Testing
- **Network Tab**: Monitor actual API calls
- **Console Logs**: Verify debug information shows correct flow
- **Multiple Browsers**: Test cross-browser compatibility
- **Mobile Testing**: Verify mobile-specific components work correctly

## Migration Timeline

### Immediate (Week 1)
- [ ] Step 1: SDK Migration for /api/check-availability
- [ ] Step 2: Separate BookingContext Fetch Functions  
- [ ] Step 3: Fix GuestSelector component
- [ ] Step 4: Add "Check Price" Button UI
- [ ] Step 5: Fix ClientBookingWrapper component

### Short Term (Week 2)
- [ ] Step 6: Consolidate Availability Services
- [ ] Step 7: Eliminate useAvailabilityCheck Hook Dependencies
- [ ] Comprehensive testing across all contexts
- [ ] Performance validation

### Medium Term (Month 1)
- [ ] Phase 2: Enhanced API response (optional)
- [ ] Advanced testing with guest pricing tiers
- [ ] Performance optimization

### Long Term (Month 2+)
- [ ] Phase 3: Shareable link enhancement
- [ ] Complete URL generation utility
- [ ] Advanced booking state management

## Success Criteria

### Performance Metrics
- ✅ **API Calls**: Availability = 1 per session, Pricing = 1 per session (if URL has dates) + user-controlled
- ✅ **Response Time**: Improved by 50%+ due to eliminated race conditions and duplicate calls
- ✅ **Network Traffic**: No redundant availability requests, pricing only when needed
- ✅ **Browser Performance**: Eliminated simultaneous competing requests
- ✅ **Cloud Compatibility**: Admin SDK consistency across all server-side operations

### User Experience Metrics
- ✅ **Loading States**: Consistent across all pricing displays
- ✅ **Price Consistency**: No temporary mismatches between components
- ✅ **User Control**: Always visible "Check Price" button for predictable pricing updates
- ✅ **Interface Stability**: No layout shifts from dynamic button visibility
- ✅ **Accessibility**: Consistent navigation elements for screen readers
- ✅ **Error Handling**: Centralized error states

### Code Quality Metrics
- ✅ **Single Source of Truth**: All booking data managed by BookingContext
- ✅ **Reduced Complexity**: Eliminated duplicate fetching logic
- ✅ **Maintainability**: Centralized API call management
- ✅ **Debugging**: Clear, traceable data flow

## Critical Bug Fixes Required

Based on user testing, the following 5 critical bugs were discovered that must be fixed before the system is production-ready:

### Bug #1: Guest Count Not Updating in Summary Display
**Priority**: High (UX Issue)  
**Issue**: BookingSummary header shows stale guest count when users change number of guests  
**Example**: Header shows "Booking Summary: 4 nights, 2 guests" even after changing to 5 guests  
**Root Cause**: BookingSummary used prop values instead of BookingContext values in calculation logic  
**Location**: `/src/components/booking/booking-summary.tsx` lines 141-142, 161, and useMemo dependencies  
**Solution**: Replace prop usage with BookingContext values in all calculation logic  
**Status**: ✅ **FIXED** - All prop references replaced with contextNights/contextGuests from BookingContext  

### Bug #2: Complete Component Re-rendering Performance Issue  
**Priority**: Medium (Performance Issue)  
**Issue**: Changing guest count or dates triggers complete re-render of all containers  
**Manifestation**: All booking components remount causing noticeable UI lag  
**Root Cause**: Missing React.memo optimization on key components  
**Impact**: Poor performance, excessive API calls, laggy user interface  
**Solution**: Add React.memo to prevent unnecessary re-renders  
**Status**: ⏳ To Fix  

### Bug #3: Calendar Date Selection Not Persisting (CRITICAL)
**Priority**: Critical (Blocking Issue)  
**Issue**: Calendar accepts date clicks but selected dates don't update in form fields  
**Example**: User clicks May 29, calendar registers selection, but check-in field stays May 27  
**Root Cause**: BookingContainer was parsing URL parameters on every render, overriding user selections with old URL dates  
**Location**: `/src/components/booking/container/BookingContainer.tsx` lines 390-435  
**Impact**: **Booking system non-functional** - users cannot change dates  
**Solution**: Move URL parameter parsing to useState initializer to run only once on mount  
**Status**: ✅ **FIXED** - URL parsing now happens once, user selections are preserved  

### Bug #4: Multiple API Calls on Single User Action
**Priority**: Medium (Efficiency Issue)  
**Issue**: Single date/guest change triggers multiple simultaneous pricing API calls  
**Root Cause**: Multiple useEffect hooks in BookingContext trigger simultaneously  
**Impact**: Server overload, race conditions, potential pricing inconsistencies  
**Solution**: Add 300ms debouncing to API call triggers  
**Status**: ⏳ To Fix  

### Bug #5: Excessive Language File Requests  
**Priority**: Low (Optimization Issue)  
**Issue**: Language files fetched repeatedly during user interactions  
**Example**: 10+ requests to `/locales/en.json` when changing check-in date  
**Root Cause**: LanguageContext reloads translations without caching  
**Location**: `/src/contexts/LanguageContext.tsx` lines 63-92  
**Impact**: Unnecessary network traffic, poor offline experience  
**Solution**: Implement Map-based translation caching  
**Status**: ⏳ To Fix  

## Conclusion

This refactoring plan addresses critical performance and architectural issues in the RentalSpot-Builder booking system. The multi-phase approach ensures minimal risk while delivering immediate performance improvements.

**Key Benefits:**
- **Optimized API Usage**: Session-persistent availability + user-controlled pricing
- **Improved User Experience**: Always visible pricing control, predictable interface behavior
- **Better Architecture**: Separate concerns with centralized state management
- **Cloud Compatibility**: Admin SDK consistency for production deployment
- **Race Condition Free**: No cross-triggering between availability and pricing updates
- **Consistent UI**: No layout shifts from dynamic button visibility
- **Accessibility Enhanced**: Predictable navigation elements for all users
- **Future-Ready**: Foundation for enhanced features like shareable links

**Implementation Approach:**
- **Surgical Changes**: Minimal code modifications for maximum impact
- **Preserve Functionality**: All existing features maintained  
- **Minimal UI Changes**: Only "Check Price" button addition when needed
- **No Backend Changes**: `/api/check-pricing` endpoint completely untouched
- **Internal-Only Refactoring**: API call logic and data flow optimization
- **Low Risk**: Phased approach with comprehensive testing
- **Measurable Results**: Clear performance metrics and success criteria

The proposed changes will transform the booking system from a fragmented, performance-heavy architecture to a streamlined, efficient, and maintainable solution while preserving all existing functionality including multi-language, multi-currency, multi-theme, and custom domain support.