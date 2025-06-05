# Hold Cleanup Deployment Documentation

**Status**: ✅ IMPLEMENTED  
**Issue**: [#6 Deploy automated hold cleanup function](https://github.com/b-coman/prop-management/issues/6)  
**Date**: June 3, 2025  

## Overview

Automated hold cleanup system to release expired booking holds and free up unnecessarily blocked dates. This implementation uses Cloud Scheduler + Next.js API route for reliable, scalable execution.

## Architecture

### Components

1. **API Endpoint**: `/api/cron/release-holds`
   - Next.js API route using Firebase Admin SDK
   - Handles authentication via Bearer token or cron headers
   - Processes expired holds and updates availability

2. **Cloud Scheduler Job**
   - Runs every hour (0 * * * *)
   - Calls the API endpoint with proper authentication
   - Includes retry logic and error handling

3. **Security Layer**
   - Bearer token authentication for manual triggers
   - X-Appengine-Cron header for scheduled executions
   - Unauthorized requests are rejected with 401

## Implementation Details

### Files Created

```
src/app/api/cron/release-holds/route.ts    # Main API endpoint
deploy-hold-cleanup.yaml                   # Deployment configuration
scripts/deploy-hold-cleanup.sh             # Automated deployment script
scripts/test-hold-cleanup-endpoint.ts      # Testing script
docs/implementation/hold-cleanup-deployment.md  # This documentation
```

### Key Features

- **Admin SDK Integration**: Uses `getFirestoreForPricing()` for reliable database access
- **Batch Operations**: Efficient processing of multiple expired holds
- **Availability Updates**: Properly releases dates in the `availability` collection
- **Error Handling**: Comprehensive error logging and graceful failure handling
- **Authentication**: Secure endpoint with multiple auth methods
- **Monitoring**: Detailed logging for troubleshooting

### Processing Logic

1. Query `bookings` collection for `status = 'on-hold'` AND `holdUntil <= now`
2. Update booking status to `'cancelled'` with automated note
3. Release availability in `availability` collection
4. Clear hold IDs from the holds map
5. Return summary of processed holds

## Deployment Instructions

### Prerequisites

- Google Cloud SDK installed and configured
- Project with Cloud Scheduler API enabled
- Deployment URL available

### Environment Variables

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export DEPLOYMENT_URL="https://your-domain.com"
```

### Automated Deployment

```bash
# Run the deployment script
./scripts/deploy-hold-cleanup.sh
```

### Manual Deployment

```bash
# Create the scheduler job
gcloud scheduler jobs create http release-expired-holds \
  --schedule="0 * * * *" \
  --uri="https://your-domain.com/api/cron/release-holds" \
  --http-method=GET \
  --headers="Authorization=Bearer YOUR_SECRET_TOKEN,X-Appengine-Cron=true" \
  --time-zone="UTC" \
  --description="Automatically release expired booking holds" \
  --attempt-deadline="60s" \
  --max-retry-attempts=3
```

## Testing

### Local Testing

```bash
# Start development server
npm run dev

# Run endpoint tests
npx tsx scripts/test-hold-cleanup-endpoint.ts
```

### Production Testing

```bash
# Manual trigger via gcloud
gcloud scheduler jobs run release-expired-holds

# Manual trigger via curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Appengine-Cron: true" \
     "https://your-domain.com/api/cron/release-holds"
```

## Monitoring

### Viewing Logs

```bash
# Scheduler job logs
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=release-expired-holds"

# Application logs (if using Cloud Run)
gcloud logging read "resource.type=cloud_run_revision"
```

### Success Metrics

- Expired holds processed per hour
- Zero-error execution
- Availability updates completed
- Response time under 60 seconds

## Security Considerations

1. **Token Security**: Store `CRON_SECRET_TOKEN` securely in environment variables
2. **Access Control**: Endpoint only accepts authenticated requests
3. **Rate Limiting**: Cloud Scheduler provides natural rate limiting
4. **Error Disclosure**: Limited error information in responses

## Operational Notes

### Schedule

- **Frequency**: Every hour at minute 0
- **Timezone**: UTC
- **Timeout**: 60 seconds
- **Retries**: Up to 3 attempts with exponential backoff

### Expected Behavior

- Holds expire 24 hours after creation (`holdUntil` timestamp)
- Booking status changes from `on-hold` to `cancelled`
- Dates become available in `availability` collection
- Hold IDs cleared from holds map

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check `CRON_SECRET_TOKEN` is set correctly
   - Verify authorization headers

2. **500 Internal Server Error**
   - Check Firebase Admin SDK initialization
   - Verify database permissions
   - Review application logs

3. **Timeout Errors**
   - Check if processing large batches
   - Consider increasing timeout duration
   - Monitor database performance

### Debugging Commands

```bash
# Check job status
gcloud scheduler jobs describe release-expired-holds

# View recent executions
gcloud scheduler jobs list --format="table(name,schedule,state,lastAttemptTime)"

# Test connectivity
curl -I https://your-domain.com/api/cron/release-holds
```

## Integration with Issue #6

This implementation addresses all requirements from Issue #6:

- ✅ Deploy `release-expired-holds.ts` as a Cloud Function (API route)
- ✅ Set up Cloud Scheduler to run hourly
- ✅ Add monitoring/logging for hold releases
- ✅ Add error handling and retry logic
- ✅ Test with expired holds in staging environment

## Next Steps

1. **Deploy to Production**: Use the deployment script in production environment
2. **Monitor Performance**: Track execution metrics for first week
3. **Customer Notification**: Consider adding email notifications for expired holds
4. **Integration Testing**: Verify availability updates work correctly with booking flow

## Related Documentation

- [Hold Expiration Implementation](hold-expiration.md)
- [Firebase Admin Setup Guide](../guides/firebase-admin-setup.md)
- [Availability System Architecture](../architecture/availability-system.md)

**Note**: Availability deduplication documentation moved to `archive/availability-migration/` after successful migration completion.