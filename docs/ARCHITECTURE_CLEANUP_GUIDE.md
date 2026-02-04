# Architecture Cleanup Guide

**Created**: 2026-02-04
**Status**: Verified Investigation Complete
**Last Updated**: 2026-02-04

## Executive Summary

This document provides a verified, actionable guide for cleaning up technical debt in the RentalSpot-Builder codebase. All recommendations have been validated against the actual codebase to ensure accuracy and safety.

### Overall Assessment

The codebase is **well-architected with accumulated technical debt**, not spaghetti code. The foundations are solid:
- Clear separation of concerns (services, contexts, components)
- Strong TypeScript usage (minimal `any` types)
- Excellent file documentation and headers
- Proper data flow patterns

The cleanup focuses on removing dead code, unused components, and simplifying where possible.

### Quick Reference

| Phase | Risk | Effort | Impact |
|-------|------|--------|--------|
| Phase 1: Safe Deletions | Zero | 15 min | Remove ~10 dead files |
| Phase 2: V1 Booking Removal | Low | 30 min | Remove legacy booking system |
| Phase 3: Component Refactoring | Medium | 3-4 hrs | Improve maintainability |
| Phase 4: Ongoing Improvements | Low | 8-10 hrs | Standardize logging |

---

## Phase 1: Safe Deletions (Zero Risk)

These files have **no imports anywhere** in the codebase and can be deleted immediately.

### 1.1 Unused Amenities Components

**Status**: ✅ COMPLETED (2026-02-04, commit 147fb9e)

**Location**: `/src/components/property/`

| File | Reason for Deletion |
|------|---------------------|
| `amenities-section.tsx` | No imports - legacy component |
| `amenities-display.tsx` | No imports - experimental, never adopted |
| `amenities-from-references.tsx` | No imports - duplicate of above |

**Keep**: `amenities-list.tsx` (actively used by `property-page-renderer.tsx`)

**Commands**:
```bash
rm src/components/property/amenities-section.tsx
rm src/components/property/amenities-display.tsx
rm src/components/property/amenities-from-references.tsx
```

**Verification**:
```bash
# Confirm no imports exist
grep -r "amenities-section" src/
grep -r "amenities-display" src/
grep -r "amenities-from-references" src/
# All should return empty
```

### 1.2 Unused Pricing API Endpoints

**Status**: ✅ COMPLETED (2026-02-04, commit 7a60ab1)

**Location**: `/src/app/api/`

| Endpoint | Reason for Deletion |
|----------|---------------------|
| `/api/check-pricing-v2/` | No callers - experimental, never adopted |
| `/api/check-pricing-availability/` | No callers - returns mock data, abandoned fallback |
| `/api/reset-price-cache/` | No callers - incomplete stub |

**Keep**: `/api/check-pricing/` (actively used by BookingProvider and availabilityService)

**Commands**:
```bash
rm -rf src/app/api/check-pricing-v2/
rm -rf src/app/api/check-pricing-availability/
rm -rf src/app/api/reset-price-cache/
```

**Verification**:
```bash
# Confirm no fetch calls to these endpoints
grep -r "check-pricing-v2" src/
grep -r "check-pricing-availability" src/
grep -r "reset-price-cache" src/
# All should return empty (or only this documentation file)
```

### 1.3 Unused Firebase Admin Files

**Location**: `/src/lib/`

| File | Reason for Deletion |
|------|---------------------|
| `firebaseAdminDebug.ts` | No imports - development utility, never used |
| `firebaseAdminNew.ts` | Only stub implementations returning null |

**Keep**:
- `firebaseAdminSafe.ts` - Core initialization (foundation)
- `firebaseAdminNode.ts` - Auth functions (Node.js runtime required)
- `firebaseAdminPricing.ts` - Pricing operations (caching layer)
- `firebaseAdmin.ts` - Legacy facade (simplify in Phase 4)

**Commands**:
```bash
rm src/lib/firebaseAdminDebug.ts
rm src/lib/firebaseAdminNew.ts
```

