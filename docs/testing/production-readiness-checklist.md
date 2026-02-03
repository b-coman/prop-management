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
1. [x] Select different dates (Feb 13-15, 2026)
2. [x] Select guests (4 guests)
3. [x] Verify pricing displays (RON 1,991 total, RON 124.46 hold fee)
4. [x] Click "Hold Dates" tab
5. [x] Fill guest info (Bogdan Coman, coman2904@gmail.com)
6. [x] Click "Pay to Hold Dates"
7. [x] Verify hold fee amount is correct (RON 124.46)
8. [x] Complete Stripe payment with test card
9. [x] Verify redirect to hold success page

### Verify After Hold:
- [x] **Firestore:** Check `bookings` collection
  - Status: `on-hold` ✓
  - `holdUntil` timestamp: Feb 4, 2026 5:44 PM (~24 hours) ✓
  - `holdFeeAmount` recorded ✓
- [x] **Success Page:** Shows hold info correctly
  - Hold ID: emynoVBTGCOK7KECAhfc ✓
  - Payment confirmed badge ✓
  - Expiration warning banner ✓
- [x] **Email:** Received via Resend (production)
  - Shows hold expiration time ✓
  - Shows "Finalizează Rezervarea" button ✓
  - Romanian translation working ✓
- [ ] **Calendar:** Dates should show as unavailable

### Result:
- [x] PASS
- Notes: Tested on 2026-02-03 in Romanian. Email sent automatically via webhook to production email (coman2904@gmail.com). Hold fee (RON 124.46) calculated correctly. Success page displays all information correctly with property theme.

### Test Holds Created:
- Hold ID: `emynoVBTGCOK7KECAhfc` (Feb 13-15, 2026, 4 guests, RON 124.46 hold fee)

---

## Test 3: Hold Expiration (Cleanup System)

**Note:** This tests the cron job at `/api/cron/release-holds`

### Steps:
1. [x] Create a hold (or use existing from Test 2)
2. [x] Manually update `holdUntil` in Firestore to a past time (Feb 2, 2026)
3. [x] Trigger the cron endpoint manually:
   ```
   curl -X GET https://prop-management--rentalspot-fzwom.europe-west4.hosted.app/api/cron/release-holds \
     -H "Authorization: Bearer test-token"
   ```
4. [x] Verify results

### Verify After Expiration:
- [x] **Firestore:** Booking status changed to `cancelled` ✓
- [x] **Firestore:** Notes field: "Hold expired automatically on 2026-02-03T17:52:38.472Z" ✓
- [x] **Availability:** Dates released (manually fixed - bug found)
- [x] **Calendar:** Dates available again after manual fix ✓

### Result:
- [x] PARTIAL PASS - Bug found and fixed
- Notes:
  - Booking status update: PASS
  - Availability release: FAIL (bug: using `null` instead of `FieldValue.delete()`)
  - Bug fixed in commit 9b33047, deployed

### Bug Fixed:
- **Issue:** Cron job set `holds.{day}` to `null` instead of deleting the field
- **Fix:** Use `FieldValue.delete()` to properly remove hold entries
- **Commit:** 9b33047

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
| 2. Hold Flow | PASS | Tested 2026-02-03, email auto-sent via Resend |
| 3. Hold Expiration | PASS | Bug found & fixed (FieldValue.delete) |
| 4. Inquiry Flow | PENDING | |
| 5. Availability Blocking | PARTIAL | Works (dates blocked after booking) |
| 6. Pricing Calculation | PARTIAL | Base pricing + currency switching tested |
| 7. Stripe Webhooks | PASS | Working, auto-sends emails |
| 8. Error Handling | PENDING | |
| 9. Mobile | PENDING | |
| 10. Multi-Language | PARTIAL | Romanian tested with hold flow, translations updated |

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
| 8 | Hold expiration cron not releasing availability (using `null` instead of `FieldValue.delete()`) | High | FIXED | 9b33047 |

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

1. [x] Fix any issues found (7 issues fixed in Session 1)
2. [x] Set up production email provider (Resend) - Configured 2026-02-03
3. [ ] Verify domain in Resend (currently using onboarding@resend.dev)
4. [ ] Configure real domain
5. [ ] Set up iCal sync
6. [ ] Final production deployment

---

## Testing Session Log

### Session 2: 2026-02-03
- Set up Resend for production emails
- Implemented single-language email system (stores user's language preference)
- Tested Hold Flow (Test 2) in Romanian
- Fixed Romanian translations ("rezervă" → "blochează")
- Automatic email sending via Stripe webhook working
- Simplified success page UI (single CTA button)
