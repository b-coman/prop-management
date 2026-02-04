# Claude AI - RentalSpot Project Guide

## Project Overview

Next.js 15 multi-property vacation rental platform with Stripe payments, Firebase backend, and multi-language support (EN/RO). Designed to scale to many properties.

## Current System Status

| System | Status |
|--------|--------|
| Booking System | Production ready, single implementation |
| Availability | Single-source (`availability` collection) |
| Security Rules | Hardened, admin-only writes on sensitive collections |
| Logging | Structured logger with namespaces (not console.*) |
| Rate Limiting | Public APIs protected (60 req/min per IP) |
| Hold Cleanup | Cloud Scheduler at 00:00/12:00 UTC |

## Key Rules

1. **Modify existing files** - never create duplicates or version suffixes
2. **No mock/hardcoded data** - always use real Firestore data
3. **Test before claiming done** - `npm run build` must pass
4. **Use structured logger** - `loggers.*` from `src/lib/logger.ts`
5. **Update docs only when requested** - focus on code changes

## User Keywords

| Keyword | Behavior |
|---------|----------|
| `$nc` | No coding - investigate/research only |
| `$quick` | Brief, concise answers |
| `$explain` | Detailed explanations with examples |
| `$plan` | Create implementation plan before coding |

## Architecture

**Firebase SDK Usage:**
- Browser & Server Actions → Client SDK (rules apply)
- API routes & Cron jobs → Admin SDK (bypasses rules)

**Firebase Ecosystem:**
- App Hosting: Cloud Run (europe-west4), auto-deploy on push to main
- Scheduler: `/api/cron/release-holds` (twice daily)
- Secrets: 15 in Secret Manager
- Storage: Firebase Storage bucket

**Logger Namespaces:**
`booking`, `bookingContext`, `bookingAPI`, `bookingStorage`, `bookingUI`, `pricing`, `availability`, `auth`, `stripe`, `email`, `admin`, `adminBookings`, `adminPricing`, `performance`, `error`, `languageSystem`

## Key Files

| Purpose | Path |
|---------|------|
| Firestore Rules | `firestore.rules` |
| Cloud Run Config | `apphosting.yaml` |
| Client SDK | `src/lib/firebase.ts` |
| Admin SDK | `src/lib/firebaseAdminSafe.ts` |
| Logger | `src/lib/logger.ts` |
| Rate Limiter | `src/lib/rate-limiter.ts` |
| Booking Service | `src/services/bookingService.ts` |
| Hold Cleanup Cron | `src/app/api/cron/release-holds/route.ts` |

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

Commit format: `<type>: <description>` + Co-Authored-By line

Types: `feat`, `fix`, `refactor`, `docs`, `perf`, `security`

Firestore rules: `firebase deploy --only firestore:rules`
