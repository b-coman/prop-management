# Availability Feature Flags Implementation

**Status**: ✅ IMPLEMENTED  
**Issue**: [#10 Rollback plan for availability changes](https://github.com/b-coman/prop-management/issues/10)  
**Date**: June 3, 2025  

## Overview

**IMPORTANT**: This feature flag system is **TEMPORARY** and designed for safe migration only. Once the new availability system is proven stable in production, **ALL feature flags and legacy code will be completely removed**.

This implementation provides multiple safety mechanisms for transitioning from the current dual-storage availability system to a single source of truth, with instant rollback capabilities.

## Architecture

### Feature Flag Modes

1. **LEGACY Mode** (Default - Current System)
   - Uses `priceCalendars` collection only
   - Zero risk - existing proven system
   - Environment: All flags `false`

2. **DUAL CHECK Mode** (Testing/Validation)
   - Checks both `availability` and `priceCalendars`
   - Logs discrepancies for analysis
   - Uses configurable primary source
   - Environment: `AVAILABILITY_DUAL_CHECK=true`

3. **SINGLE SOURCE Mode** (Target System)
   - Uses `availability` collection only
   - Final target architecture
   - Environment: `AVAILABILITY_SINGLE_SOURCE=true`

### Safety Mechanisms

- **Instant Rollback**: Environment variable toggle (no deployment needed)
- **Fallback Protection**: Automatic fallback to `priceCalendars` on errors
- **Dual Validation**: Compare both sources to detect issues
- **Comprehensive Logging**: Track all decisions and discrepancies

## Implementation Files

### Core Components

```
src/config/features.ts              # Feature flag definitions
src/lib/availability-service.ts     # Unified availability service (TEMPORARY)
src/app/api/check-pricing-v2/route.ts  # New endpoint with flag support
scripts/availability-rollback.sh    # Quick rollback script
scripts/test-availability-flags.ts  # Testing utilities
```

### Feature Flags

```typescript
interface FeatureFlags {
  // TEMPORARY FLAGS - Will be removed after migration
  AVAILABILITY_SINGLE_SOURCE: boolean;     // Use availability collection only
  AVAILABILITY_DUAL_CHECK: boolean;        // Compare both sources
  AVAILABILITY_LEGACY_FALLBACK: boolean;   // Fallback on errors
}
```

### Environment Variables

```bash
# Legacy Mode (Default)
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true

# Dual Check Mode
AVAILABILITY_SINGLE_SOURCE=false
AVAILABILITY_DUAL_CHECK=true
AVAILABILITY_LEGACY_FALLBACK=true

# Single Source Mode (Target)
AVAILABILITY_SINGLE_SOURCE=true
AVAILABILITY_DUAL_CHECK=false
AVAILABILITY_LEGACY_FALLBACK=true
```

## Migration Strategy

### Phase 1: Legacy Mode (Week 1)
- Deploy feature flag infrastructure
- All flags disabled (existing system)
- Validate rollback mechanisms

### Phase 2: Dual Check Mode (Week 1-2)
- Enable `AVAILABILITY_DUAL_CHECK=true`
- Monitor for discrepancies
- Keep `priceCalendars` as primary source
- Build confidence in `availability` collection accuracy

### Phase 3: Single Source Mode (Week 2-3)
- Enable `AVAILABILITY_SINGLE_SOURCE=true`
- Switch to `availability` collection as primary
- Keep fallback enabled for safety
- Monitor performance and accuracy

### Phase 4: Cleanup (Week 3+)
- Remove all feature flags
- Delete legacy code and temporary service
- Update original `/api/check-pricing` endpoint
- Remove this documentation

## Rollback Procedures

### 1. Instant Rollback (< 5 minutes)

```bash
# Emergency rollback script
./scripts/availability-rollback.sh --emergency

# Manual environment variable update
export AVAILABILITY_SINGLE_SOURCE=false
export AVAILABILITY_DUAL_CHECK=false
export AVAILABILITY_LEGACY_FALLBACK=true
```

### 2. Production Rollback (< 30 minutes)

```bash
# Using gcloud for Cloud Run
gcloud run services update rentalspot-builder \
  --update-env-vars "AVAILABILITY_SINGLE_SOURCE=false,AVAILABILITY_DUAL_CHECK=false" \
  --region=us-central1
```

### 3. Code Rollback (if flags fail)

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Redeploy
npm run build
npm run deploy
```

## Testing

### Local Testing

```bash
# Start development server
npm run dev

# Run feature flag tests
npx tsx scripts/test-availability-flags.ts

# Interactive rollback testing
./scripts/availability-rollback.sh
```

### Production Testing

```bash
# Test specific mode
curl -X POST https://your-domain.com/api/check-pricing-v2 \
  -H "Content-Type: application/json" \
  -d '{"propertyId":"test-property","checkIn":"2025-07-01","checkOut":"2025-07-03","guests":4}'

# Check feature flag status in response meta
```

## Monitoring

### Key Metrics

1. **Discrepancy Rate**: % of requests where sources disagree
2. **Error Rate**: Failed availability checks by source
3. **Response Time**: Performance comparison between modes
4. **Fallback Rate**: How often fallback is triggered

### Log Analysis

```bash
# Search for discrepancies
grep "DISCREPANCY DETECTED" logs/

# Monitor source usage
grep "Availability result" logs/ | grep -E "(availability|priceCalendars)"

# Check fallback usage
grep "Falling back to priceCalendars" logs/
```

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| June 3, 2025 | Create temporary feature flag system | Safe migration with instant rollback capability |
| June 3, 2025 | Keep legacy code intact during transition | Zero-risk rollback option |
| June 3, 2025 | Implement dual check mode | Validate new system against known-good legacy system |
| June 3, 2025 | Create unified availability service | Abstract complexity from API endpoints |

## Cleanup Checklist

**Execute after successful migration (estimated Week 3):**

- [ ] Remove `AVAILABILITY_*` feature flags from `src/config/features.ts`
- [ ] Delete `src/lib/availability-service.ts` (temporary service)
- [ ] Delete `/api/check-pricing-v2` endpoint
- [ ] Update original `/api/check-pricing` to use availability collection directly
- [ ] Remove `scripts/availability-rollback.sh`
- [ ] Remove `scripts/test-availability-flags.ts`
- [ ] Delete this documentation file
- [ ] Update all related documentation to reflect single-source architecture
- [ ] Remove `available` field from `priceCalendars` schema
- [ ] Clean up environment variables in all deployments

## Related Documentation

- [Availability Deduplication Plan](availability-deduplication-plan.md)
- [Hold Cleanup Deployment](hold-cleanup-deployment.md)
- [Feature Flag Configuration](../guides/feature-flags.md)

---

**Remember**: This entire feature flag system is **temporary infrastructure**. The goal is to completely eliminate it once the migration is successful, leaving only the clean, single-source architecture.