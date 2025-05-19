#!/bin/bash

# Safety version - shows what would be deleted first

# List all revisions for the prop-management service
echo "Current revisions status:"
gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="table(name,spec.containerConcurrency,status.conditions[0].status,spec.template.metadata.annotations.run.googleapis.com/client-version,metadata.creationTimestamp.date('%Y-%m-%d %H:%M'))"

# Get the currently serving revision (with 100% traffic)
CURRENT_REVISION=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(spec.traffic[0].revisionName)" 2>/dev/null || echo "none")
echo -e "\n🟢 Currently serving revision: $CURRENT_REVISION"

# Get all revisions
ALL_REVISIONS=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)")

echo -e "\n📋 Revisions that would be deleted:"
for revision in $ALL_REVISIONS; do
  if [ "$revision" != "$CURRENT_REVISION" ]; then
    echo "  ❌ $revision"
  else
    echo "  ✅ $revision (keeping - currently serving)"
  fi
done

echo -e "\n⚠️  WARNING: This will permanently delete all non-serving revisions!"
read -p "Do you want to proceed with deletion? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
  echo -e "\nDeleting old revisions..."
  for revision in $ALL_REVISIONS; do
    if [ "$revision" != "$CURRENT_REVISION" ]; then
      echo "Deleting revision: $revision"
      gcloud run revisions delete $revision --region=europe-west4 --project=rentalspot-fzwom --quiet
    fi
  done
  
  echo -e "\n✅ Done! Remaining revisions:"
  gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom
else
  echo "\n❌ Deletion cancelled"
fi