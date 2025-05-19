#!/bin/bash

echo "⚠️  WARNING: This will DELETE the entire Cloud Run service 'prop-management'"
echo "This includes:"
echo "- All revisions"
echo "- The service itself"
echo "- All traffic mappings"
echo ""
echo "You will need to redeploy from Firebase to recreate everything."
echo ""
echo "Are you SURE you want to do this? Type 'DELETE' to confirm:"
read confirmation

if [ "$confirmation" = "DELETE" ]; then
  echo "Deleting the entire service..."
  gcloud run services delete prop-management --region=europe-west4 --project=rentalspot-fzwom --quiet
  echo "✅ Service deleted. You now have a completely clean slate."
else
  echo "❌ Deletion cancelled"
fi