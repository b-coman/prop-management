#!/bin/bash

echo "=== Debugging Secret Manager Issues ==="
echo

# List all secrets and check if service account can access them
echo "Checking secret access permissions..."
SERVICE_ACCOUNT="firebase-app-hosting-compute@rentalspot-fzwom.iam.gserviceaccount.com"

# Check if secrets exist and are accessible
SECRETS=("FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH" "FIREBASE_SERVICE_ACCOUNT")

for SECRET in "${SECRETS[@]}"; do
  echo "Checking $SECRET..."
  
  # Check if secret exists
  if gcloud secrets describe $SECRET --project=rentalspot-fzwom &>/dev/null; then
    echo "✓ Secret exists"
    
    # Check permissions
    if gcloud secrets get-iam-policy $SECRET --project=rentalspot-fzwom | grep -q $SERVICE_ACCOUNT; then
      echo "✓ Service account has permissions"
    else
      echo "✗ Service account lacks permissions"
    fi
    
    # Try to access the secret value as the service account would
    echo "  Latest version: $(gcloud secrets versions list $SECRET --project=rentalspot-fzwom --format='value(name)' --limit=1)"
  else
    echo "✗ Secret does not exist"
  fi
  echo
done

# Check the actual Cloud Run logs for errors
echo "Fetching recent Cloud Run logs..."
gcloud run services logs prop-management --region=europe-west4 --project=rentalspot-fzwom --limit=50 | grep -i "firebase\|secret\|permission\|forbidden"