**Verification**:
```bash
grep -r "firebaseAdminDebug" src/
grep -r "firebaseAdminNew" src/
# Should only return results in pricing-data.ts and startup-check - update these files
```

**Required Updates** (for `firebaseAdminNew.ts` removal):

```typescript
// In src/lib/server/pricing-data.ts
// Replace:
const { isFirestoreAdminAvailable } = await import('@/lib/firebaseAdminNew');

// With:
import { getFirestoreSafe } from '@/lib/firebaseAdminSafe';
const isFirestoreAdminAvailable = () => getFirestoreSafe() !== null;
```

```typescript
// In src/app/api/startup-check/route.ts
// Remove or replace firebaseAdminNew imports with firebaseAdminSafe
```

---

## Phase 2: V1 Booking System Removal (Low Risk)

The V1 booking system is dead code. `BOOKING_V2` flag is always `true` and never checked.

### 2.1 Current State

| Component | Location | Status |
|-----------|----------|--------|
| V1 Booking Directory | `/src/components/booking/` | 5 files, ~1KB |
| Active Import | `hero-section.tsx` line 10 | Uses `BookingContainer` |
| BookingContainer Purpose | Date picker widget | **Only redirects to V2** |
| BOOKING_V2 Flag | `/src/config/features.ts` | Always `true`, never checked |

### 2.2 Migration Steps

**Step 1**: Create standalone booking widget

```bash
mkdir -p src/components/booking-widget
```

Create `/src/components/booking-widget/BookingWidget.tsx`:
```typescript
/**
 * Standalone Booking Widget
 *
 * @description Simple date picker that redirects to the V2 booking flow.
 *              Extracted from legacy V1 booking system during cleanup.
 * @created 2026-02-04
 */

// Copy content from src/components/booking/container/BookingContainer.tsx
// This is a simple redirect widget, not actual booking logic
```

Create `/src/components/booking-widget/index.ts`:
```typescript
export { BookingWidget } from './BookingWidget';
// Alias for backward compatibility during migration
export { BookingWidget as BookingContainer } from './BookingWidget';
```

**Step 2**: Update hero-section import

```typescript
// In src/components/homepage/hero-section.tsx
// Change line 10 from:
import { BookingContainer } from '@/components/booking';

// To:
import { BookingContainer } from '@/components/booking-widget';
```

**Step 3**: Delete V1 booking directory

```bash
rm -rf src/components/booking/
```

**Step 4**: (Optional) Remove feature flag

```typescript
// In src/config/features.ts
// The BOOKING_V2 flag can be removed since it's always true and never checked
// Or keep it with a comment for documentation purposes
```

### 2.3 Verification Checklist

- [ ] `npm run build` succeeds
- [ ] Hero section renders without errors
- [ ] Date picker in hero section works
- [ ] Clicking "Check Availability" redirects to `/booking/check/[slug]`
- [ ] V2 booking flow completes successfully
- [ ] No console errors on any booking page

---

## Phase 3: Component Refactoring (Medium Risk)

### 3.1 DateAndGuestSelector Split (RECOMMENDED)

**Current**: 831 lines in single file
**Location**: `/src/components/booking-v2/components/DateAndGuestSelector.tsx`

**Proposed Structure**:
```
src/components/booking-v2/
├── components/
│   ├── DateAndGuestSelector.tsx    (refactored: ~150 lines, composition only)
│   ├── date-selector/
│   │   ├── index.ts
│   │   ├── DatePickerSection.tsx   (~200 lines)
│   │   ├── CalendarLogic.ts        (~80 lines, utility functions)
│   │   └── DateFormatting.ts       (~50 lines, utility functions)
│   ├── guest-selector/
│   │   ├── index.ts
│   │   └── GuestSelector.tsx       (~80 lines)
│   └── pricing-status/
│       ├── index.ts
│       └── PricingErrorDisplay.tsx (~150 lines, already partially isolated)
```

**Extraction Guide**:

