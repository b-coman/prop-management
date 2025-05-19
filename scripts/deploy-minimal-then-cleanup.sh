#!/bin/bash

echo "This script will:"
echo "1. Deploy a minimal working revision"
echo "2. Wait for it to receive traffic"
echo "3. Delete all old revisions"
echo ""
echo "Press Enter to continue..."
read

# Deploy from your test branch that we know works
echo "Deploying from test-firebase-env branch..."
firebase apphosting:publish test-firebase-env

echo ""
echo "Waiting for deployment to complete..."
echo "Once the deployment succeeds, we'll clean up old revisions."
echo ""
echo "After deployment completes, press Enter to continue with cleanup..."
read

# Get all revisions except the newest one
echo "Getting current revisions..."
NEWEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

echo "Newest revision: $NEWEST_REVISION"
echo ""
echo "Deleting old revisions..."

for revision in $ALL_REVISIONS; do
  if [ "$revision" != "$NEWEST_REVISION" ]; then
    echo "Deleting revision: $revision"
    gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
  else
    echo "Keeping newest revision: $revision"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo "You now have a clean deployment with only the latest working revision."