#!/bin/bash

# Test script for manual verification of booking page flash fix

echo "🧪 Manual Booking Page Flash Fix Test"
echo "===================================="
echo ""
echo "This script will guide you through testing the booking page fix."
echo "Please open your browser and follow these steps:"
echo ""
echo "1. Navigate to: http://localhost:9002/booking/check/prahova-mountain-chalet"
echo ""
echo "2. Test Available Dates:"
echo "   - Click on the date picker to open the calendar"
echo "   - Select a check-in date (30+ days in the future)"
echo "   - Select a check-out date (3-5 nights later)"
echo "   - OBSERVE: Does a booking summary appear immediately?"
echo "   - EXPECTED: Summary should only appear AFTER availability is confirmed"
echo ""
echo "3. Test Unavailable Dates:"
echo "   - Refresh the page"
echo "   - Click on the date picker again"
echo "   - Look for dates with strikethrough (unavailable)"
echo "   - Try to select unavailable dates"
echo "   - OBSERVE: Does an error message appear?"
echo "   - EXPECTED: Error should mention 'strikethrough' or 'unavailable' dates"
echo ""
echo "4. Test Loading States:"
echo "   - Select new dates to trigger availability check"
echo "   - OBSERVE: Is there a loading indicator?"
echo "   - EXPECTED: 'Checking availability...' or skeleton loader should appear"
echo ""

# Test the API endpoints
echo "Testing API endpoints..."
echo ""

# Test 1: Check availability endpoint
echo "Testing availability check API..."
FUTURE_DATE=$(date -v+30d +%Y-%m-%d)
CHECKOUT_DATE=$(date -v+33d +%Y-%m-%d)

RESPONSE=$(curl -s -X POST http://localhost:9002/api/check-availability \
  -H "Content-Type: application/json" \
  -d "{\"propertySlug\":\"prahova-mountain-chalet\",\"checkIn\":\"$FUTURE_DATE\",\"checkOut\":\"$CHECKOUT_DATE\",\"guests\":2}")

echo "API Response: $RESPONSE"
echo ""

# Open browser
echo "Opening browser to test page..."
case "$OSTYPE" in
  darwin*)  open "http://localhost:9002/booking/check/prahova-mountain-chalet" ;;
  linux*)   xdg-open "http://localhost:9002/booking/check/prahova-mountain-chalet" ;;
  *)        echo "Please manually open: http://localhost:9002/booking/check/prahova-mountain-chalet" ;;
esac

echo ""
echo "Please perform the manual tests described above and observe the results."
echo ""
echo "Key things to verify:"
echo "✓ No flash of stale booking summary before pricing loads"
echo "✓ Loading states appear during availability checks"
echo "✓ Unavailable dates are properly marked with strikethrough"
echo "✓ Error messages include helpful text about strikethrough dates"
echo ""