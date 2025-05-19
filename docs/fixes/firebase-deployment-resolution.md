# Firebase App Hosting Deployment Resolution

## Problem

Firebase App Hosting deployment was failing with "Resource readiness deadline exceeded" error. The Cloud Run service was unable to start within the allotted time.

## Root Causes

1. **Port Configuration**: App was using port 3000 instead of Cloud Run's required port 8080
2. **Firebase Admin SDK**: Synchronous initialization at module level was blocking startup
3. **Health Checks**: Missing proper health check endpoints required by Cloud Run
4. **Middleware Issues**: Middleware was attempting to fetch domain resolution during startup, blocking all requests including health checks

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

## Lessons Learned

1. Cloud Run requires port 8080 by default
2. Module-level initialization can block deployment
3. Health checks are critical for Cloud Run readiness
4. Middleware must handle edge cases during startup
5. Deployment configuration should explicitly define health check paths