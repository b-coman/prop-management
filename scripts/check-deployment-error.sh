#!/bin/bash

echo "=== Checking Deployment Error ==="
echo

# Get the latest revision details
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Latest revision: $LATEST_REVISION"
echo

# Check the revision status
echo "Revision status:"
gcloud run revisions describe $LATEST_REVISION --region=europe-west4 --project=rentalspot-fzwom --format=json | jq '.status.conditions'

echo
echo "Checking logs for errors..."
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=prop-management AND resource.labels.revision_name=$LATEST_REVISION AND (jsonPayload.message=~\"forbidden\" OR jsonPayload.message=~\"Forbidden\" OR jsonPayload.message=~\"permission\" OR jsonPayload.message=~\"secret\" OR textPayload=~\"forbidden\" OR textPayload=~\"Forbidden\")" --project=rentalspot-fzwom --limit=50 --format=json | jq -r '.[] | select(.textPayload or .jsonPayload.message) | .textPayload // .jsonPayload.message'