1. **CalendarLogic.ts** - Extract these functions:
   - `isDateRangeAvailable()`
   - `findNextAvailablePeriod()`
   - `calculateDisabledDates()`
   - `getDatesBetween()`
   - `getDaysBetween()`

2. **DateFormatting.ts** - Extract these functions:
   - `formatDateFull()`
   - `formatDateMedium()`
   - `formatDateShort()`

3. **DatePickerSection.tsx** - Extract:
   - Check-in calendar popover (lines ~358-480)
   - Check-out calendar popover (lines ~480-540)
   - Range highlighting logic

4. **GuestSelector.tsx** - Extract:
   - Guest count dropdown (lines ~547-575)
   - Max guests validation

5. **PricingErrorDisplay.tsx** - Extract:
   - PricingStatusDisplay component (lines ~712-831)
   - Already has memo wrapper

**Risk Mitigation**:
- Extract utilities first (pure functions, easy to test)
- Keep UI components sharing the same context
- Maintain all existing props interfaces
- Add unit tests for extracted utilities before refactoring

### 3.2 BookingContext Optimization (DO NOT SPLIT)

**Why NOT to split**:
- 20+ state variables with circular interdependencies
- Date changes → pricing fetch → flow status → UI updates
- Session ID must be shared across all concerns
- Splitting would create complex prop drilling or multiple context subscriptions

**Better Approach**: Create specialized hooks without splitting the provider

```typescript
// New file: src/components/booking-v2/hooks/useBookingDates.ts
export function useBookingDates() {
  const {
    checkInDate,
    checkOutDate,
    setCheckInDate,
    setCheckOutDate,
    numberOfNights
  } = useBooking();

  return { checkInDate, checkOutDate, setCheckInDate, setCheckOutDate, numberOfNights };
}

// New file: src/components/booking-v2/hooks/useBookingPricing.ts
export function useBookingPricing() {
  const {
    pricingDetails,
    isPricingLoading,
    pricingError,
    fetchPricing
  } = useBooking();

  return { pricingDetails, isPricingLoading, pricingError, fetchPricing };
}

// New file: src/components/booking-v2/hooks/useBookingAvailability.ts
export function useBookingAvailability() {
  const {
    calendarUnavailableDates,
    isAvailable,
    fetchAvailability
  } = useBooking();

  return { calendarUnavailableDates, isAvailable, fetchAvailability };
}
```

