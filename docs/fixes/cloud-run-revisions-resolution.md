# Cloud Run Revisions and Traffic Routing

## Problem

After successfully deploying to Cloud Run, the service was still returning errors because traffic was not being properly routed to the latest revision. This resulted in users hitting older, non-functional revisions, even though the newest revision was working correctly.

## Symptoms

1. Deployment shows successful in Firebase Console
2. Cloud Run revisions list shows the new revision as "Ready"
3. Traffic percentage in Cloud Run UI is stuck on older revisions
4. Users receive errors like "Price information not available" when using the service
5. Logs show traffic hitting old revisions, not the newest one

## Root Causes

1. **Traffic Routing Configuration**: Cloud Run doesn't automatically route 100% of traffic to new revisions unless explicitly configured
2. **Sticky Revisions**: Once traffic is assigned to a specific revision, it stays routed to that revision even when new deployments occur
3. **Inactive Routing**: Firebase App Hosting sometimes fails to update the routing configuration in Cloud Run when a new deployment completes

## Solution Implemented

We created a script to explicitly update traffic routing to the latest revision:

```bash
#!/bin/bash
SERVICE="rentalspot-builder"
REGION="us-central1"
PROJECT="rental-spot-builder"

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list --service $SERVICE --region $REGION --project $PROJECT --format="value(name)" --limit=1)
echo "Latest revision: $LATEST_REVISION"

# Export the current service configuration
gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format=yaml > /tmp/service.yaml

# Update traffic configuration to point 100% to the latest revision
sed "s/traffic:.*/traffic:\\n- revisionName: $LATEST_REVISION\\n  percent: 100/" /tmp/service.yaml > /tmp/service-updated.yaml

# Apply the updated configuration
gcloud run services replace /tmp/service-updated.yaml --region $REGION --project $PROJECT
```

This script:
1. Finds the most recent revision
2. Exports the current service configuration
3. Updates the traffic routing to point 100% to the latest revision
4. Applies the modified configuration back to Cloud Run

## Verification

After running the script:
1. The Cloud Run UI shows 100% traffic routing to the latest revision
2. Users are able to access the service without errors
3. Logs confirm traffic is hitting the newest revision
4. The "Price information not available" errors are resolved

## Prevention Measures

To prevent traffic routing issues in the future:

1. **Deployment Automation**: Add the traffic routing fix to post-deployment scripts
2. **Manual Verification**: After deployment, verify traffic routing in Cloud Run UI
3. **Monitoring**: Set up alerts for traffic hitting outdated revisions
4. **Deployment Process**: Update Firebase Hosting configuration to explicitly manage traffic routing

## Alternative Approaches

1. **Blue-Green Deployments**: Configure explicit blue-green deployment pattern in Cloud Run
2. **Gradual Migration**: Use traffic splitting to gradually migrate users to new revisions
3. **Firebase CLI**: Use `firebase deploy --only hosting` with traffic migration flags

## Lessons Learned

1. Cloud Run traffic routing is separate from deployment success
2. Always verify traffic allocation after deployment completes
3. Manual traffic management may be necessary after automated deployments
4. Keep a traffic routing fix script readily available for emergencies
5. Logs should be checked at the revision level to ensure correct routing