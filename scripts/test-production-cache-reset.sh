#!/bin/bash

# Test the cache reset API in production
API_URL="https://prop-management-po7frlmwzq-ez.a.run.app/api/reset-price-cache"
PROPERTY_ID="prahova-mountain-chalet"

echo "Testing pricing cache reset API in production..."
echo "URL: $API_URL"
echo "Property: $PROPERTY_ID"
echo "---"

# Make the API request
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"propertySlug\":\"$PROPERTY_ID\"}" \
  "$API_URL")

# Pretty print the response
echo "API Response:"
echo "$response" | python -m json.tool

# Check if the response indicates success
if [[ "$response" == *"\"success\":true"* ]]; then
  echo "---"
  echo "✅ Success! The cache reset request was processed."
else
  echo "---"
  echo "❌ Error! The cache reset request failed."
fi