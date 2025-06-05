#!/bin/bash

echo "=== Debugging Page Render Issues ==="
echo

# Test the actual page with curl
echo "Testing home page response:"
curl -s -o /dev/null -w "%{http_code}\n" https://prop-management-po7frlmwzq-ez.a.run.app/

echo
echo "Testing property page response:"
curl -s -o /dev/null -w "%{http_code}\n" https://prop-management-po7frlmwzq-ez.a.run.app/properties/prahova-mountain-chalet

echo
echo "Fetching home page content:"
curl -s https://prop-management-po7frlmwzq-ez.a.run.app/ | grep -E "(Something went wrong|Error|error)" | head -3

echo
echo "Checking recent logs for render errors:"
LATEST_REVISION=$(gcloud run revisions list --service=prop-management --region=europe-west4 --project=rentalspot-fzwom --format="value(name)" --limit=1 --sort-by="~creationTimestamp")

gcloud logging read "resource.type=cloud_run_revision AND resource.labels.revision_name=\"$LATEST_REVISION\" AND (textPayload=~\"getPropertyBySlug\" OR textPayload=~\"getWebsiteTemplate\" OR textPayload=~\"Firebase\" OR textPayload=~\"Firestore\")" --project=rentalspot-fzwom --limit=20 --format=json | jq -r '.[] | select(.textPayload) | .textPayload'