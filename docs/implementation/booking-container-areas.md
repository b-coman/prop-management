# Booking Check Page Container Areas

This document provides a detailed breakdown of the distinct functional areas within the booking check page. Understanding these container areas is crucial for maintaining, debugging, and enhancing the booking experience.

## Container Architecture Overview

The booking check page is composed of several distinct container areas, each with specific responsibilities and user interface elements. This modular approach allows for focused maintenance and targeted improvements.

```
┌─────────────────────────────────────────────┐
│ 1. Header Area                              │
├─────────────────┬───────────────────────────┤
│ 2. Property     │ 3. Availability Checker   │
│    Context      │                           │
│    Panel        │ 4. Pricing Summary        │
│                 │                           │
│                 │ 5. Booking Options        │
│                 │                           │
│                 │ 6. Dynamic Form Container │
│                 │                           │
│                 │ 7. Unavailable Dates View │
└─────────────────┴───────────────────────────┘
```

## Container Areas in Detail

### 1. Header Area
- **Desktop**: Back navigation link with property name
- **Mobile**: Sticky header with back button and property name
- **Mobile-only**: Optional sticky summary showing selected dates and price
- **Files**: `BookingCheckLayout.tsx` (header section)
- **Purpose**: Provides navigation context and quick summary on mobile

### 2. Property Context Panel
- **Desktop**: Left sidebar (30% width)
- **Mobile**: Collapsible accordion
- **Elements**:
  - Property image
  - Property name
  - Selected dates (when chosen)
  - Nights count
  - Total price
- **Files**: `BookingCheckLayout.tsx` (aside section)
- **Purpose**: Maintains context about the property being booked

### 3. Availability Checker Container
- **Elements**:
  - Date range picker with calendar
  - Guest count selector
  - Check availability button
  - Availability result display (success/error)
- **Files**: 
  - `EnhancedAvailabilityChecker.tsx`
  - `CustomDateRangePicker.tsx`
- **Purpose**: Allows users to select and verify date availability

### 4. Pricing Summary Container
- **Elements**:
  - Accommodation cost breakdown
  - Cleaning fee
  - Extra guest fees (if applicable)
  - Discounts (if coupons applied)
  - Total price with currency
- **Files**: `BookingSummary.tsx`
- **Purpose**: Displays transparent pricing information
- **State Dependencies**: Requires availability check to succeed first

### 5. Booking Options Container
- **Elements**:
  - Book Now option card
  - Hold Dates option card
  - Contact Host option card
- **Files**: `BookingOptionsCards.tsx`
- **Purpose**: Allows selection between booking methods
- **State Dependencies**: Only visible when dates are available

### 6. Dynamic Form Container
- **Three possible states**:
  - Book Now form (direct booking)
  - Hold Dates form (temporary reservation)
  - Contact Host form (inquiries)
- **Files**: 
  - `BookingForm.tsx`
  - `HoldForm.tsx`
  - `ContactHostForm.tsx`
- **Purpose**: Collects guest information based on selected option
- **State Dependencies**: Only one form visible at a time

### 7. Unavailable Dates View
- **Elements**:
  - Alternative dates suggestions
  - Contact host option
  - Calendar showing unavailable periods
- **Files**: `UnavailableDatesView.tsx`
- **Purpose**: Provides alternatives when selected dates aren't available
- **State Dependencies**: Only visible when availability check fails

## State Flow Between Containers

1. User enters via **Header Area** with potentially pre-filled URL parameters
2. **Availability Checker** loads unavailable dates and checks selected dates
3. If available → **Pricing Summary** calculates costs → **Booking Options** displayed
4. User selects option → **Dynamic Form** for selected option displayed
5. User completes form → Redirect to confirmation or payment
6. If unavailable → **Unavailable Dates View** provides alternatives

## Multilingual and Theme Support

All containers support:
- Dynamic theme variables through Tailwind CSS
- Multilingual text through the `tc()` and `t()` translation functions
- Responsive layouts for all screen sizes

## Debugging Container Issues

When troubleshooting specific areas of the booking check page:

1. Identify which container has the issue
2. Check the specific component file for that container
3. Verify state dependencies between containers
4. Inspect network requests for API-dependent containers
5. Validate theme variable usage in container styling
6. Test with different languages to ensure proper text rendering

Understanding these distinct container areas makes maintenance and enhancement more manageable by creating clear boundaries of responsibility within the complex booking check page.