#!/bin/bash

# First check if we're authenticated
echo "Checking gcloud authentication..."
gcloud auth list

# Simple version with basic formatting
echo -e "\nListing all Cloud Run revisions..."
gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="table(name,status.conditions[0].status)"

# Get the currently serving revision
echo -e "\nGetting currently serving revision..."
CURRENT_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(status.traffic[0].revisionName)" 2>/dev/null || echo "")

if [ -z "$CURRENT_REVISION" ]; then
  # Try alternative method
  CURRENT_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="get(status.traffic[0].revisionName)" 2>/dev/null || echo "")
fi

if [ -z "$CURRENT_REVISION" ]; then
  echo "Warning: Could not determine currently serving revision. Looking for revision with 100% traffic..."
  CURRENT_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="json" | jq -r '.status.traffic[] | select(.percent==100) | .revisionName' 2>/dev/null || echo "")
fi

echo "Currently serving revision: $CURRENT_REVISION"

# Get all revisions
echo -e "\nGetting all revisions..."
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

echo -e "\nRevisions found:"
echo "$ALL_REVISIONS"

echo -e "\n⚠️  This script will delete all revisions except: $CURRENT_REVISION"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Delete old revisions
for revision in $ALL_REVISIONS; do
  if [ "$revision" != "$CURRENT_REVISION" ] && [ ! -z "$revision" ]; then
    echo "Deleting revision: $revision"
    gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
  else
    echo "Keeping revision: $revision"
  fi
done

echo -e "\nDone! Remaining revisions:"
gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom