# Firestore Production Readiness Guide

**Created**: 2026-02-04
**Status**: Phase 1 Complete, Phase 2 Pending
**Last Updated**: 2026-02-04
**Author**: Claude (verified against codebase)

---

## Executive Summary

This document provides a verified, step-by-step guide for preparing the RentalSpot-Builder Firestore environment for production. All recommendations have been validated against the actual codebase to ensure they won't break existing functionality.

### Overall Assessment

| Category | Status | Priority | Risk Level |
|----------|--------|----------|------------|
| Security Rules | **CRITICAL ISSUES** | P0 | High |
| Unprotected Routes | ✅ RESOLVED (Phase 1) | - | None |
| Query Performance | Good | - | None |
| Indexing | Adequate | Low | None |
| Logging | Needs Improvement | P2 | Low |

### Quick Reference - Implementation Phases

| Phase | Description | Risk | Effort | Status |
|-------|-------------|------|--------|--------|
| Phase 1 | Remove unprotected `/manage-pricing` | Zero | 5 min | ✅ COMPLETED |
| Phase 2 | Tighten safe security rules | Low | 15 min | Pending |
| Phase 3 | Deploy and verify rules | Low | 30 min | Pending |
| Phase 4 | Minor performance optimization | Low | 1 hr | Optional |
| Phase 5 | Logging migration | Low | 8-10 hrs | Optional |

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [Security Findings](#security-findings)
3. [Performance Analysis](#performance-analysis)
4. [Implementation Phases](#implementation-phases)
5. [Testing Checklists](#testing-checklists)
6. [Future Considerations](#future-considerations)
7. [Reference Information](#reference-information)

---

## Current Architecture

### Firestore Collections Overview

| Collection | Purpose | Read Access | Write Access | Security Status |
|------------|---------|-------------|--------------|-----------------|
| `properties` | Property listings | Public | **OPEN (should be admin)** | **INSECURE** |
| `bookings` | Booking records | Public | Public create, restricted update | By Design |
| `availability` | Monthly availability | Public | **OPEN (should be restricted)** | **INSECURE** |
| `inquiries` | Guest inquiries | Restricted | Public create | OK |
| `users` | User profiles | Self/Admin | Self/Admin | OK |
| `reviews` | Property reviews | Public | Auth create, admin edit | OK |
| `seasonalPricing` | Seasonal price rules | Public | Owner/Admin | OK |
| `dateOverrides` | Date-specific pricing | Public | **OPEN (should be owner/admin)** | **INSECURE** |
| `priceCalendars` | Pre-calculated prices | Public | **OPEN (should be admin)** | **INSECURE** |
| `minimumStayRules` | Minimum stay rules | Public | Owner/Admin | OK |
| `coupons` | Discount codes | Public | Admin | OK |
| `appConfig` | App configuration | Public | Admin | OK |

### SDK Usage Pattern

The application uses a **hybrid SDK approach**:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Browser/Client          │  Server Actions    │  Cron Jobs  │
│  (React Components)      │  ("use server")    │  (API Routes)│
├─────────────────────────────────────────────────────────────┤
│  Firebase Client SDK     │  Firebase Client   │  Firebase    │
│  (firestore rules apply) │  SDK (rules apply) │  Admin SDK   │
│                          │                    │  (bypasses   │
│                          │                    │   rules)     │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight**: Server Actions use Client SDK, so Firestore security rules still apply to them.

### Composite Indexes (Current)

**File**: `/firestore.indexes.json`

| Collection | Fields | Purpose |
|------------|--------|---------|
| `seasonalPricing` | propertyId, enabled | Query active seasonal rules |
| `bookings` | propertyId, status | Query bookings by property |
| `dateOverrides` | propertyId, date | Query date overrides |
| `priceCalendars` | propertyId, year, month | Query price calendars |

---

## Security Findings

### CRITICAL: Unprotected `/manage-pricing` Routes

**Severity**: CRITICAL
**Discovery Date**: 2026-02-04
**Status**: Pending removal

#### Problem Description

The `/manage-pricing` directory contains 12 files that allow **unauthenticated users** to directly modify pricing data in Firestore:

```
src/app/manage-pricing/
├── page.tsx                              # Main pricing page (NO AUTH)
├── client-props.tsx                      # Property fetching (NO AUTH)
├── seasons/new/page.tsx                  # Create seasonal pricing (NO AUTH)
├── date-overrides/new/page.tsx           # Create date overrides (NO AUTH)
└── _components/
    ├── client-seasonal-pricing-table.tsx # Edit/delete seasons (NO AUTH)
    ├── client-date-overrides-table.tsx   # Edit/delete overrides (NO AUTH)
    ├── client-price-calendar-manager.tsx # Generate calendars (NO AUTH)
    └── ... (5 more files)
```

#### Evidence

**Middleware** (`src/middleware.ts:31-34`):
```typescript
// Only /admin routes are protected
if (pathname.startsWith('/admin')) {
  return await handleAdminRoute(request);
}
// /manage-pricing is NOT protected
```

**Client-side Firestore writes** (`client-date-overrides-table.tsx:126-176`):
```typescript
// Direct Firestore write with NO authentication
await updateDoc(overrideRef, {
  available: !currentValue,
  updatedAt: Timestamp.now()
});
```

#### Impact

- Any user can modify pricing for ANY property
- No audit trail of who made changes
- Competitors can manipulate prices
- Revenue loss through price manipulation

#### Solution

Delete the entire directory. The protected `/admin/pricing` route provides identical functionality with proper authentication.

---

### CRITICAL: Overly Permissive Security Rules

**Severity**: CRITICAL
**File**: `/firestore.rules`

#### Rules That Must Be Fixed

**1. Properties Collection** (lines 27-29):
```javascript
// CURRENT - DANGEROUS
allow create: if true; // TEMPORARY: Allow any creation for development
allow update: if true; // TEMPORARY: Allow any updates for development
allow delete: if true; // TEMPORARY: Allow any deletion for development
```

**Impact**: Anyone can create, modify, or delete ANY property.

**2. Date Overrides Collection** (line 163):
```javascript
// CURRENT - DANGEROUS
allow write: if true; // TEMPORARY
```

**Impact**: Anyone can manipulate date-specific pricing.

**3. Price Calendars Collection** (line 195):
```javascript
// CURRENT - DANGEROUS
allow write: if true;
```

**Impact**: Anyone can corrupt pre-calculated price data.

**4. Availability Collection** (lines 66-71):
```javascript
// CURRENT - PROBLEMATIC
allow create: if true || (isSignedIn() && ...);
allow update: if true || (isSignedIn() && ...);
```

**Impact**: The `true ||` makes the rest of the condition irrelevant.

---

### Rules That Must Stay Open (By Design)

These rules cannot be tightened without significant code refactoring:

#### Bookings Collection

**Current Rule**:
```javascript
allow create: if true;
allow update: if request.resource.data.paymentInfo != null || ...;
```

**Why It Must Stay Open**:
1. Guests create bookings without authentication (intentional UX)
2. Server Actions use Client SDK, not Admin SDK
3. Stripe webhooks update bookings via Client SDK

**Future Fix** (requires code changes):
- Refactor booking operations to use Admin SDK
- Or implement session tokens for booking flows

#### Availability Collection (Partial)

**Why Partially Open**:
- Booking confirmations update availability
- Uses Client SDK from server actions

**Can Be Improved**:
- Add validation that only booking-related updates are allowed
- Require that changes reference a valid booking ID

---

## Performance Analysis

### Query Patterns - VERIFIED GOOD

The codebase uses optimal query patterns:

| Pattern | Location | Status |
|---------|----------|--------|
| `Promise.all()` batching | `check-pricing/route.ts:110-115` | Optimal |
| `in()` query batching (30 items) | `bookingService.ts:792-805` | Optimal |
| `writeBatch()` atomic writes | `bookingService.ts:675-701` | Optimal |
| Document ID lookups | Throughout | Optimal |

**Conclusion**: No N+1 query issues. Queries scale with months, not individual items.

### Minor Optimization Opportunity

**File**: `src/lib/availability-service.ts`
**Current**: Sequential document fetches (O(n) queries)
**Optimized**: Batch fetch with `getAll()` (O(1) query)

**Impact**: For 12-month availability checks, reduces from 12 queries to 1.

---

### Logging Analysis

**Current State**:
- 1,279 `console.*` calls across 144 files
- No structured logging in most files
- Excessive debug logging in production paths

**High-Impact Files**:

| File | Console Calls | Priority |
|------|---------------|----------|
| `BookingContext.tsx` | 89 | High |
| `bookingService.ts` | 50+ | High |
| Booking pages | 34+ | Medium |
| Admin actions | 10-18 each | Low |

**Impact**:
- Increased Cloud Run logging costs
- Slower execution
- Noise in production logs

**Solution**: Migrate to structured logger system (see Phase 5).

---

## Implementation Phases

### Phase 1: Remove Unprotected Routes

**Status**: ✅ COMPLETED (2026-02-04, commit b57ae03)
**Risk**: ZERO
**Effort**: 5 minutes
**Dependencies**: None

#### Step 1.1: Verify No External Dependencies

Run these commands to confirm `/manage-pricing` is self-contained:

```bash
# Search for any external links to manage-pricing
grep -r "manage-pricing" src/ --include="*.tsx" --include="*.ts" | grep -v "src/app/manage-pricing"
```

**Expected Result**: No matches (only self-references within the directory)

#### Step 1.2: Delete the Directory

```bash
rm -rf src/app/manage-pricing/
```

#### Step 1.3: Verify Build

```bash
npm run build
```

**Expected Result**: Build succeeds with no errors

#### Step 1.4: Commit

```bash
git add -A
git commit -m "security: remove unprotected /manage-pricing routes

These routes allowed unauthenticated users to modify pricing data.
The protected /admin/pricing route provides the same functionality.

BREAKING CHANGE: /manage-pricing URLs will return 404
Use /admin/pricing instead (requires authentication)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

#### Step 1.5: Update Status

- [ ] Mark Phase 1 as COMPLETED in this document

---

### Phase 2: Tighten Safe Security Rules

**Risk**: LOW
**Effort**: 15 minutes
**Dependencies**: Phase 1 completed

#### Step 2.1: Create Backup of Current Rules

```bash
cp firestore.rules firestore.rules.backup.$(date +%Y%m%d)
```

#### Step 2.2: Update Properties Collection Rules

**File**: `firestore.rules`

**Find** (lines 27-35):
```javascript
match /properties/{propertySlug} {
  allow read: if true; // Publicly readable
  allow create: if true; // TEMPORARY: Allow any creation for development
  allow update: if true; // TEMPORARY: Allow any updates for development
  allow delete: if true; // TEMPORARY: Allow any deletion for development

  // Original rules (commented out for development)
  // allow create: if isSignedIn(); // Allow authenticated users to create
  // allow update: if isOwner(propertySlug) || isAdmin();
  // allow delete: if isOwner(propertySlug) || isAdmin();
```

**Replace with**:
```javascript
match /properties/{propertySlug} {
  allow read: if true; // Publicly readable
  // Production rules - admin only for all write operations
  allow create: if isAdmin();
  allow update: if isAdmin();
  allow delete: if isAdmin();
```

#### Step 2.3: Update Date Overrides Collection Rules

**Find** (lines 156-168):
```javascript
match /dateOverrides/{overrideId} {
  allow read: if true; // Public read for price calculations

  // TEMPORARY - Allow all writes for development
  // In production, restore the commented-out rule below
  allow write: if true;

  // Original rule - uncomment for production
  // allow write: if isSignedIn() &&
  //             (isOwner(extractPropertyId(overrideId)) || isAdmin());
}
```

**Replace with**:
```javascript
match /dateOverrides/{overrideId} {
  allow read: if true; // Public read for price calculations
  // Production rules - require authentication and ownership
  allow create: if isSignedIn() &&
                (isOwner(request.resource.data.propertyId) || isAdmin());
  allow update, delete: if isSignedIn() &&
                (isOwner(resource.data.propertyId) || isAdmin());
}
```

#### Step 2.4: Update Price Calendars Collection Rules

**Find** (lines 189-202):
```javascript
match /priceCalendars/{calendarId} {
  allow read: if true; // Public read for price lookups
  // Allow all writes for now to fix the immediate issue
  // In production, this should be locked down more tightly
  allow write: if true;
```

**Replace with**:
```javascript
match /priceCalendars/{calendarId} {
  allow read: if true; // Public read for price lookups
  // Production rules - admin only (calendars are generated by system)
  allow write: if isAdmin();
}
```

#### Step 2.5: Update Availability Collection Rules

**Find** (lines 61-72):
```javascript
match /availability/{documentId} {
  allow read: if true; // Public read access

  // Fix for new documents using request.resource instead of resource
  allow create: if true || (isSignedIn() &&
      (isOwner(request.resource.data.propertyId) || isAdmin()));

  // For existing documents
  allow update: if true || (isSignedIn() &&
      (isOwner(resource.data.propertyId) || isAdmin()));
}
```

**Replace with**:
```javascript
match /availability/{documentId} {
  allow read: if true; // Public read access

  // Availability updates come from:
  // 1. Booking confirmations (server actions with Client SDK)
  // 2. Admin operations
  // 3. Cron jobs (use Admin SDK, bypass rules)

  // For now, keep open for booking flow to work
  // TODO: Refactor bookingService to use Admin SDK, then tighten
  allow create: if true;
  allow update: if true;

  // Future secure version (after Admin SDK refactoring):
  // allow create: if isSignedIn() &&
  //     (isOwner(request.resource.data.propertyId) || isAdmin());
  // allow update: if isSignedIn() &&
  //     (isOwner(resource.data.propertyId) || isAdmin());
}
```

**Note**: Availability rules stay open for now - see [Future Considerations](#availability-rules-refactoring).

#### Step 2.6: Verify Rules Syntax

```bash
# Use Firebase CLI to validate rules
firebase emulators:start --only firestore

# Or deploy to a test project first
firebase deploy --only firestore:rules --project YOUR_TEST_PROJECT
```

#### Step 2.7: Commit Rules Changes

```bash
git add firestore.rules
git commit -m "security: tighten Firestore security rules for production

Changes:
- properties: Restrict writes to admin only
- dateOverrides: Require authentication and ownership
- priceCalendars: Restrict writes to admin only
- availability: Document current state, plan for future refactoring

Note: availability rules remain open pending bookingService refactoring
to use Admin SDK instead of Client SDK.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Phase 3: Deploy and Verify Rules

**Risk**: LOW
**Effort**: 30 minutes
**Dependencies**: Phase 2 completed

#### Step 3.1: Deploy Rules to Firebase

```bash
firebase deploy --only firestore:rules
```

#### Step 3.2: Verify Admin Operations Still Work

Test in browser (logged in as admin):

- [ ] Go to `/admin/pricing`
- [ ] Select a property
- [ ] Create a new seasonal pricing rule
- [ ] Toggle the rule on/off
- [ ] Delete the rule
- [ ] Create a date override
- [ ] Delete the date override
- [ ] Generate price calendars

#### Step 3.3: Verify Public Booking Flow Still Works

Test in incognito/private window (NOT logged in):

- [ ] Go to a property page
- [ ] Select dates in the booking widget
- [ ] Click "Check Availability"
- [ ] Fill in guest details
- [ ] Create a pending booking (don't pay)
- [ ] Verify booking appears in admin panel

#### Step 3.4: Verify Hold Flow Still Works

- [ ] Create a hold booking
- [ ] Verify dates are blocked
- [ ] Wait for hold to expire OR cancel manually
- [ ] Verify dates are released

#### Step 3.5: Update Status

- [ ] Mark Phase 3 as COMPLETED in this document

---

### Phase 4: Performance Optimization (Optional)

**Risk**: LOW
**Effort**: 1 hour
**Dependencies**: None (can be done independently)

#### Step 4.1: Optimize Availability Service

**File**: `src/lib/availability-service.ts`

**Current Code** (lines 54-63):
```typescript
for (const [monthKey, dates] of Object.entries(monthGroups)) {
  const docId = `${propertyId}_${monthKey}`;
  const doc = await db.collection('availability').doc(docId).get();

  if (!doc.exists) {
    console.log(`[AvailabilityService] No availability document for ${docId}, considering dates available`);
    continue;
  }
  // ... process doc
}
```

**Optimized Code**:
```typescript
// Batch fetch all month documents in a single query
const docIds = Object.keys(monthGroups).map(monthKey => `${propertyId}_${monthKey}`);
const docRefs = docIds.map(docId => db.collection('availability').doc(docId));

// Single batch fetch instead of N sequential fetches
const docs = await db.getAll(...docRefs);

// Process results
docs.forEach((doc, index) => {
  const monthKey = Object.keys(monthGroups)[index];
  const dates = monthGroups[monthKey];

  if (!doc.exists) {
    console.log(`[AvailabilityService] No availability document for ${docIds[index]}, considering dates available`);
    return;
  }

  const data = doc.data();
  const availableMap = data?.available || {};
  const holdsMap = data?.holds || {};

  dates.forEach(date => {
    const day = date.getDate();
    const dateStr = format(date, 'yyyy-MM-dd');
    const isUnavailable = availableMap[day] === false || !!holdsMap[day];

    if (isUnavailable) {
      unavailableDates.push(dateStr);
    }
  });
});
```

**Expected Improvement**: For 12-month lookups, reduces from 12 sequential queries to 1 batch query.

#### Step 4.2: Test Performance

```bash
# Before optimization - measure response time
curl -w "@curl-format.txt" -X POST http://localhost:3000/api/check-availability \
  -H "Content-Type: application/json" \
  -d '{"propertyId": "test-property", "checkIn": "2026-03-01", "checkOut": "2026-03-15"}'

# After optimization - compare response time
```

#### Step 4.3: Commit

```bash
git add src/lib/availability-service.ts
git commit -m "perf: optimize availability service with batch fetch

Replaced sequential document fetches with single batch query
using Admin SDK's getAll() method.

Performance improvement: O(n) queries → O(1) query
For 12-month lookups: 12 queries → 1 query

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Phase 5: Logging Migration (Optional)

**Risk**: LOW
**Effort**: 8-10 hours
**Dependencies**: None

This phase is documented in `docs/ARCHITECTURE_CLEANUP_GUIDE.md` Phase 4.

#### Summary

Migrate 1,279 `console.*` calls to structured logger:

```typescript
// Before
console.log('[functionName] message with context');
console.error('[functionName] Error:', error);

// After
import { loggers } from '@/lib/logger';
loggers.booking.info('message with context', { additionalData });
loggers.booking.error('Error description', error, { additionalData });
```

#### Priority Files

| File | Calls | Namespace |
|------|-------|-----------|
| `BookingContext.tsx` | 89 | `loggers.bookingContext` |
| `bookingService.ts` | 50+ | `loggers.booking` |
| Booking pages | 34+ | `loggers.booking` |

---

## Testing Checklists

### Pre-Deployment Checklist

- [ ] All phases completed and committed
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (if tests exist)
- [ ] Rules deployed to test/staging project first
- [ ] Manual testing completed per phase

### Post-Deployment Monitoring

Monitor for 24-48 hours after deploying rule changes:

- [ ] Check Firebase Console for security rule denials
- [ ] Monitor Cloud Run logs for Firestore errors
- [ ] Verify booking flow completion rate unchanged
- [ ] Check admin operations work for all users

### Rollback Procedure

If issues are detected:

```bash
# Restore backup rules
cp firestore.rules.backup.YYYYMMDD firestore.rules
firebase deploy --only firestore:rules

# Or revert git commit
git revert HEAD
firebase deploy --only firestore:rules
```

---

## Future Considerations

### Availability Rules Refactoring

**Current State**: Availability collection has open write rules because booking operations use Client SDK.

**Recommended Future State**: Refactor to use Admin SDK

**Required Changes**:

1. **Create Admin SDK booking service**:
   ```
   src/lib/server/booking-admin-service.ts
   ```

2. **Update booking actions** to use Admin SDK:
   - `createHoldBookingAction.ts`
   - `bookingService.ts` availability updates

3. **Benefits**:
   - Rules can be fully locked down
   - Better audit trail
   - Server-side validation

4. **Effort**: 4-6 hours

### Booking Collection Security

**Current Vulnerability**:
```javascript
allow update: if request.resource.data.paymentInfo != null || ...;
```

This allows anyone to update any booking if they include `paymentInfo` field.

**Fix Options**:

1. **Short-term**: Add field-level validation
   ```javascript
   allow update: if request.resource.data.paymentInfo != null &&
                 request.resource.data.paymentInfo.stripePaymentIntentId != null;
   ```

2. **Long-term**: Move to Admin SDK for payment updates

### Rate Limiting

Consider adding Firebase App Check or Cloud Armor for:
- Booking creation (prevent spam)
- Availability checks (prevent scraping)
- Price calendar requests (prevent abuse)

---

## Reference Information

### File Locations

| Purpose | Path |
|---------|------|
| Security Rules | `/firestore.rules` |
| Indexes | `/firestore.indexes.json` |
| Firebase Config | `/firebase.json` |
| Client SDK | `/src/lib/firebase.ts` |
| Admin SDK (Safe) | `/src/lib/firebaseAdminSafe.ts` |
| Admin SDK (Pricing) | `/src/lib/firebaseAdminPricing.ts` |
| Booking Service | `/src/services/bookingService.ts` |
| Availability Service | `/src/lib/availability-service.ts` |
| Middleware | `/src/middleware.ts` |

### Related Documentation

- `docs/ARCHITECTURE_CLEANUP_GUIDE.md` - General codebase cleanup
- `docs/implementation/firestore-pricing-structure.md` - Pricing data model
- `docs/implementation/property-schema.md` - Property data model
- `docs/guides/firebase-admin-setup.md` - Admin SDK setup guide

### Useful Commands

```bash
# Deploy only rules
firebase deploy --only firestore:rules

# Deploy only indexes
firebase deploy --only firestore:indexes

# Start emulator for testing
firebase emulators:start --only firestore

# View current rules
firebase firestore:rules:get

# Check for rule issues
firebase emulators:exec "npm test" --only firestore
```

---

## Progress Tracking

### Implementation Status

| Phase | Description | Status | Date | Notes |
|-------|-------------|--------|------|-------|
| Phase 1 | Remove `/manage-pricing` | ✅ COMPLETED | 2026-02-04 | 13 files deleted, commit b57ae03 |
| Phase 2 | Tighten security rules | Pending | - | - |
| Phase 3 | Deploy and verify | Pending | - | - |
| Phase 4 | Performance optimization | Optional | - | - |
| Phase 5 | Logging migration | Optional | - | - |

### Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-04 | Phase 1 completed: Removed unprotected /manage-pricing routes | Claude |
| 2026-02-04 | Initial document created from verified investigation | Claude |

---

## Appendix A: Complete Security Rules (Target State)

After completing Phases 1-3, rules should look like this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(propertyId) {
      return isSignedIn() &&
             exists(/databases/$(database)/documents/properties/$(propertyId)) &&
             get(/databases/$(database)/documents/properties/$(propertyId)).data.ownerId == request.auth.uid;
    }

    function isAdmin() {
      return isSignedIn() &&
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // --- Properties Collection ---
    match /properties/{propertySlug} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // --- Property Overrides ---
    match /propertyOverrides/{propertyId} {
      allow read: if true;
      allow write: if isOwner(propertyId) || isAdmin();
    }

    // --- Website Templates ---
    match /websiteTemplates/{templateId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- Availability Collection ---
    // TODO: Refactor booking service to Admin SDK, then tighten these rules
    match /availability/{documentId} {
      allow read: if true;
      allow create: if true;  // Required for booking flow
      allow update: if true;  // Required for booking flow
    }

    // --- Bookings Collection ---
    match /bookings/{bookingId} {
      allow create: if true;  // Guest booking creation
      allow read: if true;    // Booking confirmation pages
      allow update: if request.resource.data.paymentInfo != null ||
                    (isSignedIn() &&
                     (resource.data.guestInfo.userId == request.auth.uid ||
                      isOwner(resource.data.propertyId) ||
                      isAdmin()));
    }

    // --- Users Collection ---
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId || isAdmin();
    }

    // --- Reviews Collection ---
    match /reviews/{reviewId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
    }

    // --- Settings Collection ---
    match /settings/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- Sync Calendars Collection ---
    match /syncCalendars/{documentId} {
      allow read, write: if isSignedIn() &&
                         (isOwner(resource.data.propertyId) || isAdmin());
    }

    // --- Coupons Collection ---
    match /coupons/{couponId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- App Config ---
    match /appConfig/{configDocId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- Inquiries Collection ---
    match /inquiries/{inquiryId} {
      allow create: if true;
      allow read, update: if isSignedIn() &&
                         (resource.data.guestInfo.email == request.auth.token.email ||
                          isOwner(resource.data.propertySlug) ||
                          isAdmin());
    }

    // --- Seasonal Pricing Collection ---
    match /seasonalPricing/{seasonId} {
      allow read: if true;
      allow write: if isSignedIn() &&
                   (isOwner(resource.data.propertyId) || isAdmin());
    }

    // --- Date Overrides Collection ---
    match /dateOverrides/{overrideId} {
      allow read: if true;
      allow create: if isSignedIn() &&
                    (isOwner(request.resource.data.propertyId) || isAdmin());
      allow update, delete: if isSignedIn() &&
                    (isOwner(resource.data.propertyId) || isAdmin());
    }

    // --- Minimum Stay Rules Collection ---
    match /minimumStayRules/{ruleId} {
      allow read: if true;
      allow write: if isSignedIn() &&
                   (isOwner(resource.data.propertyId) || isAdmin());
    }

    // --- Holidays Collection ---
    match /holidays/{holidayId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- Pricing Templates Collection ---
    match /pricingTemplates/{templateId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // --- Price Calendars Collection ---
    match /priceCalendars/{calendarId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
```
