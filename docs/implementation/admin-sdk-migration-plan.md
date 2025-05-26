# Admin SDK Migration Plan

**Created**: 2025-05-26  
**Backup Branch**: `backup-before-admin-sdk-migration-20250526-105501`  
**Current Commit**: `43a065d`

## Overview

This plan details the migration from Firebase Client SDK to Admin SDK for all server-side operations in the RentalSpot-Builder application. The primary goal is to improve security, performance, and reliability in cloud deployments.

## Current State Analysis

### Problems with Current Implementation
1. **Hero Image Fetch Fails**: `getPropertyHeroImage()` uses Client SDK in server components, causing auth failures
2. **Security Risk**: Client credentials exposed in server-side code
3. **Mixed SDK Usage**: Some APIs use Admin SDK, others use Client SDK
4. **No Auth Context**: Server components can't verify permissions

### Working Patterns to Replicate
1. **Pricing APIs**: Successfully use Admin SDK via `getFirestoreForPricing()`
2. **Pattern Location**: `/lib/firebaseAdminPricing.ts`
3. **API Routes**: `/api/check-pricing`, `/api/check-availability` work perfectly

## Migration Strategy: Unified Property Fetch

### Phase 1: Create Admin SDK Infrastructure

#### Task 1.1: Create Unified Property Data Service
**File**: `/lib/server/property-data.ts`
```typescript
// Core function to fetch all property data in one call
export async function getCompletePropertyData(slug: string, options?: {
  includeOverrides?: boolean;
  includeTemplate?: boolean;
  includeAmenities?: boolean;
}) {
  const db = await getFirestoreForPricing();
  
  // Parallel fetch all needed data
  const results = await Promise.all([
    // Always fetch property
    db.collection('properties').doc(slug).get(),
    // Conditionally fetch overrides
    options?.includeOverrides ? db.collection('propertyOverrides').doc(slug).get() : null,
    // Add more as needed
  ]);
  
  return {
    property: results[0].data(),
    overrides: results[1]?.data(),
    heroImage: extractHeroImage(results[1]?.data()),
    theme: results[0].data()?.themeId,
  };
}
```

#### Task 1.2: Create Migration Helpers
**File**: `/lib/server/property-admin-helpers.ts`
- `getPropertyWithAdmin(slug)` - Drop-in replacement for current function
- `getPropertyOverridesWithAdmin(slug)` - Admin SDK version
- `getPropertyHeroImageWithAdmin(slug)` - Solves the hero image problem

### Phase 2: Migrate Server Components

#### Task 2.1: Booking Check Page
**File**: `/app/booking/check/[slug]/page.tsx`
- Replace `getPropertyBySlug()` with `getCompletePropertyData()`
- Remove separate `getPropertyHeroImage()` call
- Update data destructuring

#### Task 2.2: Property Pages
**File**: `/app/properties/[slug]/[[...path]]/page.tsx`
- Replace multiple Client SDK calls with single `getCompletePropertyData()`
- Update `getPropertyOverrides()` export to use Admin SDK

#### Task 2.3: Homepage
**File**: `/app/page.tsx`
- Update property fetching to use Admin SDK

### Phase 3: Migrate Utility Functions

#### Task 3.1: Update property-utils.ts
**File**: `/lib/property-utils.ts`
- Create server-side versions with `WithAdmin` suffix
- Mark client-side versions as deprecated
- Add migration comments

#### Task 3.2: Update Services
**Priority Files**:
- `/services/bookingService.ts`
- `/services/pricingService.ts`
- `/services/availabilityService.ts`

### Phase 4: Migrate Server Actions

#### Task 4.1: Booking Actions
**Files in**: `/app/actions/`
- `booking-actions.ts`
- `createHoldBookingAction.ts`
- `createInquiryAction.ts`

### Phase 5: Testing & Validation

#### Task 5.1: Create Test Suite
**File**: `/scripts/test-admin-sdk-migration.ts`
- Test property data fetching
- Verify hero image loading
- Check performance improvements

