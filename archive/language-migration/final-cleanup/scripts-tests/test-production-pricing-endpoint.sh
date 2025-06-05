#!/bin/bash

# Test script for the check-pricing API endpoint
# This script sends requests with different guest counts to test pricing behavior

BASE_URL="https://prop-management-po7frlmwzq-ez.a.run.app"
# BASE_URL="http://localhost:3000"  # Uncomment for local testing

PROPERTY_ID="prahova-mountain-chalet"
CHECK_IN="2025-05-27"
CHECK_OUT="2025-05-31"

echo "===== Testing pricing API with different guest counts ====="
echo "Property: $PROPERTY_ID"
echo "Date Range: $CHECK_IN to $CHECK_OUT"
echo ""

# Function to test with a specific guest count
test_with_guest_count() {
  local guests=$1
  echo "Testing with $guests guests..."
  
  local response=$(curl -s -X POST "$BASE_URL/api/check-pricing" \
    -H "Content-Type: application/json" \
    -d "{\"propertyId\": \"$PROPERTY_ID\", \"checkIn\": \"$CHECK_IN\", \"checkOut\": \"$CHECK_OUT\", \"guests\": $guests}")
  
  # Extract pricing info
  local subtotal=$(echo $response | grep -o '"subtotal":[0-9]*' | cut -d':' -f2)
  local total=$(echo $response | grep -o '"totalPrice":[0-9]*' | cut -d':' -f2)
  
  echo "Response: $response" | head -c 200
  echo "..."
  echo "Subtotal: $subtotal"
  echo "Total: $total"
  echo ""
}

# Debug mode - check the actual calendar structure
debug_calendar_structure() {
  local month="${CHECK_IN:0:7}" # Extract YYYY-MM from check-in date
  echo "Debugging price calendar structure for $month..."
  
  local response=$(curl -s -X POST "$BASE_URL/api/debug-pricing" \
    -H "Content-Type: application/json" \
    -d "{\"propertyId\": \"$PROPERTY_ID\", \"checkIn\": \"$CHECK_IN\", \"checkOut\": \"$CHECK_OUT\", \"guests\": 2}")
  
  echo "$response" > pricing-debug-output.json
  echo "Debug output saved to pricing-debug-output.json"
  
  # Extract and display structure info
  echo "Calendar structure check:"
  if grep -q "days" pricing-debug-output.json; then
    echo "✓ Calendar uses 'days' structure"
  else
    echo "✗ Calendar does NOT use 'days' structure"
  fi
  
  if grep -q "prices" pricing-debug-output.json; then
    echo "✓ Calendar uses 'prices' structure"
  else
    echo "✗ Calendar does NOT use 'prices' structure"
  fi
  
  echo ""
}

# Run debug first
debug_calendar_structure

# Test with different guest counts
test_with_guest_count 2
test_with_guest_count 3
test_with_guest_count 4
test_with_guest_count 5
test_with_guest_count 6

echo "===== Testing completed ====="