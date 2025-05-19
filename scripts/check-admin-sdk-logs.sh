#!/bin/bash

echo "=== Checking Firebase Admin SDK Logs ==="
echo

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Checking logs for revision: $LATEST_REVISION"
echo

# Check for Firebase Admin initialization logs
echo "Firebase Admin initialization logs:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND (textPayload=~\"FIREBASE ADMIN\" OR textPayload=~\"Cannot find module\" OR textPayload=~\"getDbAdmin\" OR textPayload=~\"firestore\")" --project=rentalspot-fzwom --limit=20 --format=json | jq -r '.[] | select(.textPayload) | .textPayload'

echo
echo "Checking for error logs:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND severity=ERROR" --project=rentalspot-fzwom --limit=10 --format=json | jq -r '.[] | select(.textPayload or .jsonPayload) | .textPayload // (.jsonPayload | tostring)' | grep -v favicon