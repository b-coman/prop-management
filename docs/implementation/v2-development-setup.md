# V2 Development Environment Setup

**Document Version**: 1.0  
**Created**: May 31, 2025  
**Status**: Active  

## Overview

This document provides step-by-step instructions for setting up the V2 booking system development environment. The V2 system runs side-by-side with V1 using feature flags for safe development and testing.

## Prerequisites

✅ **Phase 0 Complete** - V2 directory structure and feature flags are set up  
✅ **Development Environment** - Node.js, npm, and TypeScript configured  
✅ **Database Access** - Firebase Admin SDK credentials configured  
✅ **Stripe Integration** - Test keys configured for payment testing  

## Quick Start

### 1. Enable V2 Development Mode

Add to your `.env.local` file:

```bash
# Enable V2 booking system
NEXT_PUBLIC_BOOKING_V2=true

# Optional: Enable enhanced debugging
NEXT_PUBLIC_DEBUG=true

# Optional: Enable V2 pricing (future enhancement)
NEXT_PUBLIC_PRICING_V2=false
```

### 2. Start Development Server

```bash
npm run dev
```

The application will run on `http://localhost:9002` with V2 enabled.

### 3. Access V2 Booking Pages

Navigate to any property booking page:
- `http://localhost:9002/properties/prahova-mountain-chalet/booking/check`
- `http://localhost:9002/properties/coltei-apartment-bucharest/booking/check`

The feature flag will automatically serve the V2 booking system.

## Feature Flag System

### Available Flags

| Flag | Purpose | Default | Environment Variable |
|------|---------|---------|---------------------|
| `BOOKING_V2` | Enable V2 booking system | `false` | `NEXT_PUBLIC_BOOKING_V2` |
| `PRICING_V2` | Enable V2 pricing features | `false` | `NEXT_PUBLIC_PRICING_V2` |
| `DEBUG_MODE` | Enhanced development logging | `dev=true` | `NEXT_PUBLIC_DEBUG` |

### Runtime Flag Checking

```typescript
import { FEATURES } from '@/config/features';

if (FEATURES.BOOKING_V2) {
  // V2 booking system
  return <BookingPageV2 property={property} />;
} else {
  // V1 booking system
  return <BookingPageV1 property={property} />;
}
```

### URL-Based Flag Override

For testing without changing environment variables:

```
?feature_booking_v2=true
?feature_debug=true
```

## V2 Directory Structure

```
src/components/booking-v2/
├── contexts/
│   ├── BookingProvider.tsx      # ✅ Core state management
│   └── index.ts                 # ✅ Context exports
├── components/
│   ├── DateAndGuestSelector.tsx # ✅ Enhanced date/guest picker
│   └── index.ts                 # ✅ Component exports
├── containers/
│   ├── BookingPageV2.tsx        # ✅ Main V2 page container
│   └── index.ts                 # ✅ Container exports
├── utils/
│   ├── date-utils.ts            # ✅ V2-specific date utilities
│   └── index.ts                 # ✅ Utility exports
└── index.ts                     # ✅ Main V2 export hub
```

## Development Workflow

### 1. Check V2 Dependencies

Before making changes to any file, check if it's used by V2:

```bash
# Analyze all V2 dependencies
npx tsx scripts/track-v2-dependencies.ts

# Check specific file
npx tsx scripts/track-v2-dependencies.ts --check src/services/availabilityService.ts
```

### 2. Working with V2 Components

Import V2 components from the main export hub:

```typescript
import { BookingPageV2, BookingProvider, DateAndGuestSelector } from '@/components/booking-v2';
```

### 3. Debugging V2 Issues

Enable comprehensive logging:

```bash
# In browser console
localStorage.setItem('debug', 'booking:*');

# Or via URL parameter
?debug=booking:*
```

Available debug namespaces:
- `booking:context` - BookingProvider state changes
- `booking:api` - API calls and responses
- `booking:validation` - Form and data validation
- `booking:interaction` - User interactions

### 4. Testing Both V1 and V2

```bash
# Test V1 (default)
NEXT_PUBLIC_BOOKING_V2=false npm run dev

# Test V2
NEXT_PUBLIC_BOOKING_V2=true npm run dev
```

## V2 Component Architecture

### State Management Flow

```
URL Parameters → BookingProvider → Components
     ↓               ↓                ↓
Session Storage ← State Updates ← User Actions
```

### API Integration

V2 preserves all existing API endpoints:
- ✅ `/api/check-availability` - Unchanged
- ✅ `/api/check-pricing` - Unchanged  
- ✅ `/api/webhooks/stripe` - Unchanged

### Form Integration

V2 reuses existing working form components:
- ✅ `BookingForm` - Full booking with Stripe
- ✅ `HoldForm` - Hold booking functionality
- ✅ `ContactHostForm` - Inquiry submission

