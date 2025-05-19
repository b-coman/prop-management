#!/bin/bash

# Test the production pricing API
API_URL="https://prop-management-po7frlmwzq-ez.a.run.app/api/check-pricing"
PROPERTY_ID="prahova-mountain-chalet"
CHECK_IN="2025-06-15"
CHECK_OUT="2025-06-18"
GUESTS=5

echo "Testing pricing API in production..."
echo "URL: $API_URL"
echo "Property: $PROPERTY_ID"
echo "Dates: $CHECK_IN to $CHECK_OUT"
echo "Guests: $GUESTS"
echo "---"

# Make the API request
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"propertyId\":\"$PROPERTY_ID\",\"checkIn\":\"$CHECK_IN\",\"checkOut\":\"$CHECK_OUT\",\"guests\":$GUESTS}" \
  "$API_URL")

# Pretty print the response
echo "API Response:"
echo "$response" | python -m json.tool

# Check if the response indicates availability
if [[ "$response" == *"\"available\":true"* ]]; then
  echo "---"
  echo "✅ Success! The pricing API returned availability data."
else
  echo "---"
  echo "❌ Error! The pricing API did not return availability data."
fi