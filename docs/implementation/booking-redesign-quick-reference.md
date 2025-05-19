# Booking Redesign - Quick Reference

## What We're Changing
✅ Layout and visual presentation  
✅ CSS classes and spacing  
✅ Loading states and animations  
✅ Mobile responsiveness  

## What We're NOT Changing
❌ NO changes to form submission logic  
❌ NO changes to API calls  
❌ NO changes to state management  
❌ NO changes to URL structure  
❌ NO changes to component props  

## Key Files to Modify

### Primary Components
- `/src/components/booking/container/AvailabilityContainer.tsx`
- `/src/app/booking/check/[slug]/page.tsx`

### New Components
- `/src/components/booking/container/BookingCheckLayout.tsx` (to be created)

## CSS Classes to Use

```css
/* Always use theme variables */
background: hsl(var(--background));
color: hsl(var(--foreground));
border-color: hsl(var(--border));

/* Never hardcode colors */
/* ❌ background: #ffffff; */
/* ✅ background: hsl(var(--background)); */
```

## Multilingual Checklist

```typescript
// Always use tc() for strings
✅ placeholder={tc(t.booking.placeholder)}
❌ placeholder={t.booking.placeholder}

// Handle property fields
✅ <h2>{tc(property.name)}</h2>
❌ <h2>{property.name}</h2>
```

## Theme Testing

Test with all 5 themes:
1. Airbnb (default)
2. Ocean Blue
3. Forest Green  
4. Modern Minimal
5. Luxury Estate

## Mobile Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) {
  /* Desktop styles */
}
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/booking-availability-redesign

# Make changes
git add .
git commit -m "feat: implement booking page layout improvements"

# Test thoroughly before merge
npm run test
npm run build
```

## Testing Commands

```bash
# Local development
npm run dev

# Build test
npm run build

# Type checking
npm run type-check
```

## Rollback Plan

1. Keep backups of original components
2. Use feature flags if needed
3. Test on staging first
4. Quick revert capability via git

## Success Metrics

- [ ] All existing tests pass
- [ ] No console errors
- [ ] Performance unchanged
- [ ] Works on all devices
- [ ] All themes display correctly
- [ ] Both languages work

## Remember

🚨 **PRESERVE ALL FUNCTIONALITY**  
🚨 **TEST EVERYTHING**  
🚨 **DON'T BREAK WHAT WORKS**