## Common Development Tasks

### Adding New V2 Components

1. Create component in appropriate directory:
   ```
   src/components/booking-v2/components/NewComponent.tsx
   ```

2. Add proper file header:
   ```typescript
   /**
    * Component Name - Brief Description
    * 
    * @file-status: ACTIVE
    * @v2-role: CORE - Purpose in V2 system
    * @created: 2025-05-31
    * @description: Detailed description
    * @dependencies: List key dependencies
    */
   ```

3. Export from index file:
   ```typescript
   export { NewComponent } from './NewComponent';
   ```

4. Update dependency tracking:
   ```bash
   npx tsx scripts/track-v2-dependencies.ts
   ```

### Modifying Shared Dependencies

Files used by both V1 and V2 require careful handling:

1. Check impact:
   ```bash
   npx tsx scripts/track-v2-dependencies.ts --check src/services/targetFile.ts
   ```

2. If used by V2, test both systems:
   ```bash
   # Test V1
   NEXT_PUBLIC_BOOKING_V2=false npm run dev
   
   # Test V2  
   NEXT_PUBLIC_BOOKING_V2=true npm run dev
   ```

3. Run full test suite (when available)

### Session Storage Keys

V2 uses property-specific storage keys to prevent conflicts:

```typescript
const STORAGE_KEYS = {
  checkInDate: `booking_${propertySlug}_checkIn`,
  checkOutDate: `booking_${propertySlug}_checkOut`,
  guestCount: `booking_${propertySlug}_guests`,
  selectedAction: `booking_${propertySlug}_action`,
  guestInfo: `booking_${propertySlug}_guestInfo`
};
```

## TypeScript Integration

### V2 Types

V2 reuses existing types from `@/types`:
- ✅ `Property` interface
- ✅ `PricingResponse` interface  
- ✅ `CurrencyCode` type
- ✅ `BookingFormData` interface

### Custom V2 Types

Located in individual component files as needed. No separate types directory required.

## Performance Monitoring

### Bundle Size

V2 should maintain or improve bundle size compared to V1:

```bash
# Analyze bundle
npm run build
npm run analyze  # If configured
```

### Runtime Performance

Monitor in development:
- Check React DevTools Profiler
- Watch Network tab for API calls
- Monitor Console for performance warnings

## Security Considerations

### Development Authentication

⚠️ **CRITICAL**: V2 inherits the development authentication bypass issue:

```typescript
// src/lib/auth-helpers.ts - MUST FIX BEFORE PRODUCTION
if (process.env.NODE_ENV === 'development') {
  return { authenticated: true, admin: true }; // SECURITY RISK
}
```

### Rate Limiting

V2 has no rate limiting protection. Required for production:
- API endpoint throttling
- Form submission limits  
- Payment attempt restrictions

## Production Deployment

### Pre-Production Checklist

- [ ] All V2 tests passing
- [ ] V1 regression tests passing  
- [ ] Performance benchmarks met
- [ ] Security audit complete
- [ ] Feature flag configuration verified

### Production Rollout

1. **Canary Deployment** (10% traffic):
   ```bash
   NEXT_PUBLIC_BOOKING_V2=true  # 10% of users
   ```

2. **Gradual Rollout** (50% traffic):
   ```bash
   # Route 50% to V2 via middleware logic
   ```

3. **Full Migration** (100% traffic):
   ```bash
   NEXT_PUBLIC_BOOKING_V2=true  # All users
   ```

4. **V1 Cleanup** (after 30 days):
   ```bash
   # Remove V1 booking components
   # Clean up legacy code
   ```

## Troubleshooting

### Common Issues

1. **TypeScript Errors in BookingPageV2**:
   - Component prop mismatches with existing forms
   - Resolution: Check form component interfaces

2. **Session Storage Not Persisting**:
   - Property slug changes breaking storage keys
   - Resolution: Verify property slug consistency

3. **API Calls Failing**:
   - V2 should use same endpoints as V1
   - Resolution: Check network tab and API logs

4. **Feature Flag Not Working**:
   - Environment variable not loaded
   - Resolution: Restart dev server after env changes

### Debug Commands

```bash
# Full dependency analysis
npx tsx scripts/track-v2-dependencies.ts

# Check file usage
npx tsx scripts/track-v2-dependencies.ts --check src/path/to/file.ts

# Update dependency headers
npx tsx scripts/track-v2-dependencies.ts --update-headers

# Validate file headers
npx tsx scripts/validate-file-headers.ts
```

## Next Steps

✅ **Phase 0 Complete** - V2 foundation ready  
🔄 **Phase 1 Next** - Enhanced state management and component integration  

**Ready to proceed with Phase 1 development when approved.**