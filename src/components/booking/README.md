# Booking Component Refactoring

This directory contains the refactored booking components. The main goal of this refactoring was to break down the large `availability-check.tsx` file (1400+ lines) into smaller, more focused components.

## Directory Structure

- `container/` - Container components that orchestrate the overall booking flow
- `features/` - Feature components for specific functionality like date selection
- `forms/` - Form components for user input
- `utilities/` - Utility components for debugging and fixes
- `hooks/` - Custom hooks that encapsulate business logic

## Main Components

- `AvailabilityCheckContainer` - The main container that replaces the original monolithic component
- `DateSelection` - For selecting and displaying date ranges
- `GuestCountSelector` - For changing the number of guests
- `ContactHostForm` - Form for sending inquiries to hosts

## Custom Hooks

- `useDateCalculation` - Handles date and night calculations
- `useAvailabilityCheck` - Manages availability checking logic
- `usePriceCalculation` - Handles price calculations
- `useBookingForm` - Manages form state and submissions

## Backward Compatibility

The refactoring maintains backward compatibility through the main `index.ts` file, which re-exports the new `AvailabilityCheckContainer` as `AvailabilityCheck`. This means that existing import statements like:

```tsx
import { AvailabilityCheck } from '@/components/booking/availability-check';
```

Can be replaced with:

```tsx
import { AvailabilityCheck } from '@/components/booking';
```

## Original File

The original monolithic component has been preserved as `availability-check.tsx.backup` for reference.

## Benefits of Refactoring

1. **Improved Maintainability** - Each component has a single responsibility
2. **Better Performance** - More focused re-renders
3. **Easier Debugging** - Isolated logic is easier to debug
4. **Reduced Complexity** - Smaller files are easier to understand
5. **Better Type Safety** - More explicit props and return types