**Benefits**:
- Cleaner imports in components (only import what's needed)
- Better code organization
- No risk of breaking existing functionality
- Can be done incrementally

### 3.3 LanguageProvider (DEFER)

**Current**: 916 lines
**Recommendation**: Do not refactor now

**Reasons to defer**:
- Tightly coupled to Next.js router
- Complex ref-based optimizations that work correctly
- Performance metrics tracking spread across functions
- Language detection and cache are already well-separated
- High risk of introducing bugs

**Future consideration**: Only refactor if planning a router abstraction layer.

---

## Phase 4: Ongoing Improvements

### 4.1 Logger Migration

**Current State**:
- 7 files use the logger system
- 144 files use console.* (1,279 calls)
- Logger is well-designed with namespaces and levels

**Migration Priority** (by impact):

| Priority | File | Console Calls |
|----------|------|---------------|
| High | `src/contexts/BookingContext.tsx` | 89 |
| High | `src/app/booking/check/[slug]/[[...path]]/page.tsx` | 34 |
| High | `src/app/booking/success/actions.ts` | 22 |
| High | `src/app/admin/bookings/actions.ts` | 18 |
| Medium | Admin action files | 10-15 each |
| Low | Utility files | 1-5 each |

**Migration Pattern**:

```typescript
// Before:
console.log('[functionName] message with context');
console.error('[functionName] Error:', error);

// After:
import { loggers } from '@/lib/logger';

loggers.booking.info('message with context', { additionalData });
loggers.booking.error('Error description', error, { additionalData });
```

**Logger Namespace Mapping**:

| Code Area | Logger Namespace |
|-----------|------------------|
| Booking flow | `loggers.booking` |
| Booking context | `loggers.bookingContext` |
| Booking API calls | `loggers.bookingAPI` |
| Availability | `loggers.availability` |
| Pricing | `loggers.pricing` |
| Authentication | `loggers.auth` |
| Email | `loggers.email` |
| Admin operations | Create `loggers.admin` |

**Estimated Effort**: 8-10 hours for complete migration

### 4.2 Firebase Admin Facade Simplification

**Current**: `firebaseAdmin.ts` re-exports from `firebaseAdminSafe.ts` with eager initialization

**Improvement**:
```typescript
// Simplified src/lib/firebaseAdmin.ts
export {
  initializeFirebaseAdminSafe as initializeFirebaseAdmin,
  getFirestoreSafe as getDbAdmin,
  getFirestoreSafe as db,
  getFirestoreSafe as dbAdmin,
  getAuthSafe as getAuthAdmin
} from './firebaseAdminSafe';
```

---

## What NOT To Do

These were considered but **rejected after investigation**:

### Do NOT Split BookingContext

**Why**: Circular dependencies make splitting impractical
- Date changes trigger pricing fetches
- Pricing updates affect flow status
- Flow status affects UI rendering
- Session ID must be shared

### Do NOT Consolidate All Firebase Admin Files

**Why**: Runtime isolation is required
- `firebaseAdminNode.ts` uses session cookie APIs that **only work in Node.js**
- It's imported via dynamic imports to isolate this runtime requirement
- `firebaseAdminPricing.ts` has promise-caching that prevents race conditions

### Do NOT Create Shared Amenities Hook

**Why**: Unnecessary - only one amenities component is actually used
- `amenities-list.tsx` uses pre-loaded structured data from overrides
- The other 3 components are completely unused dead code
- No runtime Firestore fetching is needed for amenities

### Do NOT Refactor LanguageProvider

**Why**: High risk, low reward
- Complex ref-based optimizations work correctly
- Tightly coupled to Next.js router
- Detection and cache modules are already well-separated

---

## Testing Checklist

### After Phase 1 (Safe Deletions)

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] Property pages render correctly
- [ ] Pricing API (`/api/check-pricing`) works
- [ ] No console errors in browser

### After Phase 2 (V1 Booking Removal)

- [ ] `npm run build` succeeds
- [ ] Hero section renders with booking widget
- [ ] Date selection in hero works
- [ ] "Check Availability" redirects to booking page
- [ ] Complete booking flow works (V2)
- [ ] Hold booking flow works
- [ ] Contact host flow works
- [ ] Booking success page renders
- [ ] Booking cancel page renders

### After Phase 3 (Component Refactoring)

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] Date picker opens and closes correctly
- [ ] Date range selection works
- [ ] Unavailable dates are disabled
- [ ] Guest count selection works
- [ ] Pricing errors display correctly
- [ ] "Extend stay" suggestions work
- [ ] Mobile responsive behavior unchanged

---

## File Reference

### Files to DELETE (Phase 1)

```
src/components/property/amenities-section.tsx
src/components/property/amenities-display.tsx
src/components/property/amenities-from-references.tsx
src/app/api/check-pricing-v2/route.ts
src/app/api/check-pricing-availability/route.ts
src/app/api/reset-price-cache/route.ts
src/lib/firebaseAdminDebug.ts
src/lib/firebaseAdminNew.ts
```

### Files to DELETE (Phase 2)

```
src/components/booking/  (entire directory)
```

### Files to CREATE (Phase 2)

```
src/components/booking-widget/BookingWidget.tsx
src/components/booking-widget/index.ts
```

### Files to MODIFY (Phase 2)

```
src/components/homepage/hero-section.tsx  (update import)
src/lib/server/pricing-data.ts  (remove firebaseAdminNew import)
src/app/api/startup-check/route.ts  (remove firebaseAdminNew import)
```

### Files to REFACTOR (Phase 3)

```
src/components/booking-v2/components/DateAndGuestSelector.tsx  (split)
src/components/booking-v2/contexts/BookingProvider.tsx  (add specialized hooks)
```

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-04 | Initial document created from verified investigation | Claude |
