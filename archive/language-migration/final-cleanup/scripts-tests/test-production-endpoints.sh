#!/bin/bash

# Production endpoint testing script
BASE_URL="https://prop-management-1061532538391.europe-west4.run.app"

echo "Testing Production Endpoints..."
echo "==============================="

# Test basic pages
echo -e "\n1. Testing Page Loads:"
echo "   Home page:"
curl -s -o /dev/null -w "   Status: %{http_code}, Time: %{time_total}s\n" "$BASE_URL/"

echo "   Property page:"
curl -s -o /dev/null -w "   Status: %{http_code}, Time: %{time_total}s\n" "$BASE_URL/properties/prahova-mountain-chalet"

echo "   Test page:"
curl -s -o /dev/null -w "   Status: %{http_code}, Time: %{time_total}s\n" "$BASE_URL/test-page"

echo "   Admin page:"
curl -s -o /dev/null -w "   Status: %{http_code}, Time: %{time_total}s\n" "$BASE_URL/admin"

echo "   404 test:"
curl -s -o /dev/null -w "   Status: %{http_code}, Time: %{time_total}s\n" "$BASE_URL/nonexistent"

# Test API endpoints
echo -e "\n2. Testing API Endpoints:"
echo "   Health check:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "$BASE_URL/api/health"
curl -s "$BASE_URL/api/health" | jq . || echo "   (no JSON response)"

echo -e "\n   Readiness check:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "$BASE_URL/api/readiness"
curl -s "$BASE_URL/api/readiness" | jq . || echo "   (no JSON response)"

echo -e "\n   Availability check:"
curl -s -X POST "$BASE_URL/api/check-availability" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prahova-mountain-chalet",
    "startDate": "2025-06-01",
    "endDate": "2025-06-05"
  }' \
  -w "\n   Status: %{http_code}\n" | jq . || echo "   (error)"

echo -e "\n   Pricing check:"
curl -s -X POST "$BASE_URL/api/check-pricing" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prahova-mountain-chalet",
    "startDate": "2025-06-01",
    "endDate": "2025-06-05",
    "guestCount": 2
  }' \
  -w "\n   Status: %{http_code}\n" | jq . || echo "   (error)"

# Test static assets
echo -e "\n3. Testing Static Assets:"
echo "   CSS loading:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" "$BASE_URL/_next/static/css/*"

# Test multilingual
echo -e "\n4. Testing Multilingual Support:"
echo "   Romanian page:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" -H "Accept-Language: ro" "$BASE_URL/"

echo "   English page:"
curl -s -o /dev/null -w "   Status: %{http_code}\n" -H "Accept-Language: en" "$BASE_URL/"

echo -e "\nProduction tests complete!"
echo "=========================="
echo "Check the browser console for interactive tests: $BASE_URL"