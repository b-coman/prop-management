#!/bin/bash

echo "This script will fix the traffic configuration by removing references to deleted revisions."
echo ""

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Latest revision: $LATEST_REVISION"
echo ""
echo "Updating traffic to point 100% to the latest revision..."

# Update the service to route 100% traffic to the latest revision only
gcloud run services update-traffic prop-management \
  --region=europe-west4 \
  --project=rentalspot-fzwom \
  --to-revisions=$LATEST_REVISION=100 \
  --clear-tags

echo ""
echo "Traffic configuration updated!"
echo ""
echo "Current traffic configuration:"
gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format=json | jq '.spec.traffic'