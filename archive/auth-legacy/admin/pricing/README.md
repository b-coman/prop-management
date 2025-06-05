# Admin Pricing Management

This directory contains the implementation of the pricing management interface for the admin panel, using Next.js server components with the Firebase Client SDK.

## Directory Structure

- `page.tsx` - Main pricing management page
- `server-actions-hybrid.ts` - Server actions for data fetching and mutations using Firebase Client SDK
- `_components/` - UI components for the pricing management interface
  - `property-display.tsx` - Property selector component
  - `seasonal-pricing-table.tsx` - Seasonal pricing table component
  - `date-overrides-table.tsx` - Date overrides table component
  - `price-calendar-manager.tsx` - Price calendar management component
- `seasons/new/` - New seasonal pricing creation page
- `date-overrides/new/` - New date override creation page

## Implementation Pattern

This implementation follows the Next.js 14 server component architecture with the following pattern:

1. Server components fetch data using server actions with the Firebase Client SDK
2. Data is passed to client components for rendering and interaction
3. User interactions trigger server actions to mutate data
4. Path revalidation is used to refresh data after mutations

## Firebase Client SDK

This implementation uses the Firebase Client SDK in server components and server actions instead of the Firebase Admin SDK. This is done for improved compatibility with Next.js and simplified setup.

For more details, see:
- `/docs/implementation/pricing-management-implementation.md`
- `/docs/guides/firebase-admin-setup.md`
- `/docs/architecture/admin-server-components.md`

## Historical Note

This implementation replaced an earlier attempt that used the Firebase Admin SDK. The old files have been archived in `/src/archive/admin-pricing-refactoring/`.