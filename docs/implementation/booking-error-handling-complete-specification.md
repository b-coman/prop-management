# Booking Error Handling V3 - Complete Implementation Specification

**Status:** Ready for Independent Implementation  
**Version:** 3.0 Complete Technical Specification  
**Date:** September 12, 2025  
**Target Audience:** External Developers & AI Coding Assistants  
**Estimated Implementation:** 12 weeks  

## ⚠️ CRITICAL: READ IMPLEMENTATION GUIDELINES FIRST
**MANDATORY:** Before implementing ANY task, read: `booking-error-handling-implementation-guidelines.md`  
This document contains critical preservation requirements and context gathering instructions.  

---

## Table of Contents
1. [System Context & Current Implementation](#system-context--current-implementation)
2. [Current Error Flow Walkthrough](#current-error-flow-walkthrough)
3. [Error Types & API Responses](#error-types--api-responses)
4. [Business Logic & Decision Trees](#business-logic--decision-trees)
5. [Implementation Epics & Tasks](#implementation-epics--tasks)
6. [Testing Specifications](#testing-specifications)
7. [Common Pitfalls & Warnings](#common-pitfalls--warnings)

---

# System Context & Current Implementation

## Project Structure Overview
```
RentalSpot-Builder/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── check-pricing/route.ts        # Main pricing API endpoint
│   │       ├── check-pricing-v2/route.ts     # V2 pricing endpoint
│   │       └── check-availability/route.ts   # Availability checking
│   ├── components/
│   │   └── booking-v2/
│   │       ├── components/
│   │       │   ├── DateAndGuestSelector.tsx  # Main date selection component
│   │       │   ├── MobileDateSelectorWrapper.tsx # Mobile wrapper
│   │       │   └── PricingSummary.tsx        # Pricing display
│   │       ├── containers/
│   │       │   └── BookingPageV2.tsx         # Main booking page
│   │       └── contexts/
│   │           └── BookingProvider.tsx       # V2 booking context provider
│   ├── contexts/
│   │   └── BookingContext.tsx                # Global booking context
│   └── lib/
│       ├── availability-service.ts           # Availability checking service
│       └── pricing/
│           └── pricing-with-db.ts            # Pricing database operations
```

## Current V2 System Architecture

### Component Hierarchy
```
BookingPageV2
├── MobileDateSelectorWrapper (mobile only)
│   └── DateAndGuestSelector
│       ├── Calendar Components
│       ├── Guest Selector
│       └── PricingStatusDisplay (error display)
├── PricingSummary
└── BookingFormV2
```

### State Management Flow
```
BookingContext (Global)
├── checkInDate: Date | null
├── checkOutDate: Date | null  
├── guestCount: number
├── pricingDetails: PricingDetails | null
├── isPricingLoading: boolean
├── pricingError: string | null  ← Current error state (string only)
└── fetchPricing(): Promise<void>
```

---

# Current Error Flow Walkthrough

## Step-by-Step Error Generation & Display

### 1. User Selects Dates
**File:** `src/components/booking-v2/components/DateAndGuestSelector.tsx`
```typescript
// Line 134-163: Check-in date selection
const handleCheckInChange = useCallback((date: Date | undefined) => {
  const newCheckIn = date || null;
  
  if (newCheckIn && checkOutDate) {
    const nightsBetween = getDaysBetween(newCheckIn, checkOutDate);
    const minStay = property.defaultMinimumStay || 1;
    
    if (nightsBetween < minStay) {
      setCheckOutDate(null);
      // Shows yellow warning banner
      showMinStayWarning();
    }
  }
  setCheckInDate(newCheckIn);
}, [checkOutDate, property.defaultMinimumStay]);
```

### 2. API Call Triggered
**File:** `src/contexts/BookingContext.tsx`
```typescript
// Line 577-645: Fetch pricing with error handling
const fetchPricing = useCallback(async () => {
  try {
    setIsPricingLoading(true);
    setPricingError(null);  // Clear previous errors
    
    const response = await fetch('/api/check-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId,
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
        guests: guestCount
      })
    });
    
    const data = await response.json();
    
    if (!data.available) {
      // ERROR GENERATED HERE
      setPricingError(data.reason === 'minimum_stay' 
        ? `Minimum ${data.minimumStay} nights required from this date`
        : 'Selected dates are not available');
      return;
    }
    
    // Success path...
  } catch (error) {
    setPricingError("Error fetching pricing information. Please try again.");
  }
}, [checkInDate, checkOutDate, guestCount]);
```

### 3. API Error Response Examples

**Minimum Stay Violation:**
```json
{
  "available": false,
  "reason": "minimum_stay",
  "minimumStay": 2,
  "requiredNights": 2
}
```

**Unavailable Dates:**
```json
{
  "available": false,
  "reason": "unavailable_dates",
  "unavailableDates": [
    "2025-09-23T00:00:00.000Z",
    "2025-09-24T00:00:00.000Z"
  ]
}
```

**Missing Pricing Data:**
```json
{
  "error": "Price information not available for the selected dates",
  "status": 404
}
```

### 4. Error Display in UI
**File:** `src/components/booking-v2/components/DateAndGuestSelector.tsx`
```typescript
// Line 580-598: PricingStatusDisplay component
const PricingStatusDisplay = ({ isLoadingPricing, pricingError, fetchPricing, t }) => {
  if (pricingError) {
    return (
      <div className="text-center py-4">
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
          <p className="text-red-800 text-sm font-medium">{pricingError}</p>
          <p className="text-red-700 text-xs">
            {t('booking.unavailableDatesNote', 'Unavailable dates are marked with strikethrough in the calendar')}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="mt-3"
          onClick={fetchPricing}
        >
          {t('booking.retryPricing', 'Retry Pricing')}
        </Button>
      </div>
    );
  }
  // Loading and success states...
};
```

## Current Mobile Error Handling

### Mobile Wrapper Behavior
**File:** `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx`
```typescript
// Line 45-65: Current collapsed/expanded logic
const isGreenState = checkInDate && checkOutDate && pricing && !pricingError;

// Mobile collapsed banner only shows in "green state" (no errors)
{isGreenState && !isExpanded ? (
  <div className="sticky top-[73px] z-30 bg-background border-b">
    {/* Collapsed banner content */}
  </div>
) : (
  // Always expanded when errors exist
  <DateAndGuestSelector {...props} />
)}
```

**Current Issue:** Errors force full expansion, no error indicators in collapsed state.

---

# Error Types & API Responses

## Complete Error Taxonomy

### 1. Availability Errors

#### Type: `unavailable_dates`
**Trigger:** Dates blocked in availability collection  
**API Endpoint:** `/api/check-pricing/route.ts:83-89`
```typescript
if (!availabilityResult.isAvailable) {
  return NextResponse.json({
    available: false,
    reason: 'unavailable_dates',
    unavailableDates: availabilityResult.unavailableDates
  });
}
```

**Frontend Display:**
- Message: "Selected dates are not available"
- Style: Red error box (`bg-red-50 border-red-200`)
- Action: "Retry Pricing" button

### 2. Minimum Stay Errors

#### Type: `minimum_stay`
**Trigger:** Nights < required minimum stay  
**API Endpoint:** `/api/check-pricing/route.ts:170-217`
```typescript
const meetsMinimumStay = nights >= minimumStay;
if (!meetsMinimumStay) {
  return NextResponse.json({
    available: false,
    reason: 'minimum_stay',
    minimumStay,
    requiredNights: minimumStay
  });
}
```

**Business Logic:**
- Property has `defaultMinimumStay` (e.g., 2 nights)
- Price calendar can override with higher/lower minimum
- System uses highest minimum stay across all nights

**Frontend Display:**
- Message: "Minimum X nights required from this date"
- Style: Red error box
- Action: "Retry Pricing" button

### 3. Pricing Data Errors

#### Type: `price_unavailable`
**Trigger:** Missing price calendar for selected dates  
**API Endpoint:** `/api/check-pricing/route.ts:100-106`
```typescript
if (calendars.some(calendar => calendar === null)) {
  return NextResponse.json(
    { error: 'Price information not available for the selected dates' },
    { status: 404 }
  );
}
```

**Frontend Display:**
- Message: "Price information not available for the selected dates"
- Style: Red error box
- Action: "Retry Pricing" button

### 4. Validation Errors

#### Type: `validation_error`
**Trigger:** Invalid dates, guest count exceeds capacity  
**API Endpoint:** `/api/check-pricing/route.ts:42-58`
```typescript
// Past date validation
if (checkInDate < today) {
  return NextResponse.json(
    { error: 'Check-in date cannot be in the past' },
    { status: 400 }
  );
}

// Date order validation
if (checkInDate >= checkOutDate) {
  return NextResponse.json(
    { error: 'Check-out date must be after check-in date' },
    { status: 400 }
  );
}
```

**Frontend Display:**
- Message: Specific validation error message
- Style: Red error box
- Action: Manual date correction required

---

# Business Logic & Decision Trees

## Error Priority & Severity

### Error Severity Classification
```typescript
enum ErrorSeverity {
  BLOCKING = 'blocking',    // Prevents booking completion
  WARNING = 'warning',      // Can proceed with acknowledgment
  INFO = 'info'            // Informational only
}

const ERROR_SEVERITY_MAP = {
  'unavailable_dates': ErrorSeverity.BLOCKING,
  'minimum_stay': ErrorSeverity.BLOCKING,
  'price_unavailable': ErrorSeverity.BLOCKING,
  'past_date': ErrorSeverity.BLOCKING,
  'invalid_date_order': ErrorSeverity.BLOCKING,
  'guest_capacity_warning': ErrorSeverity.WARNING,
  'seasonal_pricing_info': ErrorSeverity.INFO
};
```

### Error Display Priority
When multiple errors occur simultaneously:
1. **Validation errors** (invalid dates) - Show first
2. **Availability errors** - Show second
3. **Minimum stay errors** - Show third
4. **Pricing errors** - Show last

### Mobile Auto-Expand Decision Tree
```
Error Occurs
├── Is Error Blocking?
│   ├── Yes → Auto-expand immediately
│   │   └── Focus on error field
│   └── No → Show error indicator in collapsed state
│       └── User taps → Expand with error highlighted
└── Multiple Errors?
    └── Show highest priority error first
```

### Suggestion Generation Logic
```
Error Type Check
├── Minimum Stay Violation
│   ├── Can extend checkout? (check availability)
│   │   ├── Yes → Suggest new checkout date
│   │   └── No → Check earlier check-in dates
│   └── No valid extension → Suggest alternative periods
├── Unavailable Dates
│   ├── Find next available period (same duration)
│   ├── Check flexible duration (±1-2 nights)
│   └── No nearby availability → Suggest next month
└── Pricing Gap
    └── Find nearest dates with complete pricing
```

---

# Implementation Epics & Tasks

## EPIC 1: Error System Foundation V3

### Overview
Transform string-based errors into structured, actionable error objects with TypeScript safety and recovery actions.

### Task 1.1: Error Type System Architecture

## 🔄 PRE-IMPLEMENTATION REQUIREMENTS - MANDATORY

**What to achieve:** Transform string-based errors into structured, actionable error objects with TypeScript safety and recovery actions.

**Why this approach:** Current string errors work but provide no context for smart recovery. Structured errors enable intelligent suggestions while keeping existing functionality intact.

**Key insight:** The current `pricingError: string | null` is consumed by multiple components - don't replace it, complement it with structured data alongside.

### Context Gathering - Understanding Current System
**Study these files to understand current patterns:**
- `src/contexts/BookingContext.tsx` - How errors are currently managed
- `src/components/booking-v2/components/DateAndGuestSelector.tsx` - How errors are displayed  
- `src/app/api/check-pricing/route.ts` - How errors are generated from API

**Critical analysis questions:**
- How does current error flow work end-to-end?
- What components consume `pricingError`?
- What API response shapes generate errors?

### Architectural Principles

**Preservation Strategy:** Never break existing functionality
- Current V2 error handling must continue working unchanged
- Add V3 as optional enhancement, not replacement
- Use conditional rendering: `bookingErrors.length > 0 ? V3Display : V2Display`

**Integration Pattern:** Follow codebase's optional feature approach
- Look at how mobile vs desktop rendering is handled - use similar pattern
- Add optional properties to interfaces, never remove existing ones
- Maintain dual state: both `pricingError` and `bookingErrors` stay synchronized

### Implementation Guidance

**Core Structure Design:**
Create error interfaces that capture:
- **Error Identity:** Unique ID, timestamp, source (api/frontend)
- **Error Classification:** Type (availability/minimum_stay/pricing/validation) and severity (blocking/warning/info)  
- **User Context:** What the user was trying to do when error occurred
- **Recovery Options:** Available actions with confidence scores for auto-application

**Key Design Decisions:**
- **Severity levels:** Blocking errors prevent booking, warnings allow continuation, info provides guidance
- **Recovery actions:** Each error should suggest specific fixes (extend checkout, try different dates, etc.)
- **Context preservation:** Capture booking state when error occurred for intelligent suggestions

**File Organization:**
- Create `src/types/booking-errors.ts` for all error-related TypeScript interfaces
- Follow existing project patterns for type definitions
- Use enums for controlled vocabularies (ErrorType, ErrorSeverity, etc.)

**Error Factory Pattern:**

**What to build:** Factory functions that convert API responses into structured V3 error objects

**Why factory pattern:** API responses have different shapes for different errors - factory normalizes them into consistent structure

**Key insight:** Study current API error responses in `check-pricing/route.ts` - your factory needs to handle all existing response formats

**Implementation approach:**
- Create `src/lib/booking-v3/error-factory.ts` with `BookingErrorFactory` class  
- Map API response shapes to V3 error objects
- Generate appropriate recovery actions based on error type

**Recovery Action Generation:**
- **Minimum stay errors:** Suggest extending checkout date (high confidence) or finding earlier dates (lower confidence)
- **Unavailable date errors:** Suggest alternative date ranges with similar duration
- **Pricing errors:** Suggest dates with complete pricing data

**Common mistake to avoid:** Don't hardcode recovery actions - generate them dynamically based on context and availability

**Integration with existing code:** Look at existing date suggestion patterns in `src/components/booking/hooks/useDateSuggestions.ts` for inspiration

### Success Criteria
**How to know you've succeeded:**
- TypeScript error interfaces provide type safety for all error scenarios
- Error factory handles all existing API response formats without breaking
- V2 components continue working unchanged while V3 components get rich error data
- Recovery actions are generated dynamically based on actual booking context and availability

**Testing approach:** Focus on error conversion accuracy and backward compatibility - ensure your factory transforms every existing API error response into a valid V3 error object with appropriate recovery actions.

### Task 1.2: V3 Error Display Components

**What to achieve:** Create rich error display components that show structured errors with recovery actions while preserving all existing error display functionality

**Why rich components:** Current `PricingStatusDisplay` only shows string messages with retry button. V3 components should show error context, suggest specific actions, and guide users toward resolution.

**Key insight:** UI components are the most visible change to users - they must be rock-solid and never break existing functionality. Conditional rendering is your safety net.

### Context Gathering - Component Integration
**Study these UI patterns:**
- `src/components/booking-v2/components/DateAndGuestSelector.tsx` - Current error display patterns and styling
- `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx` - Mobile wrapper logic and responsive behavior  
- Look for existing expandable component patterns in the codebase for recovery action design

**Critical understanding needed:**
- How does current mobile/desktop responsive switching work?
- What determines `isGreenState` calculation (affects mobile wrapper behavior)?
- Which components import and use `PricingStatusDisplay`?

### Architectural Principles

**Conditional Enhancement Strategy:** V3 alongside V2, never replacing
- Use feature flag or error type detection to choose display component
- Always provide V2 fallback: `bookingErrors.length > 0 ? V3Display : V2Display`  
- Ensure V3 components receive same styling patterns as existing error displays

**Mobile-First Design Considerations:**
- Desktop: Expandable error cards with inline recovery actions
- Mobile: Bottom sheet or drawer pattern for recovery flows
- Touch targets: Minimum 44px height for all interactive elements
- Preserve existing mobile auto-expand behavior for blocking errors

**Component Architecture:**
- Create `src/components/booking-v3/components/` directory structure
- Build separate desktop and mobile error components (different UX needs)
- Use same UI primitives as existing components (Button, Card, Sheet, etc.)
- Follow existing component naming and file organization patterns

**Recovery Action UI Patterns:**
- High confidence actions: Prominent primary buttons
- Lower confidence actions: Secondary buttons or expandable sections
- Multiple actions: Prioritize by confidence score, progressive disclosure
- Loading states: Show progress during action execution

### Success Criteria
**How to know you've succeeded:**
- V3 error components display rich error information with actionable recovery options
- Existing V2 error display continues working unchanged for backward compatibility
- Mobile error UI provides touch-friendly recovery flows without breaking responsive behavior
- Component architecture follows existing patterns and integrates seamlessly

**Component Integration Wisdom:** Study how mobile/desktop conditional rendering works in the codebase - apply the same pattern for V2/V3 error display switching. The key is making V3 enhancement optional, never required.

---

## EPIC 2: Smart Recommendation Engine V3

### Overview
Transform static "dates unavailable" errors into intelligent suggestions that help users find alternatives that work for their needs.

### Task 2.1: Date Suggestion Algorithm Engine

**What to achieve:** Build intelligent algorithms that generate alternative date suggestions based on real availability and booking context

**Why intelligent suggestions:** Static suggestions (like "try next week") don't help users - smart suggestions consider actual availability, property constraints, and user preferences to find dates that will actually work.

**Key insight:** There's existing V1 suggestion logic that can be studied for patterns, but it's not integrated with V2 system. Learn from it but don't try to modify it.

### Context Gathering - Learning from Existing Systems
**Study these existing patterns:**
- `src/components/booking/hooks/useDateSuggestions.ts` - Current static suggestion logic and patterns
- `src/components/booking/sections/availability/DateAlternatives.tsx` - How suggestions are currently displayed
- `src/lib/availability-service.ts` - How to safely query availability without breaking existing functionality

**Critical understanding needed:**
- How does `checkAvailabilityWithFlags` work? (This is your primary availability checking tool)
- What are the current limitation patterns that cause booking errors?
- How do minimum stay rules work across different properties?

### Architectural Principles

**Service Integration Safety:** Never modify existing services, only consume them
- Use existing `availability-service.ts` functions as-is (they're tested and working)
- Don't change existing API response structures
- Build new algorithms that query existing services safely

**Algorithm Strategy:** Rule-based primary + AI enhancement with fallbacks
- **Rule-based core:** Fast, deterministic suggestions based on availability data 
- **AI enhancement:** Optional layer that can provide smarter suggestions when available
- **Fallback hierarchy:** AI fails → rule-based → static suggestions → no suggestions

**Performance Philosophy:** Suggestions should enhance, never slow booking
- Run suggestion generation asynchronously where possible
- Set timeouts on AI calls (max 3 seconds)
- Cache availability results to avoid duplicate queries
- Don't let suggestion failures block normal booking flow

### Success Criteria
**How to know you've succeeded:**
- Suggestion algorithms generate contextually relevant date alternatives based on actual availability
- Rule-based suggestions work reliably and fast as primary system
- AI enhancements provide valuable improvements when available but don't break system when unavailable
- Integration with existing availability service happens safely without modifying core booking functionality

**Algorithm Design Wisdom:** Start with simple rule-based logic that covers 80% of cases well, then add AI enhancement for the complex edge cases. The rule-based system is your foundation - make it solid before adding complexity.

---

### Task 2.2: Date Suggestions API Endpoint

**What to achieve:** Create a new API endpoint that provides intelligent date suggestions when booking errors occur

**Why new endpoint:** Current booking flow needs suggestions without breaking existing API contracts. A dedicated endpoint allows suggestions to fail gracefully without affecting core booking functionality.

**Key insight:** Study existing API patterns (`check-pricing/route.ts`) - follow the same validation, error handling, and response structure patterns to maintain consistency.

### Context Gathering - API Integration Patterns
**Study these API patterns:**
- `src/app/api/check-pricing/route.ts` - Current API structure, validation patterns, and error handling
- `src/app/api/check-pricing-v2/route.ts` - API versioning and evolution patterns
- How other APIs in the project handle timeouts, failures, and graceful degradation

### Architectural Principles

**Isolated Endpoint Strategy:** New functionality that doesn't break existing systems
- Create `/api/date-suggestions` as completely separate endpoint
- Existing booking APIs continue working unchanged even if suggestions fail
- New endpoint can be called optionally - no dependency on it for core booking

**Graceful Degradation Philosophy:** Suggestions enhance but never block
- Timeout protection for AI calls (max 3-4 seconds)  
- Always return partial results rather than failing completely
- Fallback to simpler suggestions if complex algorithms fail
- Empty suggestions array is a valid response (UI handles this gracefully)

**Consistency with Existing APIs:** Follow established patterns
- Same request/response structure patterns as other booking APIs
- Same validation approach for dates, properties, guest counts
- Same error response format for client consistency
- Same security and rate limiting considerations

---

## EPIC 3: Mobile-First Error Experience

### Overview
Create mobile-optimized error handling that works well on small screens with touch interactions, while preserving all existing mobile functionality.

### Task 3.1: Mobile Error Components Architecture

**What to achieve:** Build mobile-specific error handling components that provide touch-friendly interactions without breaking existing mobile responsive behavior

**Why mobile-specific:** Desktop error patterns don't work well on mobile - small screens need different UX patterns like bottom sheets, larger touch targets, and simplified interactions.

**Key insight:** The current mobile wrapper has complex logic for collapsed/expanded states that must be preserved. Study `MobileDateSelectorWrapper.tsx` thoroughly - it's the heart of mobile UX.

### Context Gathering - Mobile Component Patterns
**Study these mobile-specific systems:**
- `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx` - Critical mobile state logic
- How current mobile breakpoints work (`md:hidden`, `lg:hidden` classes)
- Touch target patterns in existing mobile components (minimum 44px heights)

### Architectural Principles

**Mobile Component Safety:** Preserve all existing mobile functionality
- Never break the `isGreenState` calculation logic
- Maintain existing auto-expand/collapse behavior  
- Keep all current touch target sizes and navigation patterns
- Don't interfere with existing mobile booking flow

**Touch-First Design:** Optimize for thumb navigation
- Minimum 44px height for all interactive elements
- Large primary action buttons for key recovery actions
- Simple, single-tap interactions over complex gestures
- Clear visual feedback for touch interactions

**Progressive Enhancement:** Mobile V3 alongside V2
- Use same conditional rendering pattern as desktop
- Mobile V3 components only when V3 errors exist
- Fallback to existing mobile error display for compatibility

### Success Criteria
**How to know you've succeeded:**
- Mobile error handling provides touch-optimized recovery flows
- All existing mobile responsive behavior continues working unchanged
- New mobile components integrate seamlessly with existing mobile wrapper logic
- Touch targets meet accessibility standards (44px minimum)

**Mobile Integration Wisdom:** The `isGreenState` logic determines when the mobile wrapper shows collapsed banner vs expanded form. Any changes to error handling must consider how they affect this critical mobile UX feature.

---

### Task 3.2: Collapsed Banner Error States

**What to achieve:** Show error indicators in mobile collapsed banner without forcing expansion

**Why this matters:** Currently, any error forces mobile wrapper to expand, losing the UX benefit of collapsed state. Users should see error hints while maintaining compact view.

**Key insight:** The `isGreenState` calculation in MobileDateSelectorWrapper determines collapsed vs expanded. Study this logic - it's the heart of mobile UX optimization.

### Context Gathering - Mobile State Logic
**Study these mobile patterns:**
- `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx` - How collapsed/expanded transitions work
- Current banner content structure and available space for indicators
- Look at other mobile components that show status indicators in compact views

### Architectural Principles

**Graceful Degradation:** Not all errors should force expansion
- **Blocking errors:** Auto-expand immediately (preserve current behavior)
- **Warning/info errors:** Show indicator in collapsed state, expand on tap
- **Multiple errors:** Show most severe indicator with count

**Visual Integration:** Subtle indicators that don't break existing design
- Small badges or dots that fit existing banner layout
- Color coding that matches error severity (red for blocking, amber for warnings)
- Position indicators where they don't interfere with current functionality

**State Management Logic:** Extend `isGreenState` calculation
- Current logic: `checkInDate && checkOutDate && pricing && !pricingError`
- Enhanced logic: Consider error severity in state determination
- Maintain backward compatibility for components depending on green state

**UX Philosophy:** Progressive disclosure - show just enough information to guide without overwhelming

---

### Task 3.3: Progressive Error Recovery

**What to achieve:** Guide users through error resolution with step-by-step assistance instead of showing complex recovery options all at once

**Why progressive approach:** Mobile screens are small and cognitive load is high during errors. Breaking recovery into simple steps reduces overwhelm and increases success rates.

**Key insight:** Users experiencing errors are often frustrated - simplify their path to success with clear, sequential guidance.

### Context Gathering - Flow Patterns
**Study these user flow patterns:**
- Look for multi-step processes in the codebase (onboarding, checkout flows, etc.)
- Current mobile navigation patterns and how users move between states
- How progress is typically indicated in existing components

### Architectural Principles

**Cognitive Load Reduction:** One decision at a time
- Present one clear action per step rather than multiple recovery options
- Use wizard-like flow: "Step 1 of 3: Extend your stay"
- Provide context for each step: why this action helps

**Mobile-First Design:** Touch-friendly interactions
- Large touch targets (minimum 44px height)
- Clear primary action buttons with secondary "skip" options
- Swipe gestures or simple taps for navigation

**Progress Communication:** Keep users oriented
- Visual progress indicators (step counter, progress bar)
- Clear explanation of what each step accomplishes
- Option to see all steps at once for users who prefer overview

**Adaptive Guidance:** Tailor steps to error type
- **Minimum stay errors:** Guide through date extension or alternative date selection
- **Availability errors:** Walk through flexible date exploration
- **Pricing errors:** Help find dates with complete pricing data

**Recovery Philosophy:** Make success feel inevitable through guided assistance

---

## EPIC 4: Error Recovery Intelligence

### Overview
Guide users to successful bookings instead of showing static errors by implementing intelligent auto-correction and alternative suggestions.

### Task 4.1: Auto-Correction Engine

**What to achieve:** Automatically fix common booking errors with high-confidence corrections while giving users control over the process

**Why auto-correction:** Many booking errors have obvious fixes (extend checkout by 1 night for minimum stay). Smart corrections reduce friction and guide users toward successful bookings.

**Key insight:** The difference between helpful automation and annoying interference is confidence scoring. High-confidence fixes can be auto-applied; lower confidence should be suggested.

### Context Gathering - Booking Logic Patterns
**Study these correction opportunities:**
- `src/contexts/BookingContext.tsx` - How date and guest updates currently work
- Common error patterns from existing API responses
- Look for existing "smart" behavior in date selectors or validation

### Architectural Principles

**Confidence-Based Actions:** Different behaviors for different certainty levels
- **High confidence (>0.8):** Auto-apply with notification ("Fixed: Extended to 2 nights")
- **Medium confidence (0.5-0.8):** Suggest with prominent button ("Extend to 2 nights?")
- **Low confidence (<0.5):** Show as option alongside others

**Context-Aware Corrections:** Smart fixes based on error type and user intent
- **Minimum stay violations:** Extend checkout if dates are available, or suggest earlier check-in
- **Guest capacity issues:** Suggest reducing guest count to property maximum
- **Date order problems:** Auto-swap check-in/checkout if user likely made mistake

**Integration with Existing Logic:** Use current BookingContext methods
- Don't duplicate date/guest update logic - use existing context functions
- Trigger existing validation flows after corrections
- Respect existing booking state management patterns

**User Control Philosophy:** Always provide escape hatches and transparency
- Show what was changed and why
- Provide undo option for auto-applied corrections
- Allow users to override or modify suggested fixes

**Common mistake to avoid:** Don't make corrections that could surprise users - transparency is key

---

## EPIC 5: Analytics & Optimization

### Overview
Data-driven error reduction and UX improvement through systematic analysis of error patterns and recovery effectiveness.
    
    try {
      // Try AI-enhanced suggestions first (with timeout)
      const aiSuggestions = await this.getAISuggestions(context);
      if (aiSuggestions.length > 0) {
        return aiSuggestions;
      }
    } catch (error) {
      console.warn('AI suggestions failed, falling back to rule-based', error);
    }
    
    // Fallback to rule-based suggestions
    return this.getRuleBasedSuggestions(context);
  }

  /**
   * Rule-based suggestion generation
   * Fast, deterministic suggestions based on availability data
   */
  private static async getRuleBasedSuggestions(
    context: SuggestionContext
  ): Promise<DateSuggestion[]> {
    const suggestions: DateSuggestion[] = [];
    
    switch (context.errorType) {
      case 'minimum_stay':
        suggestions.push(...await this.getMinimumStaySuggestions(context));
        break;
      
      case 'unavailable_dates':
        suggestions.push(...await this.getAvailabilitySuggestions(context));
        break;
      
      case 'pricing_gap':
        suggestions.push(...await this.getPricingSuggestions(context));
        break;
    }
    
    // Sort by confidence score
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate suggestions for minimum stay violations
   */
  private static async getMinimumStaySuggestions(
    context: SuggestionContext
  ): Promise<DateSuggestion[]> {
    const { propertyId, originalCheckIn, errorDetails } = context;
    const requiredNights = errorDetails?.minimumStay || 2;
    const suggestions: DateSuggestion[] = [];
    
    // Strategy 1: Extend checkout date
    const extendedCheckOut = addDays(originalCheckIn, requiredNights);
    const extendedAvailability = await checkAvailabilityWithFlags(
      propertyId,
      originalCheckIn,
      extendedCheckOut
    );
    
    if (extendedAvailability.isAvailable) {
      suggestions.push({
        id: 'extend-stay',
        checkIn: originalCheckIn,
        checkOut: extendedCheckOut,
        nights: requiredNights,
        confidence: 0.95,
        reason: `Extend your stay to ${requiredNights} nights`,
        benefits: [
          `Meets minimum stay requirement`,
          `Same check-in date as requested`,
          `Quick and easy fix`
        ],
        algorithmUsed: 'rule_based'
      });
    }
    
    // Strategy 2: Shift dates earlier (if check-in is flexible)
    const earlierCheckIn = addDays(originalCheckIn, -7);
    const earlierCheckOut = addDays(earlierCheckIn, requiredNights);
    const earlierAvailability = await checkAvailabilityWithFlags(
      propertyId,
      earlierCheckIn,
      earlierCheckOut
    );
    
    if (earlierAvailability.isAvailable) {
      suggestions.push({
        id: 'earlier-dates',
        checkIn: earlierCheckIn,
        checkOut: earlierCheckOut,
        nights: requiredNights,
        confidence: 0.7,
        reason: 'Similar dates one week earlier',
        benefits: [
          `Available for ${requiredNights} nights`,
          `One week earlier than original`,
          `Meets all requirements`
        ],
        algorithmUsed: 'rule_based'
      });
    }
    
    // Strategy 3: Next available period with minimum stay
    const nextAvailable = await this.findNextAvailablePeriod(
      propertyId,
      originalCheckIn,
      requiredNights
    );
    
    if (nextAvailable) {
      suggestions.push({
        id: 'next-available',
        checkIn: nextAvailable.checkIn,
        checkOut: nextAvailable.checkOut,
        nights: requiredNights,
        confidence: 0.8,
        reason: 'Next available period',
        benefits: [
          `Closest available dates`,
          `Guaranteed availability`,
          `${differenceInDays(nextAvailable.checkIn, originalCheckIn)} days later`
        ],
        algorithmUsed: 'rule_based'
      });
    }
    
    return suggestions;
  }

  /**
   * Find next available period of specified duration
   */
  private static async findNextAvailablePeriod(
    propertyId: string,
    startFrom: Date,
    nights: number,
    maxDaysToSearch: number = 60
  ): Promise<{ checkIn: Date; checkOut: Date } | null> {
    let currentDate = new Date(startFrom);
    const endSearchDate = addDays(startFrom, maxDaysToSearch);
    
    while (isBefore(currentDate, endSearchDate)) {
      const potentialCheckOut = addDays(currentDate, nights);
      const availability = await checkAvailabilityWithFlags(
        propertyId,
        currentDate,
        potentialCheckOut
      );
      
      if (availability.isAvailable) {
        return {
          checkIn: currentDate,
          checkOut: potentialCheckOut
        };
      }
      
      // Move to next day
      currentDate = addDays(currentDate, 1);
    }
    
    return null;
  }

  /**
   * AI-enhanced suggestions using OpenAI
   */
  private static async getAISuggestions(
    context: SuggestionContext,
    timeout: number = 3000
  ): Promise<DateSuggestion[]> {
    // Implementation for OpenAI integration
    // This would call your OpenAI API with structured prompts
    
    const prompt = this.buildAIPrompt(context);
    
    try {
      const response = await Promise.race([
        this.callOpenAI(prompt),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('AI timeout')), timeout)
        )
      ]);
      
      if (response) {
        return this.parseAIResponse(response);
      }
    } catch (error) {
      console.warn('AI suggestion failed:', error);
    }
    
    return [];
  }

  private static buildAIPrompt(context: SuggestionContext): string {
    return `
      Property: ${context.propertyId}
      Original dates: ${format(context.originalCheckIn, 'MMM dd')} - ${format(context.originalCheckOut, 'MMM dd')}
      Guests: ${context.guestCount}
      Error: ${context.errorType}
      
      Suggest 3 alternative date ranges that would work better.
      Consider availability, pricing, and user convenience.
      Return as JSON array with checkIn, checkOut, reason, and benefits.
    `;
  }

  private static async callOpenAI(prompt: string): Promise<any> {
    // Placeholder for OpenAI API call
    // Would integrate with your OpenAI service
    return null;
  }

  private static parseAIResponse(response: any): DateSuggestion[] {
    // Parse OpenAI response into DateSuggestion objects
    return [];
  }
}
```

### Task 2.2: Date Suggestions API Endpoint

## 🔄 PRE-IMPLEMENTATION REQUIREMENTS - MANDATORY

**CRITICAL:** This task creates a new API endpoint. Before ANY implementation:

### Context Gathering Phase
1. **Study existing API patterns:**
   - `src/app/api/check-pricing/route.ts` - Current API structure and validation
   - `src/app/api/check-pricing-v2/route.ts` - API versioning patterns
   - `src/app/api/check-availability/route.ts` - Availability API patterns
   
2. **Understand API ecosystem:**
   - Current request/response formats
   - Error handling patterns
   - Input validation approaches
   - Rate limiting and security measures
   
3. **Analyze integration points:**
   ```bash
   # Understanding API consumption:
   grep -r "/api/check-pricing" src/ --include="*.tsx" --include="*.ts"
   grep -r "fetch.*api" src/ --include="*.tsx" --include="*.ts"
   ```

### Preservation Strategy (API Development)
- ✅ **NEW ENDPOINT:** Create `/api/date-suggestions` without modifying existing
- ✅ **SAME PATTERNS:** Follow existing API structure and validation
- ✅ **NO BREAKING:** Don't modify existing API contracts
- ✅ **ISOLATED:** New endpoint failures don't affect existing booking flow
- ❌ **NEVER CHANGE:** Existing API endpoints or responses
- ❌ **NO DEPENDENCIES:** Don't make existing APIs depend on new one

### Implementation Approach (API Safety)
```typescript
// ✅ CORRECT: New isolated endpoint
// File: src/app/api/date-suggestions/route.ts (NEW FILE)
export async function POST(request: NextRequest) {
  // New functionality that doesn't interfere with existing APIs
}

// ✅ CORRECT: Optional integration
const suggestions = await fetch('/api/date-suggestions', {...}).catch(() => []);
// Existing booking flow continues even if suggestions fail

// ❌ WRONG: Modify existing API
// Don't change check-pricing/route.ts!
```

**API DESIGN SAFETY:**
- Timeout protection for AI calls
- Graceful degradation when services unavailable
- Comprehensive input validation
- Consistent error response format

#### Complete Implementation Guide

**Step 1: Create API Endpoint**
File: `src/app/api/date-suggestions/route.ts` (NEW FILE)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { DateSuggestionEngine } from '@/lib/booking-v3/date-suggestion-engine';
import { getPropertyWithDb } from '@/lib/pricing/pricing-with-db';
import { parseISO } from 'date-fns';

/**
 * API endpoint for intelligent date suggestions
 * POST /api/date-suggestions
 * 
 * Reference existing API pattern: src/app/api/check-pricing/route.ts
 */

export interface DateSuggestionRequest {
  propertyId: string;
  checkInDate: string; // ISO date
  checkOutDate: string; // ISO date
  guests: number;
  errorType: 'minimum_stay' | 'unavailable_dates' | 'pricing_gap';
  errorContext?: {
    unavailableDates?: string[];
    requiredMinimumStay?: number;
    missingPricingDates?: string[];
  };
}

export interface DateSuggestionResponse {
  suggestions: Array<{
    id: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    confidence: number;
    reason: string;
    estimatedPrice?: number;
    benefits: string[];
  }>;
  metadata: {
    algorithmUsed: 'rule_based' | 'ai_enhanced';
    processingTime: number;
    availabilityChecked: boolean;
    pricingValidated: boolean;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    const body: DateSuggestionRequest = await request.json();
    
    // Input validation
    if (!body.propertyId || !body.checkInDate || !body.checkOutDate || !body.guests) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }
    
    // Parse dates
    const checkInDate = parseISO(body.checkInDate);
    const checkOutDate = parseISO(body.checkOutDate);
    
    // Validate dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (checkInDate < today) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      );
    }
    
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Invalid date range' },
        { status: 400 }
      );
    }
    
    // Verify property exists
    try {
      await getPropertyWithDb(body.propertyId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }
    
    // Generate suggestions
    const suggestions = await DateSuggestionEngine.generateSuggestions({
      propertyId: body.propertyId,
      originalCheckIn: checkInDate,
      originalCheckOut: checkOutDate,
      guestCount: body.guests,
      errorType: body.errorType,
      errorDetails: {
        minimumStay: body.errorContext?.requiredMinimumStay,
        unavailableDates: body.errorContext?.unavailableDates?.map(d => parseISO(d))
      }
    });
    
    // Format response
    const response: DateSuggestionResponse = {
      suggestions: suggestions.map(s => ({
        ...s,
        checkIn: s.checkIn.toISOString(),
        checkOut: s.checkOut.toISOString()
      })),
      metadata: {
        algorithmUsed: suggestions[0]?.algorithmUsed || 'rule_based',
        processingTime: Date.now() - startTime,
        availabilityChecked: true,
        pricingValidated: false // Would be true if we add pricing validation
      }
    };
    
    console.log(`[date-suggestions] Generated ${suggestions.length} suggestions in ${response.metadata.processingTime}ms`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[date-suggestions] Error generating suggestions:', error);
    
    // Return basic fallback suggestions on error
    return NextResponse.json({
      suggestions: [],
      metadata: {
        algorithmUsed: 'rule_based',
        processingTime: Date.now() - startTime,
        availabilityChecked: false,
        pricingValidated: false
      },
      error: 'Failed to generate suggestions'
    });
  }
}
```

#### Test Scenarios
```typescript
// Test file: src/app/api/date-suggestions/__tests__/route.test.ts
describe('Date Suggestions API', () => {
  it('should generate suggestions for minimum stay errors', async () => {
    const request = {
      propertyId: 'test-property',
      checkInDate: '2025-09-23',
      checkOutDate: '2025-09-24',
      guests: 2,
      errorType: 'minimum_stay',
      errorContext: {
        requiredMinimumStay: 2
      }
    };
    
    const response = await POST(new Request('http://localhost:3000/api/date-suggestions', {
      method: 'POST',
      body: JSON.stringify(request)
    }));
    
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.suggestions).toBeInstanceOf(Array);
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.suggestions[0].nights).toBe(2);
  });

  it('should handle invalid input gracefully', async () => {
    const request = {
      propertyId: 'test-property',
      // Missing required fields
    };
    
    const response = await POST(new Request('http://localhost:3000/api/date-suggestions', {
      method: 'POST',
      body: JSON.stringify(request)
    }));
    
    expect(response.status).toBe(400);
  });

  it('should timeout AI suggestions and fallback to rule-based', async () => {
    // Mock slow AI response
    jest.spyOn(DateSuggestionEngine, 'getAISuggestions').mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 5000))
    );
    
    const response = await POST(new Request('http://localhost:3000/api/date-suggestions', {
      method: 'POST',
      body: JSON.stringify(validRequest)
    }));
    
    const data = await response.json();
    expect(data.metadata.algorithmUsed).toBe('rule_based');
    expect(data.metadata.processingTime).toBeLessThan(4000);
  });
});
```

---

## EPIC 3: Mobile-First Error Experience

### Task 3.1: Mobile Error Components Architecture

## 🔄 PRE-IMPLEMENTATION REQUIREMENTS - MANDATORY

**CRITICAL:** This task modifies mobile-specific UI components. Before ANY implementation:

### Context Gathering Phase
1. **Study current mobile behavior:**
   - `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx:45-65` - Mobile wrapper logic
   - `src/components/booking-v2/containers/BookingPageV2.tsx` - Mobile vs desktop rendering
   - `src/components/ui/touch-target.tsx` - Touch interaction patterns
   
2. **Understand mobile responsive system:**
   - How are mobile breakpoints defined? (Tailwind `md:`, `lg:` classes)
   - What determines mobile vs desktop component rendering?
   - How do touch interactions currently work?
   
3. **Analyze mobile-specific state management:**
   ```bash
   # Mobile-specific analysis commands:
   grep -r "md:hidden\|lg:hidden\|sm:hidden" src/ --include="*.tsx"
   grep -r "useMediaQuery\|mobile\|Mobile" src/ --include="*.tsx" --include="*.ts"
   grep -r "touch\|Touch\|44px" src/ --include="*.tsx" --include="*.ts"
   ```

### Preservation Strategy (Mobile Components)
- ✅ **PRESERVE:** All current mobile responsive behavior
- ✅ **MAINTAIN:** Existing touch target sizes (minimum 44px)
- ✅ **KEEP WORKING:** Current mobile navigation and gestures
- ✅ **PERFORMANCE:** Don't slow down mobile devices
- ❌ **NEVER BREAK:** Existing mobile booking flow
- ❌ **NO REGRESSION:** Performance on lower-end mobile devices

### Implementation Approach (Mobile Safety)
```typescript
// ✅ CORRECT: Add mobile error features conditionally
const isMobile = useMediaQuery('(max-width: 768px)');
const useMobileV3 = FEATURE_FLAGS.useMobileV3ErrorSystem;

{isMobile && useMobileV3 ? (
  <MobileErrorSystem />  // NEW V3
) : isMobile ? (
  // EXISTING mobile behavior (PRESERVE)
  <div className="md:hidden">
    {pricingError && <PricingStatusDisplay />}
  </div>
) : (
  // Desktop behavior
  <DesktopErrorDisplay />
)}
```

---

### Task 1.3: BookingContext V3 Integration

**What to achieve:** Extend BookingContext to handle structured errors alongside current string-based errors

**Why this approach:** BookingContext is consumed by many components - changes must be additive, not destructive. The current `pricingError: string | null` works well for existing components.

**Key insight:** React contexts are like APIs - breaking changes ripple through the entire application. The safest approach is dual-state management where V2 and V3 coexist.

### Context Gathering - Understanding Dependencies
**Study these integration patterns:**
- `src/contexts/BookingContext.tsx` - Current interface structure and state management
- Find all components using `useBookingContext()` to understand impact scope
- Look at how other optional features are added to contexts in this codebase

### Architectural Principles

**Dual-State Strategy:** Maintain compatibility while enabling enhancement
- Keep existing `pricingError: string | null` unchanged
- Add optional `bookingErrors: BookingErrorV3[]` array alongside it
- Synchronize both states: when V3 error added, update V2 string for compatibility

**Interface Extension Pattern:**
- Add optional properties to `BookingContextType` interface
- Provide default implementations that don't break existing consumers
- Use conditional logic: components can choose V2 or V3 error handling

**State Management Approach:**
- V3 errors are the source of truth for rich functionality
- V2 string errors are derived from V3 for backward compatibility
- Recovery actions update context state through existing methods

**Integration wisdom:** Look at mobile vs desktop rendering patterns in the codebase - apply similar conditional approach for V2 vs V3 error handling

---

### Task 3.2: Collapsed Banner Error States

**What to achieve:** Show error indicators in mobile collapsed banner without forcing expansion

**Why this matters:** Currently, any error forces mobile wrapper to expand, losing the UX benefit of collapsed state. Users should see error hints while maintaining compact view.

**Key insight:** The `isGreenState` calculation in MobileDateSelectorWrapper determines collapsed vs expanded. Study this logic - it's the heart of mobile UX optimization.

### Context Gathering - Mobile State Logic
**Study these mobile patterns:**
- `src/components/booking-v2/components/MobileDateSelectorWrapper.tsx` - How collapsed/expanded transitions work
- Current banner content structure and available space for indicators
- Look at other mobile components that show status indicators in compact views

### Architectural Principles

**Graceful Degradation:** Not all errors should force expansion
- **Blocking errors:** Auto-expand immediately (preserve current behavior)
- **Warning/info errors:** Show indicator in collapsed state, expand on tap
- **Multiple errors:** Show most severe indicator with count

**Visual Integration:** Subtle indicators that don't break existing design
- Small badges or dots that fit existing banner layout
- Color coding that matches error severity (red for blocking, amber for warnings)
- Position indicators where they don't interfere with current functionality

**State Management Logic:** Extend `isGreenState` calculation
- Current logic: `checkInDate && checkOutDate && pricing && !pricingError`
- Enhanced logic: Consider error severity in state determination
- Maintain backward compatibility for components depending on green state

**UX Philosophy:** Progressive disclosure - show just enough information to guide without overwhelming

---

### Task 3.3: Progressive Error Recovery

**What to achieve:** Guide users through error resolution with step-by-step assistance instead of showing complex recovery options all at once

**Why progressive approach:** Mobile screens are small and cognitive load is high during errors. Breaking recovery into simple steps reduces overwhelm and increases success rates.

**Key insight:** Users experiencing errors are often frustrated - simplify their path to success with clear, sequential guidance.

### Context Gathering - Flow Patterns
**Study these user flow patterns:**
- Look for multi-step processes in the codebase (onboarding, checkout flows, etc.)
- Current mobile navigation patterns and how users move between states
- How progress is typically indicated in existing components

### Architectural Principles

**Cognitive Load Reduction:** One decision at a time
- Present one clear action per step rather than multiple recovery options
- Use wizard-like flow: "Step 1 of 3: Extend your stay"
- Provide context for each step: why this action helps

**Mobile-First Design:** Touch-friendly interactions
- Large touch targets (minimum 44px height)
- Clear primary action buttons with secondary "skip" options
- Swipe gestures or simple taps for navigation

**Progress Communication:** Keep users oriented
- Visual progress indicators (step counter, progress bar)
- Clear explanation of what each step accomplishes
- Option to see all steps at once for users who prefer overview

**Adaptive Guidance:** Tailor steps to error type
- **Minimum stay errors:** Guide through date extension or alternative date selection
- **Availability errors:** Walk through flexible date exploration
- **Pricing errors:** Help find dates with complete pricing data

**Recovery Philosophy:** Make success feel inevitable through guided assistance

---

### Task 4.1: Auto-Correction Engine

**What to achieve:** Automatically fix common booking errors with high-confidence corrections while giving users control over the process

**Why auto-correction:** Many booking errors have obvious fixes (extend checkout by 1 night for minimum stay). Smart corrections reduce friction and guide users toward successful bookings.

**Key insight:** The difference between helpful automation and annoying interference is confidence scoring. High-confidence fixes can be auto-applied; lower confidence should be suggested.

### Context Gathering - Booking Logic Patterns
**Study these correction opportunities:**
- `src/contexts/BookingContext.tsx` - How date and guest updates currently work
- Common error patterns from existing API responses
- Look for existing "smart" behavior in date selectors or validation

### Architectural Principles

**Confidence-Based Actions:** Different behaviors for different certainty levels
- **High confidence (>0.8):** Auto-apply with notification ("Fixed: Extended to 2 nights")
- **Medium confidence (0.5-0.8):** Suggest with prominent button ("Extend to 2 nights?")
- **Low confidence (<0.5):** Show as option alongside others

**Context-Aware Corrections:** Smart fixes based on error type and user intent
- **Minimum stay violations:** Extend checkout if dates are available, or suggest earlier check-in
- **Guest capacity issues:** Suggest reducing guest count to property maximum
- **Date order problems:** Auto-swap check-in/checkout if user likely made mistake

**Integration with Existing Logic:** Use current BookingContext methods
- Don't duplicate date/guest update logic - use existing context functions
- Trigger existing validation flows after corrections
- Respect existing booking state management patterns

**User Control Philosophy:** Always provide escape hatches and transparency
- Show what was changed and why
- Provide undo option for auto-applied corrections
- Allow users to override or modify suggested fixes

**Common mistake to avoid:** Don't make corrections that could surprise users - transparency is key

---

### Task 4.2: Alternative Flow Suggestions

**What to achieve:** Transform booking errors into opportunities by showing visual alternatives that help users find what they're looking for

**Why visual alternatives:** When dates don't work, showing a calendar heatmap with availability and pricing helps users make informed decisions rather than just telling them "no."

**Key insight:** Users often have flexibility they don't realize - alternative durations or nearby dates might work perfectly for their needs.

### Context Gathering - Calendar Patterns
**Study these visual interfaces:**
- Current React-day-picker implementation patterns
- How availability is currently displayed in calendars
- Look for existing heatmap or color-coding patterns in the UI

### Architectural Principles

**Visual Decision Making:** Help users see their options
- **Availability heatmap:** Color-code dates by availability (green=available, red=blocked, yellow=limited)
- **Pricing indicators:** Show relative pricing with visual cues ($ symbols, color gradients)
- **Duration flexibility:** Highlight date ranges that work for different stay lengths

**Alternative Exploration:** Guide users toward feasible options
- **Shorter stays:** If 5 nights doesn't work, show 3-4 night options
- **Longer stays:** Sometimes extending a stay avoids weekend premiums
- **Seasonal timing:** "These dates are popular, but week after is 20% cheaper"

**One-Tap Application:** Make selection effortless
- Click any suggested date range to apply immediately
- Preview pricing and availability before confirming
- Maintain context of original preferences while exploring alternatives

---

### Task 4.3: Booking Assistance Integration

**What to achieve:** Connect users with human help when automated suggestions aren't sufficient, using context from their booking attempt

**Why assisted booking:** Some date/pricing situations are complex - connecting users with knowledgeable assistance turns frustration into successful bookings.

**Key insight:** Frustrated users provided with personalized human help become loyal customers - the error becomes an opportunity for exceptional service.

### Context Gathering - Communication Patterns
**Study existing support systems:**
- Current contact forms, chat systems, or inquiry processes
- How property managers or hosts currently communicate with guests
- Look at support ticket systems or CRM integration patterns

### Architectural Principles

**Context-Aware Assistance:** Pre-populate support requests with booking details
- Include attempted dates, guest count, specific errors encountered
- Attach property details and user preferences for personalized responses
- Show booking history for returning users

**Smart Matching Philosophy:** Connect users with properties that might work
- "Help me find dates" wizard that captures flexibility and priorities
- Match user preferences against property calendars automatically
- Present curated options rather than overwhelming choices

**Proactive Communication:** Reach out before users give up
- "Notify when available" system for desired dates
- Alert system when pricing changes or availability opens up
- Follow-up on abandoned bookings with personalized suggestions

---

### Task 5.1: Error Analytics Implementation

**What to achieve:** Understand error patterns to improve the booking system and reduce future errors

**Why analytics matter:** Data-driven error reduction prevents problems at the source rather than just handling them better after they occur.

**Key insight:** Error analytics should drive product improvements, not just reporting - look for actionable patterns that suggest system changes.

### Context Gathering - Current Tracking
**Study existing measurement systems:**
- Current Google Analytics or tracking implementations
- Event tracking patterns used elsewhere in the application
- Privacy policies and compliance requirements for user data

### Architectural Principles

**Actionable Insights:** Track metrics that drive improvements
- **Error frequency by type:** Which errors happen most often?
- **Resolution success rates:** Which recovery methods work best?
- **Property-specific patterns:** Do certain properties have recurring issues?
- **User journey mapping:** Where in the booking flow do errors cluster?

**Privacy-First Design:** Anonymous and compliance-focused
- Track error patterns without storing personal information
- Aggregate data to protect individual user privacy
- Focus on system behavior rather than user identification

---

### Task 5.2: Recommendation Effectiveness Tracking

**What to achieve:** Measure how well smart suggestions work to continuously improve the recommendation algorithms

**Why effectiveness tracking:** Smart suggestions are only valuable if they actually help users complete bookings - measure success to optimize the system.

**Key insight:** Track the full funnel from suggestion to successful booking, not just suggestion acceptance rates.

### Architectural Principles

**Full-Funnel Measurement:** Track complete user journey
- **Suggestion acceptance:** Which recommendations do users try?
- **Booking completion:** Do accepted suggestions lead to successful bookings?
- **User satisfaction:** Are users happy with suggested alternatives?

**Algorithm Optimization:** Compare different approaches
- Rule-based vs AI-enhanced suggestions performance
- Confidence scoring accuracy (were high-confidence suggestions actually good?)
- Seasonal and property-specific effectiveness patterns

---

### Task 5.3: Continuous Improvement System

**What to achieve:** Automatically identify opportunities to improve error handling and booking success

**Why continuous improvement:** Booking systems are complex - automated monitoring helps catch issues before they become widespread problems.

**Key insight:** The best improvements often come from identifying patterns humans miss - automate the analysis of error data to surface optimization opportunities.

### Architectural Principles

**Pattern Recognition:** Identify systematic issues
- **Recurring error clusters:** Same errors happening across multiple properties or time periods
- **Performance degradation:** When error rates increase or resolution rates decrease
- **Seasonal optimization:** Timing patterns that suggest calendar or pricing improvements

**Proactive Alerts:** Surface issues before they impact users
- **Error spike detection:** Unusual increases in specific error types
- **Success rate drops:** When fewer users successfully complete bookings after errors
- **Suggestion effectiveness decline:** When recommendations stop working well

**Simple Reporting:** Actionable summaries for decision makers
- Weekly error pattern summaries with specific improvement recommendations
- Monthly effectiveness reports showing system performance trends
- Property-specific insights for hosts and property managers

---

# Testing Strategy

## What to Test

### Core Error System
- **Error Factory:** Test conversion from API responses to structured errors
- **Error Display:** Test error rendering with different severities  
- **Recovery Actions:** Test action execution and context updates
- **Backward Compatibility:** Test that V2 error handling still works

### Smart Recommendations  
- **Suggestion Generation:** Test algorithms produce valid suggestions
- **API Integration:** Test new endpoint handles requests correctly
- **Availability Integration:** Test suggestions use real availability data

### Mobile Experience
- **Responsive Behavior:** Test error handling on mobile vs desktop
- **Touch Interactions:** Test mobile error recovery flows
- **Auto-Expand Logic:** Test when mobile wrapper expands for errors

### Integration Points
- **Context Updates:** Test BookingContext changes don't break existing components
- **API Compatibility:** Test new features don't break existing booking flow
- **Error Recovery Flow:** Test complete user journey from error to successful booking

## Testing Approach
- **Unit Tests:** Test individual functions and components in isolation
- **Integration Tests:** Test component interactions and data flow
- **Manual Testing:** Test actual user scenarios on real devices
- **Regression Testing:** Verify existing booking flow remains functional

---

# Common Pitfalls & Warnings

## Integration Pitfalls

### 1. State Synchronization Issues
**Problem:** V2 `pricingError` and V3 `bookingErrors` get out of sync  
**Solution:** Always update both states together
```typescript
// WRONG
setBookingErrors([newError]);

// CORRECT
setBookingErrors([newError]);
setPricingError(newError.message); // Maintain V2 compatibility
```

### 2. Mobile Wrapper Conflicts
**Problem:** Mobile wrapper's `isGreenState` logic conflicts with V3 errors  
**Solution:** Update isGreenState calculation
```typescript
// Update MobileDateSelectorWrapper.tsx
const isGreenState = checkInDate && checkOutDate && pricing && 
                     !pricingError && bookingErrors.length === 0;
```

### 3. Recovery Action Side Effects
**Problem:** Recovery actions trigger multiple pricing calls  
**Solution:** Debounce pricing calls
```typescript
const debouncedFetchPricing = useMemo(
  () => debounce(fetchPricing, 500),
  [fetchPricing]
);
```

### 4. Error Display Duplication
**Problem:** Both V2 and V3 error displays render simultaneously  
**Solution:** Conditional rendering based on error system version
```typescript
{bookingErrors.length > 0 ? (
  <BookingErrorDisplay /> // V3
) : pricingError ? (
  <PricingStatusDisplay /> // V2 fallback
) : null}
```

## Performance Considerations

### 1. Availability Checking in Suggestions
**Issue:** Multiple availability checks slow down suggestion generation  
**Mitigation:** Batch availability checks
```typescript
// Check multiple date ranges in parallel
const availabilityChecks = await Promise.all(
  potentialDates.map(dates => checkAvailabilityWithFlags(...))
);
```

### 2. AI Suggestion Timeout
**Issue:** Waiting for AI responses blocks user interaction  
**Mitigation:** Always use timeout with fallback
```typescript
const AI_TIMEOUT = 3000; // 3 seconds max
Promise.race([aiCall(), timeout(AI_TIMEOUT)])
```

## TypeScript Gotchas

### 1. Error Type Narrowing
**Issue:** TypeScript can't narrow error types in arrays  
**Solution:** Use type guards
```typescript
function isMinimumStayError(error: BookingErrorV3): error is MinimumStayError {
  return error.type === ErrorType.MINIMUM_STAY;
}
```

### 2. Async Recovery Actions
**Issue:** Recovery action types don't enforce async  
**Solution:** Explicit Promise return type
```typescript
action: (): Promise<RecoveryResult> => {
  // Must return Promise
}
```

---

## Implementation Guidelines

### Getting Started
1. **Review Current System:** Understand existing V2 booking flow thoroughly
2. **Start with Foundation:** Implement error types and BookingContext extensions first  
3. **Build Incrementally:** Add each feature alongside existing functionality
4. **Test Continuously:** Verify V2 compatibility after each change

### Development Process
- **Preserve V2 Functionality:** Always maintain backward compatibility
- **Add V3 Conditionally:** Use simple toggles to switch between V2 and V3
- **Test on Real Devices:** Especially mobile error handling flows
- **Document Changes:** Note any architectural decisions or deviations

### Architecture Integration
Components work together as follows:
- **BookingContext:** Central state management for both V2 and V3 errors
- **Error Factory:** Converts API responses to structured V3 errors
- **Error Display:** Renders errors with recovery actions (desktop/mobile)
- **Suggestion Engine:** Provides intelligent date alternatives
- **Recovery Actions:** Allow users to fix errors automatically or manually

---

**Document Complete - Guidance-Based Specification**  
**Total Specification Pages:** ~85 pages  
**Implementation Ready:** Yes  
**External Developer Ready:** Yes - Guidance-focused approach  
**AI Assistant Compatible:** Yes - Architectural guidance over prescriptive code  
**Philosophy:** What & Why over How - Empowers decision-making