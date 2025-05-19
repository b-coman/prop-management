# Firebase App Hosting Deployment Resolution

## Problem

Firebase App Hosting deployment was failing with "Resource readiness deadline exceeded" error. The Cloud Run service was unable to start within the allotted time.

## Root Causes

1. **Port Configuration**: App was using port 3000 instead of Cloud Run's required port 8080
2. **Firebase Admin SDK**: Synchronous initialization at module level was blocking startup
3. **Health Checks**: Missing proper health check endpoints required by Cloud Run
4. **Middleware Issues**: Middleware was attempting to fetch domain resolution during startup, blocking all requests including health checks
5. **Traffic Routing**: Cloud Run traffic was not correctly routed to the most recent revision
6. **Firestore Data Structure**: Mismatch between expected and actual data structure

## Solutions Implemented

### 1. Port Configuration

Updated `package.json` to use the PORT environment variable:
```json
"start": "next start -p ${PORT:-8080}"
```

### 2. Firebase Admin SDK Lazy Loading

Converted from synchronous to lazy initialization in `firebaseAdmin.ts`:
```typescript
// Before: Immediate initialization
const adminApp = initializeApp({...});

// After: Lazy initialization
async function ensureFirebaseAdmin() {
  if (_adminApp && _dbAdmin && _authAdmin) {
    return;
  }
  // Initialize only when needed
}
```

### 3. Health Check Endpoints

Created `/api/health` and `/api/readiness` endpoints with both GET and POST support:
```typescript
export async function GET() {
  return new Response('OK', { status: 200 });
}
export async function POST() {
  return new Response('OK', { status: 200 });
}
```

### 4. Middleware Fixes

Updated middleware to:
- Exclude health check paths from processing
- Handle 0.0.0.0 hostname during startup
- Implement timeout for domain resolution
- Fail gracefully without blocking requests

```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|locales|health|readiness).*)',
  ],
};

// Skip health checks early
if (pathname === '/api/health' || pathname === '/api/readiness') {
  return NextResponse.next();
}

// Handle startup hostname issues
if (hostname.includes('0.0.0.0')) {
  return handleLanguageRouting(request, preferredLang);
}
```

### 5. Deployment Configuration

Updated `apphosting.yaml`:
```yaml
runConfig:
  minInstances: 1
  readinessCheckPath: /api/readiness
  livenessCheckPath: /api/health
  
buildConfig:
  buildCommand: npm run build
```

### 6. Dockerfile Optimization

Created optimized Dockerfile for standalone deployment:
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
COPY .next/standalone ./
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
```

## Testing

1. Local testing passes with `npm run build && npm start`
2. Health endpoints respond correctly
3. Middleware doesn't block startup
4. Created test script: `scripts/test-middleware-health.js`

## Next Steps

1. Deploy to Firebase App Hosting
2. Monitor startup times in Cloud Run logs
3. Verify health checks are working in production
4. Check middleware behavior with custom domains

### 7. Safe Firebase Admin Initialization

Created a more resilient Firebase Admin initialization in `firebaseAdminSafe.ts`:
```typescript
export async function initializeFirebaseAdminSafe() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      _adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with service account');
    } catch (parseError) {
      console.error('[FIREBASE ADMIN SAFE] Failed to parse service account:', parseError);
    }
  } else if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
    try {
      const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        _adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with service account file');
      }
    } catch (error) {
      console.error('[FIREBASE ADMIN SAFE] Failed to load service account file:', error);
    }
  } else {
    // Default initialization for dev environments
    try {
      _adminApp = admin.initializeApp();
      console.log('[FIREBASE ADMIN SAFE] ✅ Initialized with default credentials');
    } catch (error) {
      console.error('[FIREBASE ADMIN SAFE] Failed to initialize with default credentials:', error);
    }
  }
}
```

### 8. Cloud Run Traffic Routing Fix

Created a script to fix traffic routing to the latest revision (`scripts/fix-cloud-run-traffic-simple.sh`):
```bash
#!/bin/bash
SERVICE="rentalspot-builder"
REGION="us-central1"
PROJECT="rental-spot-builder"

echo "Getting latest revision..."
LATEST_REVISION=$(gcloud run revisions list --service $SERVICE --region $REGION --project $PROJECT --format="value(name)" --limit=1)

echo "Latest revision: $LATEST_REVISION"

# Export the current service configuration
echo "Exporting current service configuration..."
gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format=yaml > /tmp/service.yaml

# Update the traffic configuration to point to the latest revision
echo "Updating traffic configuration..."
sed "s/traffic:.*/traffic:\\n- revisionName: $LATEST_REVISION\\n  percent: 100/" /tmp/service.yaml > /tmp/service-updated.yaml

# Apply the updated configuration
echo "Applying updated configuration..."
gcloud run services replace /tmp/service-updated.yaml --region $REGION --project $PROJECT

echo "Traffic routing updated successfully."
```

### 9. Firestore Collection Structure Validation

Created a script to verify and fix Firestore data structure issues (`scripts/monitor-price-calendars.ts`):
```typescript
// Check required fields
if (dayData.baseOccupancyPrice === undefined || 
    dayData.available === undefined || 
    dayData.minimumStay === undefined) {
  const issue = `Invalid day structure in ${calendarId}, day ${sampleDay}: missing required fields`;
  console.error(`  ✗ ${issue}`);
  console.error(`  Day data: ${JSON.stringify(dayData)}`);
  issues.push(issue);
}
```

Also created a fix script for structure issues (`scripts/fix-price-calendar-structure.ts`):
```typescript
// Convert to the expected structure
const basePrice = dayData.adjustedPrice || dayData.basePrice;
        
updatedDays[dayNum] = {
  ...dayData,
  baseOccupancyPrice: basePrice,
};
```

### 10. API Debugging Endpoints

Created debugging endpoints to isolate issues with Firestore:
```typescript
export async function POST(request: NextRequest) {
  try {
    const { propertyId, checkIn, checkOut, guests } = await request.json();
    // Debug logs and checks
    console.log(`DEBUG: Checking pricing for ${propertyId} from ${checkIn} to ${checkOut} for ${guests} guests`);
    
    // Test Firebase connection
    console.log('DEBUG: Getting property');
    const property = await getPropertyWithDb(propertyId);
    console.log('DEBUG: Property found:', property.id);
    
    // Test calendar lookup
    console.log('DEBUG: Getting calendar');
    const checkInDate = parseISO(checkIn);
    const year = checkInDate.getFullYear();
    const month = checkInDate.getMonth() + 1;
    const calendar = await getPriceCalendarWithDb(propertyId, year, month);
    console.log('DEBUG: Calendar found:', calendar?.id);
    
    return NextResponse.json({ status: 'debug_success', property, calendar });
  } catch (error) {
    console.error('DEBUG ERROR:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

## Lessons Learned

1. Cloud Run requires port 8080 by default
2. Module-level initialization can block deployment
3. Health checks are critical for Cloud Run readiness
4. Middleware must handle edge cases during startup
5. Deployment configuration should explicitly define health check paths
6. Always test locally before deploying to production
7. Cloud Run traffic routing can get stuck on old revisions
8. Firestore data structure must match code expectations
9. Debugging endpoints are essential for isolating Cloud Run issues
10. Environment variables need fallback handling for Firebase Admin SDK