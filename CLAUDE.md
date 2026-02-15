# Claude AI - RentalSpot Project Guide

## Project Overview

Next.js 15 multi-property vacation rental platform with Stripe payments, Firebase backend, and multi-language support (EN/RO). Designed to scale to many properties.

## Current System Status

| System | Status |
|--------|--------|
| Booking System | Production ready, single implementation |
| Availability | Single-source (`availability` collection) |
| Security Rules | Hardened, admin-only writes on sensitive collections |
| Logging | Structured JSON logger → Cloud Logging (not console.*) |
| Error Tracking | Sentry (`@sentry/nextjs`) — production-only, auto-captures + logger integration |
| Rate Limiting | Public APIs protected (60 req/min per IP) |
| Hold Cleanup | Cloud Scheduler at 00:00/12:00 UTC |

## Key Rules

1. **Modify existing files** - never create duplicates or version suffixes
2. **No mock/hardcoded data** - always use real Firestore data
3. **Test before claiming done** - `npm run build` must pass
4. **Use structured logger** - `loggers.*` from `src/lib/logger.ts`
5. **Update docs only when requested** - focus on code changes
6. **Query live Firestore, not local JSON** - seed files in `firestore/` can be stale; use `npx tsx scripts/query-firestore.ts <collection> [docId] [-- field1 field2]` to check real data
7. **Multi-property first** - every feature must work for any property, not just the current one. Never hardcode property-specific data in components. Use Firestore config, property overrides, and template defaults. Changes for one property must be viable system-wide.

## User Keywords

| Keyword | Behavior |
|---------|----------|
| `$nc` | No coding - investigate/research only |
| `$quick` | Brief, concise answers |
| `$explain` | Detailed explanations with examples |
| `$plan` | Create implementation plan before coding |

## Architecture

**Firebase SDK Usage:**
- Browser components → Client SDK (rules apply, has auth context)
- Server-side code (API routes, server components, server actions) → Admin SDK (bypasses rules)

*Why Admin SDK on server:* Client SDK requires Firebase Auth context which doesn't exist in server-side code. Firestore rules check `request.auth` which is null on server.

**Firebase Ecosystem:**
- App Hosting: Cloud Run (europe-west4), auto-deploy on push to main
- Custom domain: `prahova-chalet.ro` — when adding new custom domains, also add them to `serverActions.allowedOrigins` in `next.config.ts`
- Scheduler: `/api/cron/release-holds` (twice daily)
- Secrets: 15 in Secret Manager
- Storage: Firebase Storage bucket

**Logging & Error Tracking:**
- Use `loggers.*` from `src/lib/logger.ts` — never raw `console.log`
- Production: outputs structured JSON to stdout → Cloud Run logging agent → Cloud Logging
- Dev: outputs human-readable text to console
- Cloud Logging retention: 30 days, DEBUG excluded, INFO/WARN/ERROR captured
- **Sentry**: `@sentry/nextjs` — production-only, auto-captures client + server + edge errors
- All `loggers.*.error()` calls automatically flow to Sentry via `sendToExternalLogger()` with component tag
- Error boundaries: `src/app/error.tsx` + `src/app/global-error.tsx` → `Sentry.captureException()`
- Config: `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation.ts`, `src/instrumentation-client.ts`
- DSN: plain value in `apphosting.yaml` (public, not a secret)
- `'use server'` files can ONLY export async functions — never export objects/constants (silent 500 crash)

**Query production logs:**
```bash
# All app logs (last hour)
gcloud logging read 'logName:"run.googleapis.com/stdout"' --limit=20 \
  --format="table(timestamp, severity, jsonPayload.component, jsonPayload.message)" --freshness=1h

# Errors only
gcloud logging read 'logName:"run.googleapis.com/stdout" AND severity>=ERROR' --freshness=24h

# Specific component
gcloud logging read 'logName:"run.googleapis.com/stdout" AND jsonPayload.component="housekeeping"' --freshness=1h
```

**Logger Namespaces:**
`booking`, `bookingContext`, `bookingAPI`, `bookingStorage`, `bookingUI`, `pricing`, `availability`, `auth`, `authorization`, `stripe`, `email`, `admin`, `adminBookings`, `adminPricing`, `performance`, `error`, `languageSystem`, `whatsapp`, `housekeeping`, `icalSync`, `review`, `guest`, `tracking`

## Key Files

| Purpose | Path |
|---------|------|
| Firestore Rules | `firestore.rules` |
| Cloud Run Config | `apphosting.yaml` |
| Client SDK | `src/lib/firebase.ts` |
| Admin SDK | `src/lib/firebaseAdminSafe.ts` |
| Authorization | `src/lib/authorization.ts` |
| Logger | `src/lib/logger.ts` |
| Sentry Config | `src/sentry.server.config.ts`, `src/instrumentation.ts` |
| Rate Limiter | `src/lib/rate-limiter.ts` |
| Booking Service | `src/services/bookingService.ts` |
| Guest Service | `src/services/guestService.ts` |
| Hold Cleanup Cron | `src/app/api/cron/release-holds/route.ts` |
| Firestore Query Tool | `scripts/query-firestore.ts` |

## GitHub Issues

- ASK before creating issues
- **Create issues with full context BEFORE implementing** - issues should be detailed enough to drive independent implementation
- Investigate with `$nc` mode before fixing
- No emojis in issues
- Reference issue numbers in commits (`Closes #123`)
- **When closing issues**, add a comment summarizing what was implemented:
  - Files created/modified
  - Key functions or patterns used
  - Any deviations from original plan

## Development Workflow

**For complex features:**
1. Create detailed plan in `plans/<feature-name>.md`
2. Create GitHub issues from plan (with full context)
3. Implement in logical phases
4. Run `npm run build` between phases to catch issues early
5. Review: in a fresh session, diff `plans/<feature>.md` against actual implementation

## Commit & Deploy

**Push to `main` auto-deploys to production.** No staging environment.

Before pushing:
1. `npm run build` must pass
2. Test critical functionality locally

Commit format: `<type>: <description>` + Co-Authored-By line

Types: `feat`, `fix`, `refactor`, `docs`, `perf`, `security`

Firestore rules (deployed separately): `firebase deploy --only firestore:rules`

**Secrets Management:**
```bash
firebase apphosting:secrets:set SECRET_NAME
firebase apphosting:secrets:grantaccess SECRET_NAME --backend prop-management
```
