#!/bin/bash

# Debug calendar format by checking what's actually stored
echo "Debugging calendar format..."

# Get a sample calendar document
curl -s -X POST https://prop-management-po7frlmwzq-ez.a.run.app/api/debug-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "prahova-mountain-chalet",
    "checkIn": "2025-05-01",
    "checkOut": "2025-05-05",
    "guests": 2
  }' | jq '.priceCalendars[0].data'