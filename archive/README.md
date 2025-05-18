# Archive Directory

This directory contains archived client-side components that have been replaced with server-side implementations.

## Contents

### Admin Module

- `admin/layout.tsx` - Original client-side admin layout with auth checking
- `admin/pricing/page.tsx` - Original client-side pricing management page
- `admin/pricing/_components/` - Original client-side pricing components:
  - `pricing-property-selector.tsx` - Property selector component
  - `seasonal-pricing-table.tsx` - Seasonal pricing table component
  - `date-overrides-table.tsx` - Date overrides table component
  - `price-calendar-manager.tsx` - Price calendar manager component

## Why These Were Replaced

The original implementation used client-side data fetching and authentication which had several disadvantages:

1. **Security concerns**: Client-side operations exposed Firebase connection details to the browser
2. **Performance impact**: The browser had to handle database connections and queries, impacting user experience
3. **Authentication complexity**: Firebase authentication was more complex when handled on the client side
4. **Debugging difficulty**: Error handling was scattered across client components

The new server-side implementation:

1. Keeps sensitive operations on the server
2. Uses the Firebase Admin SDK exclusively on the server
3. Only sends rendered data to the client
4. Handles authentication via server-side sessions
5. Provides a cleaner architecture with better separation of concerns
6. Makes debugging easier with centralized error handling

## When to Reference These Files

These files can be referenced when:

1. Understanding the original implementation logic
2. Troubleshooting issues with the new server components
3. Learning about the migration from client to server components
4. Extracting specific utility functions or patterns used in the original code