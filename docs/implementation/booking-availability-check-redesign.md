# Booking/Availability Check Page Redesign Implementation

## Overview

This document outlines the agreed redesign for the booking/availability check page, focusing on layout improvements while preserving all existing functionality.

## Agreed Solution

### Design Principles
1. **Preserve Core Functionality** - No changes to business logic or data flow
2. **Enhance Visual Layout** - Better use of screen space and visual hierarchy
3. **Respect Existing Systems** - Maintain multilingual and theme support
4. **Progressive Enhancement** - CSS-first approach with minimal JS changes

### Layout Specifications

#### Desktop Layout (≥768px)
```
┌─────────────────────────────────────────────┐
│ [← Back to Property] Header                 │
├─────────────────┬───────────────────────────┤
│ Property        │ Availability Check       │
│ Context (30%)   │ Content (70%)            │
│                 │                           │
│ [Hero Image]    │ ✓ Available               │
│                 │ Your dates: May 15-20     │
│ Selected Dates  │                           │
│ May 15-20       │ [Book Now Card]    Active│
│ 5 nights        │ [Hold Card]              │
│                 │ [Contact Card]           │
│ Total Price     │                           │
│ €900            │ [Booking Form Area]      │
│                 │                           │
└─────────────────┴───────────────────────────┘
```

#### Mobile Layout (<768px)
```
┌─────────────────────────────┐
│ [← Back] Property Name      │
│ Sticky Header               │
├─────────────────────────────┤
│ May 15-20 • 5 nights • €900 │
│ Sticky Summary              │
├─────────────────────────────┤
│ ✓ Available                 │
│                             │
│ [Book Now Card] ▼           │
│   [Form Content]            │
│                             │
│ [Hold Card] ▷               │
│ [Contact Card] ▷            │
└─────────────────────────────┘
```

### Component Structure

The implementation will modify these components:
- `/src/components/booking/container/AvailabilityContainer.tsx`
- `/src/app/booking/check/[slug]/page.tsx`
- New: `/src/components/booking/container/BookingCheckLayout.tsx`

### CSS Architecture

All styling will use:
- Tailwind CSS utilities
- Theme CSS variables
- Responsive breakpoints
- Mobile-first approach

## Implementation Phases

### Phase 1: Layout Structure (CSS-only)
- Create responsive grid layout
- Add property context panel (desktop)
- Implement sticky elements (mobile)
- Set up proper spacing

### Phase 2: Visual Enhancements
- Apply theme variables correctly
- Add loading skeletons
- Improve card hover states
- Enhance form field styling

### Phase 3: Interaction Improvements
- Add smooth transitions
- Implement accordion behavior (mobile)
- Improve focus management
- Add keyboard navigation support

### Phase 4: Testing & Refinement
- Cross-browser testing
- Theme compatibility check
- Multilingual text overflow testing
- Performance optimization

## Technical Constraints

### Must Preserve
- All existing props and interfaces
- Form submission handlers
- API call structures
- State management logic
- URL parameter handling

### Can Modify
- CSS classes and styling
- Layout structure
- Visual spacing
- Animation/transitions
- Loading states

## Theme Integration

The redesign will respect all theme variables:
```css
/* Example theme variable usage */
.booking-card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
}

.booking-button {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: var(--button-radius);
}
```

## Multilingual Considerations

All text must use proper translation functions:
```typescript
// Correct usage with tc()
<h2>{tc(property.name)}</h2>
<Input placeholder={tc(t.booking.guestName.placeholder)} />
<span>{tc(property.advertisedRateType) || "from"}</span>
```

## Risk Mitigation

### Testing Strategy
1. Create feature branch for isolation
2. Test all form submissions
3. Verify Stripe redirects work
4. Check all themes and languages
5. Test on multiple devices

### Rollback Plan
- Keep original components as backups
- Use feature flags for gradual rollout
- Maintain separate CSS files
- Document all changes clearly

## Success Metrics

The redesign will be considered successful when:
- All existing functionality works identically
- Layout adapts smoothly across breakpoints
- Performance metrics remain unchanged
- No new console errors or warnings
- All themes display correctly
- Both languages work properly

## Related Documentation
- [Booking Component Architecture](../architecture/booking-component.md)
- [Theme System Implementation](./theme-system-implementation.md)
- [Multilingual Implementation Status](./multilingual-implementation-status.md)