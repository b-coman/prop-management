# V2 Forms Integration Test Guide

**Date**: May 31, 2025
**Status**: Ready for Testing
**Phase**: 2.2 - Form Integration

## What's Been Integrated

✅ **All three forms are now connected to V2:**
- ContactHostForm - For inquiries
- HoldForm - For 24-hour holds  
- BookingForm - For direct bookings

## Testing Steps

### 1. Contact Form Test
1. Select dates and check pricing
2. Click "Contact for Details"
3. **Expected**: Real contact form should appear (not placeholder)
4. Fill out the form fields (should auto-populate from V2 context)
5. Click submit
6. **Expected**: Console log showing form submission data

### 2. Hold Form Test  
1. Go back to options
2. Click "Hold for 24 Hours"
3. **Expected**: Real hold form with fee display
4. Fill out the form
5. Click submit
6. **Expected**: Console log showing hold submission

### 3. Booking Form Test
1. Go back to options  
2. Click "Book Now"
3. **Expected**: Full booking form with coupon section
4. Fill out the form
5. Click submit
6. **Expected**: Console log showing booking submission

## What to Look For

### ✅ **Success Indicators:**
- Forms appear instantly (no loading)
- Guest info fields pre-populate from URL/context
- All form fields are functional
- Submission shows console log: `[V2] Form submission: {action: "contact", formData: {...}}`
- Forms handle validation properly
- "← Back to options" works from any form

### ❌ **Potential Issues:**
- TypeScript compilation errors
- Forms not appearing (blank space)
- Fields not pre-populating
- Submission failures
- Missing form validation

## Current Limitations

- **Server actions not connected** - Forms show placeholder submission
- **Coupon functionality** - Basic placeholder (TODO)
- **Stripe integration** - Not connected yet (next phase)

## Expected Console Output

When submitting any form:
```
[V2] Form submission: {
  action: "contact",
  formData: {
    formData: {...},
    pricingDetails: {...},
    currency: "EUR"
  }
}
```

## Next Steps After Testing

If forms work correctly:
1. Connect to real server actions
2. Test Stripe integration
3. Handle success/error states
4. Add form persistence to session storage

## Critical Success Criteria

For this phase to be considered complete:
- [ ] All three forms render correctly
- [ ] Guest info pre-populates from V2 context
- [ ] Form submission logs show correct data structure
- [ ] No TypeScript or runtime errors
- [ ] Navigation between options and forms works smoothly