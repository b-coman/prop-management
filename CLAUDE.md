# Claude AI - RentalSpot Project Guide

**Last Updated**: 2026-02-04

## Project Overview

RentalSpot-Builder is a Next.js 15 vacation rental booking platform with:
- Public property pages and booking flows
- Admin dashboard for property/pricing management
- Stripe payment integration (full bookings + hold deposits)
- Multi-language support (EN/RO)
- Firebase/Firestore backend

## Current System Status

| System | Status | Notes |
|--------|--------|-------|
| Booking System | Production Ready | Single implementation, legacy V1 removed |
| Availability | Single-source | Uses `availability` collection only |
| Security Rules | Hardened | Admin-only writes on sensitive collections |
| Logging | Structured | ~416 calls migrated to namespace-based logger |
| Hold Flow | Working | Auto-expiration via cron job |

## Key Principles

### Code Changes
- **Modify existing files** - never create duplicates (no `.v2`, `.old`, `.backup`)
- **No hardcoded/mock data** - always use real Firestore data
- **Test before claiming done** - build must pass, functionality must work

### Documentation
- Only update docs when explicitly requested
- Focus on code changes over documentation
- Reference existing docs rather than recreating

## User Keywords

| Keyword | Behavior |
|---------|----------|
| `$nc` | No coding - investigate/research only |
| `$quick` | Brief, concise answers |
| `$explain` | Detailed explanations with examples |
| `$plan` | Create implementation plan before coding |

## Key Architecture Patterns

### Firebase SDK Usage

```
┌─────────────────────────────────────────────────────────┐
│  Browser/Client     │  Server Actions    │  Cron/API   │
│  (React Components) │  ("use server")    │  Routes     │
├─────────────────────────────────────────────────────────┤
│  Client SDK         │  Client SDK        │  Admin SDK  │
│  (rules apply)      │  (rules apply)     │  (bypasses) │
└─────────────────────────────────────────────────────────┘
```

**Important**: Server Actions use Client SDK, so Firestore rules still apply to them.

### Structured Logging

```typescript
import { loggers } from '@/lib/logger';

// Available namespaces
loggers.booking       // Core booking operations
loggers.stripe        // Payment processing
loggers.admin         // Admin operations
loggers.adminPricing  // Pricing management
loggers.availability  // Availability checks

// Usage
logger.info('Operation completed', { bookingId, propertyId });
logger.error('Operation failed', error as Error, { context });
logger.debug('Debug info', { data });  // Only shows when enabled
```

Enable debug logging:
- URL: `?debug=booking:*`
- Console: `LoggerConfig.enableDebug('booking:*')`
- Server: `RENTAL_SPOT_LOG_LEVEL=DEBUG`

## Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/FIRESTORE_PRODUCTION_READINESS.md` | Security rules, deployment checklist |
| `docs/ARCHITECTURE_CLEANUP_GUIDE.md` | Technical debt status, cleanup phases |
| `docs/testing/production-readiness-checklist.md` | Manual testing scenarios |
| `docs/implementation/booking-system-v2-specification.md` | Booking flow details |

## GitHub Issues Workflow

1. **Before creating issues**: ASK user first - "Should I create a GitHub issue for [X]?"
2. **Before fixing issues**: Investigate with `$nc` mode, present findings, wait for approval
3. **Never use emojis** in GitHub issues
4. **Reference issue numbers** in commits

## File Locations Quick Reference

| Purpose | Path |
|---------|------|
| Firestore Rules | `/firestore.rules` |
| Client SDK | `/src/lib/firebase.ts` |
| Admin SDK | `/src/lib/firebaseAdminSafe.ts` |
| Booking Service | `/src/services/bookingService.ts` |
| Availability Service | `/src/lib/availability-service.ts` |
| Logger | `/src/lib/logger.ts` |
| Stripe Webhook | `/src/app/api/webhooks/stripe/route.ts` |
| Cron: Release Holds | `/src/app/api/cron/release-holds/route.ts` |

## Common Tasks

### Check System Health
```bash
npm run build                    # Verify no build errors
gh issue list                    # Check open issues
```

### Debug Booking Issues
1. Check structured logs with appropriate namespace
2. Verify Firestore rules allow the operation
3. Check if using Client SDK vs Admin SDK appropriately

### Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```
