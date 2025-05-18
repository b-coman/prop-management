# Admin Pricing Refactoring Archive

This directory contains files that were part of the initial implementation and refactoring attempts for the admin pricing management interface.

## Why These Files Were Archived

These files are no longer in use because the implementation approach was changed from using the Firebase Admin SDK to using the Firebase Client SDK for admin operations. This change was made for the following reasons:

1. Better compatibility with Next.js server components and Edge Runtime
2. Simplified setup without requiring service account credentials
3. Unified approach matching other admin interfaces (like the coupons section)
4. Improved maintainability with clearer separation of concerns

## Directory Structure

- `/components/` - Old component files using both server-side and client-side approaches
- `/server-actions/` - Old server action files using various Firebase Admin SDK approaches
- `/config/` - Old configuration files
- Root level - Various Firebase Admin SDK implementation attempts

## Migration Summary

The active implementation now uses:

1. `src/lib/firebaseClientAdmin.ts` for admin operations using the Firebase Client SDK
2. `src/app/admin/pricing/server-actions-hybrid.ts` for server actions
3. `src/app/admin/pricing/_components/` for simplified components
4. `src/app/admin/pricing/page.tsx` as the main entry point

## Documentation

For more information on the current implementation, please refer to:

- `/docs/implementation/pricing-management-implementation.md`
- `/docs/guides/firebase-admin-setup.md` (now "Firebase Client SDK for Admin Usage Guide")
- `/docs/architecture/admin-server-components.md`

This archive is maintained for reference purposes only. New development should follow the patterns established in the active implementation.