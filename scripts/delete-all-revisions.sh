#!/bin/bash

echo "⚠️  WARNING: This will delete ALL revisions for the prop-management service"
echo "The service will remain, but will have no active revisions until you deploy again."
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Get all revisions
echo "Getting all revisions..."
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

if [ -z "$ALL_REVISIONS" ]; then
  echo "No revisions found."
  exit 0
fi

echo "Found revisions:"
echo "$ALL_REVISIONS"
echo ""

# Delete ALL revisions
echo "Deleting all revisions..."
for revision in $ALL_REVISIONS; do
  echo "Deleting revision: $revision"
  gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
done

echo ""
echo "✅ All revisions deleted!"
echo ""
echo "The prop-management service now has no active revisions."
echo "Your next deployment will create a fresh revision that will automatically receive 100% traffic."