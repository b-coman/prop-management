#!/bin/bash

# Deploy Hold Cleanup Automation Script
# This script sets up Cloud Scheduler to automatically release expired holds

set -e

echo "🚀 Deploying Hold Cleanup Automation..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo "❌ Error: GOOGLE_CLOUD_PROJECT environment variable not set"
    echo "💡 Please run: export GOOGLE_CLOUD_PROJECT=your-project-id"
    exit 1
fi

if [ -z "$DEPLOYMENT_URL" ]; then
    echo "❌ Error: DEPLOYMENT_URL environment variable not set"
    echo "💡 Please run: export DEPLOYMENT_URL=https://your-domain.com"
    exit 1
fi

# Generate a secure token for cron authentication
CRON_SECRET_TOKEN=$(openssl rand -hex 32)
echo "🔐 Generated secure token for cron authentication"

# Set the project
echo "📋 Setting Google Cloud project: $GOOGLE_CLOUD_PROJECT"
gcloud config set project "$GOOGLE_CLOUD_PROJECT"

# Enable required APIs
echo "🔌 Enabling required Google Cloud APIs..."
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable run.googleapis.com

# Check if the scheduler job already exists
JOB_EXISTS=$(gcloud scheduler jobs list --filter="name:release-expired-holds" --format="value(name)" | wc -l)

if [ "$JOB_EXISTS" -gt 0 ]; then
    echo "⚠️  Scheduler job 'release-expired-holds' already exists"
    read -p "🤔 Do you want to update it? (y/N): " UPDATE_JOB
    
    if [[ $UPDATE_JOB =~ ^[Yy]$ ]]; then
        echo "🔄 Updating existing scheduler job..."
        gcloud scheduler jobs update http release-expired-holds \
            --schedule="0 * * * *" \
            --uri="$DEPLOYMENT_URL/api/cron/release-holds" \
            --http-method=GET \
            --update-headers="Authorization=Bearer $CRON_SECRET_TOKEN,X-Appengine-Cron=true" \
            --time-zone="UTC" \
            --description="Automatically release expired booking holds" \
            --max-retry-attempts=3 \
            --min-backoff=5s \
            --max-backoff=60s
    else
        echo "⏭️  Skipping job update"
    fi
else
    echo "✨ Creating new scheduler job..."
    gcloud scheduler jobs create http release-expired-holds \
        --schedule="0 * * * *" \
        --uri="$DEPLOYMENT_URL/api/cron/release-holds" \
        --http-method=GET \
        --headers="Authorization=Bearer $CRON_SECRET_TOKEN,X-Appengine-Cron=true" \
        --time-zone="UTC" \
        --description="Automatically release expired booking holds" \
        --attempt-deadline="60s" \
        --max-retry-attempts=3 \
        --min-backoff=5s \
        --max-backoff=60s
fi

echo ""
echo "✅ Hold cleanup automation deployed successfully!"
echo ""
echo "📊 Job Details:"
echo "   Name: release-expired-holds"
echo "   Schedule: Every hour (0 * * * *)"
echo "   Endpoint: $DEPLOYMENT_URL/api/cron/release-holds"
echo "   Timezone: UTC"
echo ""
echo "🔐 Important: Save this token securely!"
echo "   CRON_SECRET_TOKEN=$CRON_SECRET_TOKEN"
echo ""
echo "⚠️  Next Steps:"
echo "   1. Add CRON_SECRET_TOKEN to your deployment environment variables"
echo "   2. Test the job: gcloud scheduler jobs run release-expired-holds"
echo "   3. Monitor logs: gcloud logging read \"resource.type=cloud_scheduler_job\""
echo ""
echo "🧪 To test manually:"
echo "   curl -H \"Authorization: Bearer $CRON_SECRET_TOKEN\" \\"
echo "        -H \"X-Appengine-Cron: true\" \\"
echo "        \"$DEPLOYMENT_URL/api/cron/release-holds\""
echo ""
echo "📋 View all scheduler jobs:"
echo "   gcloud scheduler jobs list"
echo ""

# Test the endpoint (optional)
read -p "🧪 Do you want to test the endpoint now? (y/N): " TEST_NOW

if [[ $TEST_NOW =~ ^[Yy]$ ]]; then
    echo "🔍 Testing the endpoint..."
    
    # Test with curl if available
    if command -v curl &> /dev/null; then
        echo "📡 Making test request..."
        RESPONSE=$(curl -s -w "\n%{http_code}" \
            -H "Authorization: Bearer $CRON_SECRET_TOKEN" \
            -H "X-Appengine-Cron: true" \
            "$DEPLOYMENT_URL/api/cron/release-holds")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n -1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅ Test successful! Response:"
            echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
        else
            echo "❌ Test failed with status code: $HTTP_CODE"
            echo "Response: $BODY"
        fi
    else
        echo "📋 curl not available. Please test manually using the command above."
    fi
fi

echo ""
echo "🎉 Deployment complete!"