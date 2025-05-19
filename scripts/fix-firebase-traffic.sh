#!/bin/bash

echo "=== Fixing Firebase App Hosting Traffic Configuration ==="
echo

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Latest revision: $LATEST_REVISION"
echo

# Force update traffic to only the latest revision
echo "Updating traffic configuration..."
gcloud run services update-traffic prop-management \
  --region=europe-west4 \
  --project=rentalspot-fzwom \
  --to-latest=100 \
  --clear-tags

echo
echo "Traffic configuration fixed!"
echo

# Show current traffic
echo "Current traffic allocation:"
gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="get(spec.traffic)"