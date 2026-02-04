# Claude AI - RentalSpot Project Guide

## Project Overview

Next.js 15 vacation rental booking platform with Stripe payments, Firebase/Firestore backend, and multi-language support (EN/RO).

## Current System Status

| System | Status |
|--------|--------|
| Booking System | Production ready, single implementation |
| Availability | Single-source (`availability` collection) |
| Security Rules | Hardened, admin-only writes on sensitive collections |
| Logging | Structured logger with namespaces |
| Hold Flow | Working with auto-expiration cron |

## Key Rules

1. **Modify existing files** - never create duplicates or version suffixes
2. **No mock/hardcoded data** - always use real Firestore data
3. **Test before claiming done** - `npm run build` must pass, functionality must work
4. **Use structured logger** - not `console.*` (see `src/lib/logger.ts`)
5. **Update docs only when requested** - focus on code changes

## User Keywords

| Keyword | Behavior |
|---------|----------|
| `$nc` | No coding - investigate/research only |
| `$quick` | Brief, concise answers |
| `$explain` | Detailed explanations with examples |
| `$plan` | Create implementation plan before coding |

## Architecture Quick Reference

**Firebase SDK Usage:**
- Browser & Server Actions → Client SDK (rules apply)
- API routes & Cron jobs → Admin SDK (bypasses rules)

**Logger Namespaces:** `booking`, `bookingContext`, `stripe`, `admin`, `adminPricing`, `adminBookings`, `availability`, `email`

## Key Files

| Purpose | Path |
|---------|------|
| Firestore Rules | `firestore.rules` |
| Client SDK | `src/lib/firebase.ts` |
| Admin SDK | `src/lib/firebaseAdminSafe.ts` |
| Logger | `src/lib/logger.ts` |
| Booking Service | `src/services/bookingService.ts` |
| Stripe Webhook | `src/app/api/webhooks/stripe/route.ts` |

## Key Documentation

| Document | Purpose |
|----------|---------|
| `docs/FIRESTORE_PRODUCTION_READINESS.md` | Security, deployment status |
| `docs/ARCHITECTURE_CLEANUP_GUIDE.md` | Technical debt, cleanup phases |
| `docs/testing/production-readiness-checklist.md` | Manual test scenarios |

## GitHub Issues

- ASK before creating issues
- Investigate with `$nc` mode before fixing
- No emojis in issues
- Reference issue numbers in commits

## Commit & Deploy

**Push to `main` auto-deploys to production.** No staging environment.

Before pushing:
1. `npm run build` must pass
2. Test critical functionality locally

Commit format:
```
<type>: <description>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `perf`, `security`

Firestore rules deploy separately: `firebase deploy --only firestore:rules`
