#!/bin/bash

# Check what calendars exist in production
echo "Checking calendars in production..."
echo "=================================="

# Check calendar format for prahova mountain chalet
echo -e "\nChecking calendars for prahova-mountain-chalet:"
for month in 01 02 03 04 05 06 07 08 09 10 11 12; do
  for year in 2024 2025; do
    # Try both formats
    echo -n "  ${year}-${month}: "
    curl -s -X POST "https://prop-management-po7frlmwzq-ez.a.run.app/api/debug-pricing" \
      -H "Content-Type: application/json" \
      -d "{
        \"propertyId\": \"prahova-mountain-chalet\",
        \"checkIn\": \"${year}-${month}-01\",
        \"checkOut\": \"${year}-${month}-05\",
        \"guests\": 2
      }" | jq -r '.priceCalendars[0].exists' || echo "error"
  done
done

echo -e "\n\nChecking calendars for coltei-apartment-bucharest:"
for month in 01 02 03 04 05 06 07 08 09 10 11 12; do
  for year in 2024 2025; do
    # Try both formats
    echo -n "  ${year}-${month}: "
    curl -s -X POST "https://prop-management-po7frlmwzq-ez.a.run.app/api/debug-pricing" \
      -H "Content-Type: application/json" \
      -d "{
        \"propertyId\": \"coltei-apartment-bucharest\",
        \"checkIn\": \"${year}-${month}-01\",
        \"checkOut\": \"${year}-${month}-05\",
        \"guests\": 2
      }" | jq -r '.priceCalendars[0].exists' || echo "error"
  done
done