# Booking System v2 - Directory Structure

## Proposed Structure

```
src/
├── components/
│   ├── booking/                    # Legacy v1 (to be deprecated)
│   │   ├── forms/
│   │   ├── container/
│   │   └── ...
│   │
│   └── booking-v2/                 # All v2 code in one place
│       ├── contexts/               # State management
│       │   ├── BookingContext.tsx
│       │   └── index.ts
│       │
│       ├── containers/             # Smart components (with logic)
│       │   ├── BookingFlow.tsx
│       │   ├── AvailabilityChecker.tsx
│       │   ├── PricingCalculator.tsx
│       │   └── index.ts
│       │
│       ├── components/             # Dumb components (UI only)
│       │   ├── DateSelector.tsx
│       │   ├── GuestCounter.tsx
│       │   ├── PricingSummary.tsx
│       │   ├── BookingActions.tsx
│       │   └── index.ts
│       │
│       ├── forms/                  # Form components
│       │   ├── BookingForm.tsx     # Symlink to existing if unchanged
│       │   ├── HoldForm.tsx        # Symlink to existing if unchanged
│       │   ├── ContactForm.tsx     # Symlink to existing if unchanged
│       │   └── index.ts
│       │
│       ├── hooks/                  # Custom hooks
│       │   ├── useBookingStorage.ts
│       │   ├── useAvailability.ts
│       │   ├── usePricing.ts
│       │   └── index.ts
│       │
│       ├── services/               # V2-specific services
│       │   ├── bookingOrchestrator.ts
│       │   └── index.ts
│       │
│       ├── types/                  # TypeScript definitions
│       │   ├── booking.types.ts
│       │   ├── api.types.ts
│       │   └── index.ts
│       │
│       ├── utils/                  # Utility functions
│       │   ├── dateHelpers.ts
│       │   ├── priceFormatters.ts
│       │   └── index.ts
│       │
│       └── index.ts                # Main exports
│
├── services/                       # Shared services (v1 & v2)
│   ├── availabilityService.ts     # @v2-dependency: ACTIVE
│   ├── pricingService.ts          # @v2-dependency: ACTIVE
│   ├── bookingService.ts          # May need v2 version
│   └── emailService.ts            # @v2-dependency: ACTIVE
│
├── contexts/                       # Legacy contexts
│   └── BookingContext.tsx         # @v2-replaces: booking-v2/contexts/BookingContext
│
└── app/
    ├── booking/
    │   └── check/
    │       └── [slug]/
    │           ├── page.tsx        # Switch between v1/v2 based on feature flag
    │           └── booking-client-layout.tsx
    │
    └── properties/
        └── [slug]/
            └── booking/           # Alternative v2 route (optional)
                └── page.tsx
```

## Key Decisions

### 1. **Centralized v2 Directory**
All v2 code lives under `components/booking-v2/` making it:
- Easy to identify v2 files
- Simple to track dependencies
- Clear migration boundary
- Easy to delete v1 after migration

### 2. **Shared Services**
Services that work well for both v1 and v2 stay in `src/services/`:
```typescript
// services/availabilityService.ts
/**
 * @v2-dependency: ACTIVE
 * @v2-usage: Core availability checking
 */
```

### 3. **Container vs Component Split**
- **Containers**: Smart components with business logic
- **Components**: Pure UI components
- **Forms**: Might be symlinks if unchanged

### 4. **Index Exports**
Each subdirectory has an index.ts for clean imports:
```typescript
// booking-v2/index.ts
export { BookingProvider } from './contexts';
export { BookingFlow } from './containers';
export * from './types';
```

## Import Examples

### Clean v2 Imports
```typescript
// In v2 components
import { BookingProvider } from '@/components/booking-v2';
import { useBookingStorage } from '@/components/booking-v2/hooks';
import type { BookingState } from '@/components/booking-v2/types';

// Shared services
import { availabilityService } from '@/services/availabilityService';
```

### Feature Flag Usage
```typescript
// app/booking/check/[slug]/page.tsx
import { FEATURES } from '@/config/features';

// V1 imports
import { BookingContainer as BookingV1 } from '@/components/booking';

// V2 imports  
import { BookingFlow as BookingV2 } from '@/components/booking-v2';

export default function BookingPage() {
  return FEATURES.BOOKING_V2 ? <BookingV2 /> : <BookingV1 />;
}
```

## Alternative Structures Considered

### Option B: Feature-First Structure
```
src/
├── features/
│   ├── booking-v2/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── pages/
│   └── booking-legacy/
```
**Pros**: Clear feature boundaries  
**Cons**: Major restructuring needed

### Option C: Side-by-Side Pages
```
src/
├── app/
│   ├── booking/        # v1
│   └── booking-v2/     # v2
```
**Pros**: Complete separation  
**Cons**: Duplicate routes, confusing for users

## Migration Path

### Phase 1: Setup Structure
```bash
mkdir -p src/components/booking-v2/{contexts,containers,components,forms,hooks,services,types,utils}
```

### Phase 2: Create Core Files
```bash
# Create with proper headers
touch src/components/booking-v2/contexts/BookingContext.tsx
touch src/components/booking-v2/containers/BookingFlow.tsx
```

### Phase 3: Symlink Unchanged Forms
```bash
cd src/components/booking-v2/forms
ln -s ../../booking/forms/BookingForm.tsx BookingForm.tsx
ln -s ../../booking/forms/HoldForm.tsx HoldForm.tsx
```

### Phase 4: Update Imports Gradually
Track with `@v2-dependency` as services are used.

## Benefits of This Structure

1. **Clear Boundaries**: v2 code is isolated
2. **Easy Testing**: Can test v2 independently  
3. **Simple Rollback**: Just flip feature flag
4. **Clean Imports**: Logical paths
5. **Gradual Migration**: No big bang
6. **Easy Cleanup**: Delete booking/ folder when done

## File Naming Conventions

### v2 Files
- No version suffixes (BookingContext.tsx, not BookingContextV2.tsx)
- Descriptive names (PricingSummary, not Summary)
- Index exports for clean imports

### Headers
```typescript
/**
 * @fileoverview [Description]
 * @module booking-v2/[path]
 * @v2-role: CORE
 */
```

This structure provides maximum clarity while maintaining flexibility for the migration.