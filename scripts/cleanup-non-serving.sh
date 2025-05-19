#!/bin/bash

echo "This script will delete all non-serving revisions."
echo "The currently serving revision will be kept."
echo ""

# Get the currently serving revision (with 100% traffic)
echo "Finding currently serving revision..."
SERVING_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="json" | jq -r '.status.traffic[] | select(.percent==100) | .revisionName')

if [ -z "$SERVING_REVISION" ]; then
  # Try alternative format
  SERVING_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(status.traffic[0].revisionName)")
fi

echo "Currently serving revision: $SERVING_REVISION"
echo ""

# Get all revisions
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

echo "All revisions:"
echo "$ALL_REVISIONS"
echo ""

echo "Will delete all revisions EXCEPT: $SERVING_REVISION"
echo "Press Enter to continue..."
read

# Delete non-serving revisions
for revision in $ALL_REVISIONS; do
  if [ "$revision" != "$SERVING_REVISION" ]; then
    echo "Deleting revision: $revision"
    gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
  else
    echo "Keeping serving revision: $revision"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo "Only the currently serving revision remains."
echo ""
echo "Next steps:"
echo "1. Deploy your fixed code from main branch"
echo "2. The new deployment should succeed without 'Resource readiness deadline exceeded' error"