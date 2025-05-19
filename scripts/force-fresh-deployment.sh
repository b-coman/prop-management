#!/bin/bash

echo "=== Forcing Fresh Deployment ==="
echo

# Option 1: Deploy with a different service name temporarily
echo "Creating a fresh deployment..."

# Deploy directly using gcloud (bypassing Firebase)
gcloud run deploy prop-management-fresh \
  --source . \
  --region europe-west4 \
  --project rentalspot-fzwom \
  --allow-unauthenticated \
  --port 8080

echo
echo "Fresh deployment created. You can:"
echo "1. Use the new URL directly"
echo "2. Update Firebase to point to the new service"
echo "3. Delete the old service and rename the new one"