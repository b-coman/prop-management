# Production Readiness Testing Checklist

**Property:** prahova-mountain-chalet
**Date:** 2026-02-02
**Tester:** Manual testing before production launch

---

## Pre-Testing Setup

- [x] Stripe is in TEST mode (check dashboard)
- [x] Test card: `4242 4242 4242 4242` (any future date, any CVC)
- [x] Ethereal email configured (auto in dev mode)
- [x] Using deployed version at prop-management--rentalspot-fzwom.europe-west4.hosted.app

---

## Test 1: Booking Flow (Full Payment)

**URL:** `/booking/check/prahova-mountain-chalet`

### Steps:
1. [x] Select check-in date (tested: Feb 19-21, Apr 2-5, 2026)
2. [x] Select check-out date
3. [x] Select guests (2 guests)
4. [x] Verify pricing displays correctly
5. [x] Click "Book Now" tab
6. [x] Fill guest info
7. [x] Click "Continue to Payment"
8. [x] Verify redirect to Stripe Checkout
9. [x] Complete payment with test card
10. [x] Verify redirect to success page

### Verify After Booking:
- [x] **Firestore:** Check `bookings` collection for new document
  - Status: `confirmed` ✓
  - Payment status: `paid` ✓
  - Guest info matches input ✓
  - Pricing matches displayed price ✓ (after currency fix)
- [x] **Firestore:** Check `availability` collection
  - Dates marked unavailable ✓
- [ ] **Email:** Check Ethereal for booking confirmation email
  - Not yet tested (need to click "Send Confirmation Email" button)
- [x] **Calendar:** Dates show as unavailable on property page ✓

### Result:
- [x] PASS (after bug fixes)
- Notes: Multiple issues found and fixed during testing (see Issues Found section)

### Test Bookings Created:
- Booking ID: `y7vFHNAkGFFeGu3KRgzL` (Apr 2-5, 2026, RON 2,887.39)

---

## Test 2: Hold Flow (Temporary Reservation)

**URL:** `/booking/check/prahova-mountain-chalet`

### Steps:
1. [ ] Select different dates (e.g., April 10-13, 2026)
2. [ ] Select guests
3. [ ] Verify pricing displays
4. [ ] Click "Hold Dates" tab
5. [ ] Fill guest info
6. [ ] Click "Pay to Hold Dates"
7. [ ] Verify hold fee amount is correct (should be property.holdFeeAmount)
8. [ ] Complete Stripe payment with test card
9. [ ] Verify redirect to hold success page

### Verify After Hold:
- [ ] **Firestore:** Check `bookings` collection
  - Status should be `hold`
  - `holdUntil` timestamp should be ~48 hours from now
  - `holdFeeAmount` recorded
- [ ] **Firestore:** Check `availability` collection
  - Dates should have hold ID in `holds` map
- [ ] **Email:** Check Ethereal for hold confirmation email
  - Shows hold expiration time
  - Shows how to convert to full booking
- [ ] **Calendar:** Dates should show as unavailable

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 3: Hold Expiration (Cleanup System)

**Note:** This tests the cron job at `/api/cron/release-holds`

### Steps:
1. [ ] Create a hold (or use existing from Test 2)
2. [ ] Manually update `holdUntil` in Firestore to a past time
3. [ ] Trigger the cron endpoint manually:
   ```
   curl -X POST https://prop-management--rentalspot-fzwom.europe-west4.hosted.app/api/cron/release-holds \
     -H "Authorization: Bearer [CRON_SECRET]"
   ```
4. [ ] Or wait for hourly cron to run

### Verify After Expiration:
- [ ] **Firestore:** Booking status changed to `expired`
- [ ] **Firestore:** Availability dates released (holds map cleared)
- [ ] **Calendar:** Dates should be available again

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 4: Contact/Inquiry Flow

**URL:** `/booking/check/prahova-mountain-chalet`

### Steps:
1. [ ] Select dates and guests
2. [ ] Click "Contact Host" tab
3. [ ] Fill guest info
4. [ ] Enter message: "Test inquiry message for property"
5. [ ] Click "Send Message"
6. [ ] Verify success message appears

### Verify After Inquiry:
- [ ] **Firestore:** Check `inquiries` collection for new document
  - Contains guest info
  - Contains message
  - Contains selected dates
- [ ] **Email:** Check Ethereal for:
  - Guest confirmation email
  - Admin notification email (to admin@rentalspot.com placeholder)

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 5: Availability Blocking

