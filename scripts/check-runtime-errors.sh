#!/bin/bash

echo "=== Checking Runtime Errors ==="
echo

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

echo "Latest revision: $LATEST_REVISION"
echo

# Check for all log entries including stderr
echo "Checking all recent logs:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND timestamp>=\"$(date -u -v-10M '+%Y-%m-%dT%H:%M:%S')Z\"" --project=rentalspot-fzwom --limit=50 --format=json | jq -r '.[] | select(.textPayload or .jsonPayload) | .textPayload // (.jsonPayload | tostring)' | grep -E "(error|Error|failed|Failed|cannot|Cannot)" | grep -v "favicon"