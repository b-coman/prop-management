# V2 BookingOptionsCards Integration Test

**Date**: May 31, 2025
**Component**: BookingOptionsCards integration with V2

## What to Test

1. **Booking Options Display**:
   - After selecting dates and checking pricing
   - Should show Book Now, Hold, and Contact options (based on property config)
   - Options should display correct pricing

2. **Action Selection**:
   - Click each option (Book Now, Hold, Contact)
   - Should hide options and show placeholder form
   - Should log action to console: `[V2] Selected booking action`

3. **Back Navigation**:
   - Click "Back to options" link
   - Should return to booking options display

4. **State Persistence**:
   - Select an action
   - Refresh the page
   - Action should clear (we don't persist selectedAction yet)

## Expected Console Logs

When selecting an action, you should see:
```
[bookingContext:DEBUG] [V2] Selected booking action {action: "book"}
```

## Known Limitations

- Forms show placeholder text only (not integrated yet)
- No actual booking submission
- selectedAction not persisted to session storage

## Next Steps

Once BookingOptionsCards work correctly:
1. Integrate BookingForm for "book" action
2. Integrate HoldForm for "hold" action
3. Integrate ContactHostForm for "contact" action