### Steps:
1. [ ] Note dates that are already booked/held from previous tests
2. [ ] Go to booking page
3. [ ] Try to select those same dates

### Expected Behavior:
- [ ] Dates show as unavailable in calendar (strikethrough)
- [ ] If selected anyway, pricing API returns error
- [ ] Error message displays correctly

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 6: Pricing Calculation

**Test various scenarios:**

### 6a: Base Pricing
- [ ] Select dates within base pricing
- [ ] Verify: (nights × base rate) + cleaning fee = total

### 6b: Extra Guests
- [ ] Select guests above base occupancy
- [ ] Verify extra guest fee is added

### 6c: Minimum Stay
- [ ] Try to select fewer nights than minimum
- [ ] Verify error message appears

### 6d: Currency Switching
- [ ] Change currency (EUR → USD → RON)
- [ ] Verify prices update correctly

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 7: Stripe Webhook Handling

**This verifies the webhook processes payments correctly**

### Steps:
1. [ ] Complete a test booking (or use Stripe CLI to simulate)
2. [ ] Check Stripe Dashboard → Developers → Webhooks
3. [ ] Verify webhook was received and succeeded

### Verify:
- [ ] Webhook endpoint returns 200
- [ ] No errors in webhook logs
- [ ] Firestore updated correctly after webhook

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 8: Error Handling

### 8a: Payment Failure
1. [ ] Start booking flow
2. [ ] Use decline test card: `4000 0000 0000 0002`
3. [ ] Verify graceful error handling
4. [ ] Verify no booking created in Firestore

### 8b: Network Error Simulation
1. [ ] Start booking, disconnect network before payment
2. [ ] Verify appropriate error message

### 8c: Invalid Dates
1. [ ] Try to book past dates
2. [ ] Verify error handling

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 9: Mobile Responsiveness

### Steps:
1. [ ] Open booking page on mobile (or DevTools mobile view)
2. [ ] Complete full booking flow
3. [ ] Verify:
   - [ ] Date picker works on mobile
   - [ ] Forms are usable
   - [ ] Buttons are tappable
   - [ ] Price drawer works

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Test 10: Multi-Language

### Steps:
1. [ ] Switch language to Romanian
2. [ ] Verify all UI text is translated
3. [ ] Complete booking flow
4. [ ] Check email - should have bilingual content

### Result:
- [ ] PASS / FAIL
- Notes: _______________

---

## Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Booking Flow | PASS | 7 issues found and fixed during testing |
| 2. Hold Flow | PENDING | |
| 3. Hold Expiration | PENDING | |
| 4. Inquiry Flow | PENDING | |
| 5. Availability Blocking | PARTIAL | Works (dates blocked after booking) |
| 6. Pricing Calculation | PARTIAL | Base pricing + currency switching tested |
| 7. Stripe Webhooks | PASS | Working after URL fix |
| 8. Error Handling | PENDING | |
| 9. Mobile | PENDING | |
| 10. Multi-Language | PENDING | |

---

## Issues Found

| # | Description | Severity | Status | Commit |
|---|-------------|----------|--------|--------|
| 1 | Availability inconsistency: missing docs treated as unavailable by availability-service but available by check-availability API | High | FIXED | - |
| 2 | Missing `booking_id` in Stripe success redirect URL - success page showed "No booking ID found" | High | FIXED | - |
| 3 | Stripe webhook 404 - webhook URL was pointing to old dev URL | High | FIXED | Manual fix in Stripe Dashboard |
| 4 | Price mismatch: EUR prices sent to Stripe labeled as RON (charged 580 instead of 2887) | Critical | FIXED | 8faea2a |
| 5 | Success page not applying property theme | Low | FIXED | e14de96 |
| 6 | Base rate showing as RON 0.00 on success page (API returns accommodationTotal, not baseRate) | Medium | FIXED | 146de5e |
| 7 | "000" appearing on success page between Cleaning fee and Total (React rendering `0` from short-circuit) | Medium | FIXED | 88621a1 |

---

## Testing Session Log

### Session 1: 2026-02-02
- Tested: Full booking flow (Test 1)
- Found 7 issues, all fixed and deployed
- Deployments: Multiple rollouts to fix issues
- Final successful booking: Apr 2-5, 2026 (3 nights, RON 2,887.39)
- Success page now displays correctly with theming and proper pricing breakdown

---

## Next Steps After Testing

1. [ ] Fix any issues found
2. [ ] Set up production email provider (Resend)
3. [ ] Configure real domain
4. [ ] Set up iCal sync
5. [ ] Final production deployment
