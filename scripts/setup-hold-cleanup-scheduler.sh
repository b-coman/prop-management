#!/bin/bash

# Setup Cloud Scheduler for automatic hold cleanup
# This script creates a scheduled job to release expired holds every hour

echo "🚀 Setting up Cloud Scheduler for hold cleanup automation"
echo "======================================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Get current project
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No project selected. Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Using project: $PROJECT_ID"

# Enable required APIs
echo -e "\n📦 Enabling required APIs..."
gcloud services enable cloudscheduler.googleapis.com
gcloud services enable appengine.googleapis.com

# Check if App Engine app exists
echo -e "\n🔍 Checking App Engine status..."
if ! gcloud app describe &> /dev/null; then
    echo "📱 Creating App Engine app..."
    gcloud app create --region=us-central
fi

# Get the Cloud Run service URL
echo -e "\n🔍 Getting Cloud Run service URL..."
SERVICE_URL=$(gcloud run services describe rentalspot-builder --region=us-east1 --format='value(status.url)' 2>/dev/null)

if [ -z "$SERVICE_URL" ]; then
    echo "❌ Could not find Cloud Run service URL. Make sure the service is deployed."
    exit 1
fi

CRON_URL="${SERVICE_URL}/api/cron/release-holds"
echo "✅ Target URL: $CRON_URL"

# Create or update the Cloud Scheduler job
JOB_NAME="release-expired-holds"
echo -e "\n⏰ Creating Cloud Scheduler job: $JOB_NAME"

# Delete existing job if it exists
gcloud scheduler jobs delete $JOB_NAME --location=us-central1 --quiet 2>/dev/null || true

# Create new job
gcloud scheduler jobs create http $JOB_NAME \
  --location=us-central1 \
  --schedule="0 * * * *" \
  --description="Release expired booking holds every hour" \
  --uri="$CRON_URL" \
  --http-method=GET \
  --headers="X-Appengine-Cron=true" \
  --oidc-service-account-email="$(gcloud iam service-accounts list --filter='displayName:App Engine default service account' --format='value(email)')" \
  --oidc-token-audience="$SERVICE_URL" \
  --attempt-deadline=180s \
  --max-retry-attempts=3

echo -e "\n✅ Cloud Scheduler job created successfully!"
echo "📊 Job details:"
gcloud scheduler jobs describe $JOB_NAME --location=us-central1

echo -e "\n🧪 To test the job manually, run:"
echo "gcloud scheduler jobs run $JOB_NAME --location=us-central1"

echo -e "\n📝 To view logs:"
echo "gcloud logging read 'resource.type=\"cloud_scheduler_job\" AND resource.labels.job_id=\"$JOB_NAME\"' --limit=10"

echo -e "\n✅ Setup complete! The hold cleanup job will run every hour."