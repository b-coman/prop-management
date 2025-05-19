#!/bin/bash

# List all revisions for the prop-management service
echo "Listing all revisions..."
gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom

# Get the currently serving revision (with 100% traffic)
CURRENT_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(spec.traffic[0].revisionName)")
echo -e "\nCurrently serving revision: $CURRENT_REVISION"

# Get all revisions
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

echo -e "\nDeleting old revisions (keeping only $CURRENT_REVISION)..."
for revision in $ALL_REVISIONS; do
  if [ "$revision" != "$CURRENT_REVISION" ]; then
    echo "Deleting revision: $revision"
    gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
  else
    echo "Keeping current revision: $revision"
  fi
done

echo -e "\nDone! Remaining revisions:"
gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom