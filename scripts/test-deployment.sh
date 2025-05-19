#!/bin/bash

echo "=== Testing Deployment ==="
echo

# Get the service URL
URL=$(gcloud run services describe prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(status.url)")
echo "Service URL: $URL"
echo

# Test the service directly
echo "Testing Cloud Run URL..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
echo "Response code: $RESPONSE"
echo

# Test with verbose output
echo "Testing with verbose output..."
curl -v "$URL" 2>&1 | grep -E "< HTTP|< |Forbidden"
echo

# Check for recent errors in logs
echo "Checking recent logs..."
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=prop-management AND timestamp>=\"$(date -u -v-5M '+%Y-%m-%dT%H:%M:%S')Z\"" --project=rentalspot-fzwom --limit=20 --format=json | jq -r '.[] | select(.textPayload or .jsonPayload) | .textPayload // .jsonPayload.message' | grep -E "(Forbidden|forbidden|error|Error|fail)" || echo "No error logs found"