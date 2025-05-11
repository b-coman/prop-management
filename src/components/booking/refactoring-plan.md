# Refactoring Plan for Availability Check Component

## Current Issues
- The component is over 1400 lines long
- Complex state management with many interconnected state variables
- Multiple responsibilities leading to bugs and difficult maintenance
- Date calculation issues and infinite re-render loops

## Proposed Structure

### Container Components
1. `BookingContainer` - Main container that coordinates the booking process
2. `AvailabilityCheckContainer` - Handles the availability checking logic

### Feature Components
1. `DateSelection` - For selecting and displaying date range
2. `GuestCountSelector` - For selecting number of guests
3. `AvailabilityStatus` (existing) - For displaying availability status
4. `BookingOptions` - For showing booking options (contact, hold, book)
5. `PricingSummary` - For displaying price calculation

### Form Components
1. `ContactHostForm` - For contact host option
2. `BookingForm` - For book now option
3. `HoldForm` - For hold dates option

### Utility Hooks
1. `useAvailabilityCheck` - Custom hook for availability checking logic
2. `useDateCalculation` - Custom hook for date and night calculation
3. `usePriceCalculation` - Custom hook for price calculation

### Utility Components
1. `DebugPanel` - For development debugging
2. `FixNights` (already created) - Helper for fixing night calculations

## Implementation Strategy

1. Start by extracting the custom hooks to isolate core logic
2. Create the smaller feature components
3. Create the form components
4. Build the container components that orchestrate everything
5. Update imports and dependencies throughout the application

## Benefits

1. **Improved Maintainability** - Smaller components are easier to understand and modify
2. **Better Performance** - More focused re-renders only when necessary
3. **Easier Debugging** - Isolated logic is easier to test and debug
4. **Reusability** - Components can be reused in different contexts
5. **Parallel Development** - Team members can work on different components simultaneously

## File Structure

```
src/components/booking/
  ├── container/
  │   ├── BookingContainer.tsx
  │   └── AvailabilityCheckContainer.tsx
  │
  ├── features/
  │   ├── DateSelection.tsx
  │   ├── GuestCountSelector.tsx
  │   ├── BookingOptions.tsx
  │   └── PricingSummary.tsx
  │
  ├── forms/
  │   ├── ContactHostForm.tsx
  │   ├── BookingForm.tsx
  │   └── HoldForm.tsx
  │
  ├── utilities/
  │   ├── DebugPanel.tsx
  │   └── FixNights.tsx
  │
  └── hooks/
      ├── useAvailabilityCheck.ts
      ├── useDateCalculation.ts
      └── usePriceCalculation.ts
```

## Implementation Plan

1. Create the directory structure
2. Extract hooks first to isolate business logic
3. Create utility components
4. Create feature components
5. Create form components
6. Create container components
7. Update the main AvailabilityCheck component to use the new structure
8. Update any parent components that might be affected