# Booking Component Architecture

This document outlines the architecture for the booking component system, designed with modularity, maintainability, and separation of concerns in mind.

## Component Structure

```
booking/
├── container/                 # Container components that manage state and business logic
│   ├── BookingContainer.tsx        # Main container for the entire booking process
│   ├── AvailabilityContainer.tsx   # Manages availability checking state and logic
│   └── index.ts                    # Exports container components
│
├── sections/                  # UI sections for different parts of the booking flow
│   ├── availability/
│   │   ├── AvailabilityChecker.tsx     # UI for checking availability (dates, guests, check button)
│   │   ├── AvailabilityCalendar.tsx    # Calendar component showing available dates
│   │   ├── DateAlternatives.tsx        # Shows alternative date suggestions
│   │   └── UnavailableDatesView.tsx    # Complete view for when dates are unavailable
│   │
│   ├── forms/
│   │   ├── BookingForm.tsx            # Form for completing a booking
│   │   ├── HoldForm.tsx               # Form for holding dates
│   │   └── ContactHostForm.tsx        # Form for inquiring about dates
│   │
│   └── common/
│       ├── BookingSummary.tsx         # Shows booking details and pricing
│       ├── BookingOptions.tsx         # Shows booking option cards (book now, hold, contact)
│       └── GuestSelector.tsx          # Component for selecting number of guests
│
├── hooks/                     # Custom hooks for managing business logic
│   ├── useAvailabilityCheck.ts      # Hook for checking date availability
│   ├── useDateSuggestions.ts        # Hook for generating alternative dates
│   ├── useBookingForm.ts            # Hook for managing booking form state and submission
│   └── index.ts                     # Exports all hooks
│
├── services/                  # Service layer for API interactions
│   ├── availabilityService.ts       # Service for checking date availability
│   ├── bookingService.ts            # Service for creating bookings
│   └── inquiryService.ts            # Service for sending inquiries
│
└── index.ts                   # Main entry point exporting public components
```

## Component Responsibilities

### Containers

- **BookingContainer**: The main container component that orchestrates the entire booking process.
- **AvailabilityContainer**: Manages the state and logic for checking availability.

### Sections

- **AvailabilityChecker**: UI for selecting dates, guests, and checking availability.
- **AvailabilityCalendar**: Calendar component showing available/unavailable dates.
- **DateAlternatives**: Component showing alternative date suggestions.
- **UnavailableDatesView**: Complete view for when dates are unavailable.
- **BookingForm**: Form for completing a booking with payment.
- **HoldForm**: Form for holding dates with a holding fee.
- **ContactHostForm**: Form for sending inquiries to the host.
- **BookingSummary**: Shows booking details and pricing calculations.
- **BookingOptions**: Shows booking option cards (book now, hold, contact).
- **GuestSelector**: Component for selecting number of guests.

### Hooks

- **useAvailabilityCheck**: Hook for checking date availability.
- **useDateSuggestions**: Hook for generating alternative dates.
- **useBookingForm**: Hook for managing booking form state and submission.

### Services

- **availabilityService**: Service for checking date availability.
- **bookingService**: Service for creating bookings.
- **inquiryService**: Service for sending inquiries.

## Data Flow

1. User selects dates and guests in the AvailabilityChecker
2. AvailabilityContainer manages the checking process
3. If dates are available:
   - Show BookingSummary and BookingOptions
   - User selects an option (Book Now, Hold, Contact)
   - Show the relevant form
4. If dates are unavailable:
   - Show UnavailableDatesView with alternatives
   - User can select new dates or contact host

## State Management

- React Context (BookingContext) for sharing booking state
- Local component state for UI-specific state
- Custom hooks for managing business logic