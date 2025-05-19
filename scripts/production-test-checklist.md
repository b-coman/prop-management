# Production Testing Checklist

## 1. Basic Page Loading
- [ ] Home page: https://prop-management-1061532538391.europe-west4.run.app/
- [ ] Property page: https://prop-management-1061532538391.europe-west4.run.app/properties/prahova-mountain-chalet
- [ ] Test 404 page: https://prop-management-1061532538391.europe-west4.run.app/nonexistent

## 2. Booking Flow
- [ ] Calendar display with unavailable dates
- [ ] Date selection
- [ ] Price calculation
- [ ] Guest count selection
- [ ] Contact host form
- [ ] Hold booking functionality
- [ ] Checkout process (test mode)

## 3. Multilingual Features
- [ ] Language switcher functionality
- [ ] Romanian translations
- [ ] English translations
- [ ] Persistent language selection

## 4. Currency Features
- [ ] Currency switcher
- [ ] EUR/USD/GBP/RON conversions
- [ ] Price display in selected currency

## 5. Theme System
- [ ] Theme switcher if enabled
- [ ] Theme persistence
- [ ] Visual consistency

## 6. API Endpoints
- [ ] Pricing API: /api/check-pricing
- [ ] Availability API: /api/check-availability
- [ ] Health check: /api/health
- [ ] Readiness check: /api/readiness

## 7. Admin Panel
- [ ] Login functionality: /login
- [ ] Admin dashboard: /admin
- [ ] Pricing management: /admin/pricing
- [ ] Property management: /admin/properties
- [ ] Booking management: /admin/bookings
- [ ] Inquiries: /admin/inquiries

## 8. Mobile Responsiveness
- [ ] Test on mobile viewport
- [ ] Navigation menu
- [ ] Booking forms
- [ ] Gallery views

## 9. Performance & Error Handling
- [ ] Page load times
- [ ] No console errors
- [ ] Error boundaries working
- [ ] 404 pages rendering correctly

## 10. Firebase Integration
- [ ] Firestore data loading
- [ ] Authentication (admin)
- [ ] Storage (images)
- [ ] No permission errors