#!/bin/bash

echo "=== Checking Server Component Error ==="
echo

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Checking logs for revision: $LATEST_REVISION"
echo

# Check recent logs for errors
echo "Recent error logs:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND (severity=ERROR OR textPayload=~\"error\" OR textPayload=~\"Error\" OR jsonPayload.error OR jsonPayload.message=~\"error\")" --project=rentalspot-fzwom --limit=30 --format=json | jq -r '.[] | select(.textPayload or .jsonPayload) | .textPayload // (.jsonPayload | tostring)' | grep -v "favicon.ico" | head -20

echo
echo "Checking for Firebase Admin initialization errors:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND (textPayload=~\"FIREBASE\" OR textPayload=~\"Firebase\" OR textPayload=~\"firestore\")" --project=rentalspot-fzwom --limit=20 --format=json | jq -r '.[] | select(.textPayload) | .textPayload'