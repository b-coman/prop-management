#!/bin/bash

# Test pricing debug API
BASE_URL="${1:-https://prop-management-po7frlmwzq-ez.a.run.app}"

echo "Testing Pricing Debug API at: $BASE_URL"
echo "=================================="

# Test 1: June 2025 for Prahova Mountain Chalet
echo -e "\nTest 1: June 2025 - Prahova Mountain Chalet"
curl -s -X POST "$BASE_URL/api/debug-pricing" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prahova-mountain-chalet",
    "checkIn": "2025-06-01",
    "checkOut": "2025-06-05",
    "guests": 2
  }' | jq . || echo "Error in request"

# Test 2: Current month
CURRENT_MONTH=$(date +%Y-%m-01)
NEXT_WEEK=$(date -v+7d +%Y-%m-%d)

echo -e "\n\nTest 2: Current Month - Prahova Mountain Chalet"
echo "Dates: $CURRENT_MONTH to $NEXT_WEEK"
curl -s -X POST "$BASE_URL/api/debug-pricing" \
  -H "Content-Type: application/json" \
  -d "{
    \"propertyId\": \"prahova-mountain-chalet\",
    \"checkIn\": \"$CURRENT_MONTH\",
    \"checkOut\": \"$NEXT_WEEK\",
    \"guests\": 2
  }" | jq . || echo "Error in request"

# Test 3: Check for Coltei Apartment
echo -e "\n\nTest 3: July 2025 - Coltei Apartment Bucharest"
curl -s -X POST "$BASE_URL/api/debug-pricing" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "coltei-apartment-bucharest",
    "checkIn": "2025-07-15",
    "checkOut": "2025-07-20",
    "guests": 4
  }' | jq . || echo "Error in request"

echo -e "\n\nDebug tests complete!"