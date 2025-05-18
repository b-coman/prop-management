# Edge Runtime Compatibility

This document explains the changes made to ensure that components, middleware, and server actions work correctly with Edge Runtime in Next.js, including recent updates for multilingual support.

## Problem Overview

When using Next.js server components and server actions with Edge Runtime, certain Node.js-specific APIs are not available. This includes:

1. File system access (`fs` module)
2. Path manipulation (`path` module)
3. Environment variable loading via `dotenv`

Additionally, Edge Runtime is more strict about module importing and exporting, so any referenced functions must be properly exported from their respective modules.

## Changes Made

### 1. Firebase Admin Initialization

**Before**: The Firebase Admin SDK was initialized using file system access to read service account credentials from a local file specified in environment variables.

**After**: We modified the initialization to use a JSON string stored directly in environment variables, which is compatible with Edge Runtime.

```typescript
// Old approach - using file system (NOT Edge compatible)
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account file does not exist at path: ${serviceAccountPath}`);
  }
  const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountContent);
  // Initialize Firebase with the parsed account...
}

// New approach - using environment variables (Edge compatible)
const serviceAccountJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
if (serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    // Initialize Firebase with the parsed account...
  } catch (parseError) {
    console.error('Failed to parse service account JSON:', parseError);
  }
}
```

### 2. Missing Function Export

Added the missing `toggleDateOverrideAvailability` function to the pricing admin server actions:

```typescript
/**
 * Toggle a date override's availability status
 *
 * @param dateOverrideId The ID of the date override
 * @param available The new availability status
 */
export async function toggleDateOverrideAvailability(dateOverrideId: string, available: boolean) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    await dbAdmin.collection('dateOverrides').doc(dateOverrideId).update({
      available: available
    });

    // Get the override data to find property info
    const overrideDoc = await dbAdmin.collection('dateOverrides').doc(dateOverrideId).get();
    const overrideData = overrideDoc.data();
    
    // After updating an override, regenerate price calendar if needed
    if (overrideData && overrideData.propertyId && overrideData.date) {
      try {
        await updatePriceCalendarsForProperty(overrideData.propertyId, 1);
      } catch (calendarError) {
        console.error('[Server] Error updating price calendar:', calendarError);
        // Continue anyway since the override was updated successfully
      }
    }

    // Invalidate cached data
    revalidatePath('/admin/pricing');
    revalidatePath('/manage-pricing'); // Also revalidate non-admin path

    return { success: true };
  } catch (error) {
    console.error(`[Server] Error updating date override ${dateOverrideId}:`, error);
    throw new Error(`Failed to update date override: ${error}`);
  }
}
```

### 3. Standardized Database Reference Usage

Updated all server actions to consistently use `dbAdmin` instead of `db` and properly check for initialization:

```typescript
// Before
if (!db) {
  db = initializeFirebaseAdmin();
}
const result = await db.collection('...');

// After
if (!isFirestoreAdminAvailable()) {
  console.error('[Server] Firebase Admin is not initialized');
  return { success: false, error: 'Firebase Admin is not initialized' };
}
const result = await dbAdmin.collection('...');
```

## Environment Configuration

For the new approach to work, you need to set up an environment variable containing the Firebase service account credentials as a JSON string:

1. Create an environment variable `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` containing the entire service account JSON data:

   ```env
   FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
   ```

   Note: Make sure to properly escape quotes and newlines in the private key.

2. Remove the old `FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH` variable from your environment.

## Benefits of These Changes

1. **Edge Compatibility**: All code now runs correctly in Edge Runtime without using Node.js-specific APIs.
2. **Simplified Deployment**: No need to manage separate service account files; all configuration is in environment variables.
3. **Improved Security**: Service account credentials can be set as encrypted environment variables in your hosting platform.
4. **Consistent Error Handling**: Standardized approach to checking for Firebase initialization and handling errors.

## Language Constants Separation (May 2024)

### Problem
The language constants (`SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`) were defined in a client component file (`useLanguage.ts` with "use client" directive), which caused issues when importing them into server components or Edge Runtime contexts.

### Solution
Created a separate constants file without the "use client" directive:

```typescript
// src/lib/language-constants.ts
export const SUPPORTED_LANGUAGES = ['en', 'ro'];
export const DEFAULT_LANGUAGE = 'en';
```

### Implementation
1. **Created new file**: `/src/lib/language-constants.ts`
2. **Updated imports**:
   - `useLanguage.ts` - imports from constants file
   - `middleware.ts` - imports from constants file
   - `LanguageContext.tsx` - imports from constants file
   - Page components - import from constants file

### Benefits
- Constants are accessible in both client and server contexts
- Edge Runtime compatible
- No "use client" directive conflicts
- Centralized language configuration

## Testing

When testing these changes, verify that:

1. Admin authentication works correctly
2. Date override availability toggle functions properly
3. Seasonal pricing management works as expected
4. Price calendar generation completes successfully
5. No Node.js-specific errors appear in the console or server logs
6. Language constants are accessible in all contexts
7. Middleware language detection works properly