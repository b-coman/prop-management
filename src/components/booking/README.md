# Booking Component Structure

## Overview
This directory contains the booking components for RentalSpot Builder. The structure has been refactored to use a container-based approach with a clear separation of concerns.

## Component Architecture

### Current Active Components
The main booking flow uses the following active components:

- **BookingContainer** - Main container wrapper
  - Located at: `/container/BookingContainer.tsx`
  - Orchestrates the entire booking process

- **AvailabilityContainer** - Handles availability checking
  - Located at: `/container/AvailabilityContainer.tsx`
  - Uses EnhancedAvailabilityChecker for the UI

- **EnhancedAvailabilityChecker** - UI for checking availability
  - Located at: `/sections/availability/EnhancedAvailabilityChecker.tsx`
  - Displays date picker, guest selector, and availability status

The `BookingContainer` is used by `ClientBookingWrapper` in the main application flow.

### Obsolete Components
The following components are being phased out but are maintained for backward compatibility:

- **availability-check.tsx** - Original monolithic version (1500+ lines)
  - Will be archived in a future cleanup
  - Used by legacy implementations
  
- **availability-status.tsx** - Original status display component
  - Will be archived in a future cleanup
  - Used by the original `availability-check.tsx`

## Console Debug Logging

The components use a console logging system with different prefixes:
- `[AvailabilityContainer]` - Logs from the container component
- `[EnhancedAvailabilityChecker]` - Logs from the availability checker
- `[TRACK_RENDERED_COMPONENT]` - Special marker for component rendering

To enable your debug messages in the console, use the following prefix:
```javascript
console.log(`%c[TRACK_RENDERED_COMPONENT] Custom message`, 'color: purple; font-weight: bold;');
```

## Migration Strategy
When making changes to booking components:

1. Always modify the active components in the `/container/` and `/sections/` directories
2. Mark obsolete components as deprecated with clear comments
3. Add documentation to clarify which components should be used for new development
4. Use translation keys for UI messages to support multilingual functionality