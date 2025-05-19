#!/bin/bash
# Fix Cloud Run traffic to route only to latest revision

SERVICE="prop-management"
REGION="europe-west4"
PROJECT="rentalspot-fzwom"

echo "Getting latest revision..."
LATEST_REVISION=$(gcloud run revisions list --service $SERVICE --region $REGION --project $PROJECT --format="value(name)" --limit=1)

if [ -z "$LATEST_REVISION" ]; then
    echo "Error: Could not find latest revision"
    exit 1
fi

echo "Latest revision: $LATEST_REVISION"

# Export current configuration
echo "Exporting current configuration..."
gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format="export" > /tmp/service.yaml

# Fix the traffic section to route only to latest
echo "Updating traffic configuration..."
cat > /tmp/update-traffic.py << 'EOF'
import yaml
import sys

with open('/tmp/service.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Update traffic to only route to the latest revision
config['spec']['traffic'] = [{
    'revisionName': sys.argv[1],
    'percent': 100
}]

# Remove any latestRevision references
if 'latestRevision' in config['spec']:
    del config['spec']['latestRevision']

with open('/tmp/service-updated.yaml', 'w') as f:
    yaml.dump(config, f, default_flow_style=False)
EOF

python3 /tmp/update-traffic.py "$LATEST_REVISION"

# Apply the updated configuration
echo "Applying new configuration..."
gcloud run services replace /tmp/service-updated.yaml --region $REGION --project $PROJECT

echo "Traffic routing fixed! All traffic now routes to: $LATEST_REVISION"