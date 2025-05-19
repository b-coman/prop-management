#!/bin/bash

echo "=== Fixing Ingress Settings ==="
echo

# Update ingress to allow all traffic
echo "Updating ingress settings to allow all traffic..."
gcloud run services update prop-management \
  --region=europe-west4 \
  --project=rentalspot-fzwom \
  --ingress=all \
  --allow-unauthenticated

echo
echo "Testing after ingress update..."
sleep 5  # Give it a moment to propagate

URL=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(status.url)")
echo "Testing URL: $URL"
curl -s -o /dev/null -w "Response code: %{http_code}\n" "$URL"