#### Task 5.2: Production Testing
- Deploy to staging environment
- Test all property pages
- Verify booking flow
- Check hero image display

## Implementation Details

### 1. Admin SDK Initialization Pattern
Use existing working pattern from `/lib/firebaseAdminPricing.ts`:
```typescript
import { getFirestoreAdmin } from './firebaseAdminSafe';

let adminDbPromise: Promise<FirebaseFirestore.Firestore | null> | null = null;

export async function getFirestoreForPricing(): Promise<FirebaseFirestore.Firestore> {
  if (!adminDbPromise) {
    adminDbPromise = getFirestoreAdmin();
  }
  
  const db = await adminDbPromise;
  if (!db) {
    throw new Error('Failed to initialize Firestore Admin');
  }
  
  return db;
}
```

### 2. Error Handling Pattern
Follow the safe pattern from working APIs:
```typescript
try {
  const data = await getCompletePropertyData(slug);
  if (!data.property) {
    return notFound();
  }
  return data;
} catch (error) {
  console.error('[PropertyFetch] Error:', error);
  // Graceful fallback
}
```

### 3. Caching Strategy
Use Next.js caching for server-side data:
```typescript
import { unstable_cache } from 'next/cache';

const getCachedPropertyData = unstable_cache(
  async (slug: string) => getCompletePropertyData(slug),
  ['property-data'],
  { revalidate: 300 } // 5 minutes
);
```

## Migration Checklist

### Pre-Migration
- [ ] Create backup branch ✅
- [ ] Document current state
- [ ] Set up test environment
- [ ] Review Firestore security rules

### Phase 1: Infrastructure
- [ ] Create `/lib/server/property-data.ts`
- [ ] Create `/lib/server/property-admin-helpers.ts`
- [ ] Add TypeScript interfaces for return types
- [ ] Create unit tests

### Phase 2: Server Components
- [ ] Migrate booking check page
- [ ] Migrate property pages
- [ ] Migrate homepage
- [ ] Update metadata generation

### Phase 3: Utilities
- [ ] Update property-utils.ts
- [ ] Migrate services
- [ ] Update helper functions

### Phase 4: Server Actions
- [ ] Migrate booking actions
- [ ] Migrate inquiry actions
- [ ] Update hold/checkout actions

### Phase 5: Testing
- [ ] Run local tests
- [ ] Test in development
- [ ] Deploy to staging
- [ ] Production verification

### Post-Migration
- [ ] Remove deprecated Client SDK imports
- [ ] Update documentation
- [ ] Monitor error logs
- [ ] Performance benchmarking

## Rollback Plan

If issues occur:
1. `git checkout backup-before-admin-sdk-migration-20250526-105501`
2. Deploy previous version
3. Investigate issues
4. Plan fixes

## Success Criteria

1. **Hero Image Display**: Hero images load correctly on booking pages
2. **Performance**: Reduced server-side rendering time
3. **Security**: No client credentials in server code
4. **Reliability**: No auth-related failures in production
5. **Maintainability**: Single source of truth for property data fetching

## Key Files Reference

### Existing Admin SDK Success Stories
- `/lib/firebaseAdminPricing.ts` - The pattern to follow
- `/api/check-pricing/route.ts` - Working API example
- `/api/check-availability/route.ts` - Another working example

### Files to Create
- `/lib/server/property-data.ts` - Main unified fetch
- `/lib/server/property-admin-helpers.ts` - Helper functions
- `/scripts/test-admin-sdk-migration.ts` - Test suite

### Files to Modify (Priority Order)
1. `/app/booking/check/[slug]/page.tsx` - Fix hero image issue
2. `/app/properties/[slug]/[[...path]]/page.tsx` - Main property pages
3. `/lib/property-utils.ts` - Core utilities
4. `/app/page.tsx` - Homepage

## Notes

- Always use `getFirestoreForPricing()` for Admin SDK access
- Keep Client SDK only for client components
- Test thoroughly before removing deprecated functions
- Monitor Firebase usage to ensure no increase in reads