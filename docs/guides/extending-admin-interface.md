# Extending the Admin Interface

This guide explains how to extend the admin interface by adding new features using the server component architecture.

## Overview

The admin interface uses a combination of server and client components to create a secure, performant user experience. When adding new features, follow the established patterns to maintain consistency and security.

## Architecture Refresher

The admin interface follows a layered architecture:

1. **Server Components**: Handle data fetching and initial rendering
2. **Client Components**: Handle user interactions and UI updates
3. **Server Actions**: Handle data mutations and updates

## Adding a New Admin Feature

Follow these steps to add a new feature to the admin interface:

### 1. Create a New Admin Page

Create a new directory under `src/app/admin/your-feature/` with the following files:

- `page.tsx`: Main page component (server component)
- `actions.ts`: Server actions for data mutations

Example `page.tsx`:

```tsx
import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServerFeatureDataComponent } from './_components/server-feature-data';

export default async function YourFeaturePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Get query parameters
  const someId = typeof searchParams.someId === 'string' 
    ? searchParams.someId 
    : undefined;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Your Feature</h1>
      </div>

      {/* Main content */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading data...</div>}>
            <ServerFeatureDataComponent someId={someId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 2. Create Server Components for Data Fetching

Create a server component that fetches data and passes it to a client component:

```tsx
// src/app/admin/your-feature/_components/server-feature-data.tsx
import { getFeatureData, isFirestoreAdminAvailable } from '@/lib/server/your-feature-data';
import { ClientFeatureDataComponent } from './client-feature-data';

interface ServerFeatureDataComponentProps {
  someId?: string;
}

export async function ServerFeatureDataComponent({ someId }: ServerFeatureDataComponentProps) {
  // Sample data for development/fallback
  const sampleData = [
    { id: 'sample1', name: 'Sample Item 1' },
    { id: 'sample2', name: 'Sample Item 2' },
  ];

  // Check if Firestore Admin is available
  const firestoreAvailable = isFirestoreAdminAvailable();
  
  // Fetch data if Firestore is available
  let featureData = [];
  let fetchError = null;
  
  if (firestoreAvailable && someId) {
    try {
      featureData = await getFeatureData(someId);
    } catch (error) {
      console.error(`[Server] Error fetching data for ${someId}:`, error);
      fetchError = 'Failed to fetch data from database';
      // Fall back to sample data
      featureData = sampleData;
    }
  } else {
    console.log('[Server] Using sample data for development');
    featureData = sampleData;
  }

  // Pass data to client component
  return (
    <ClientFeatureDataComponent 
      data={featureData}
      isLoading={false}
      error={fetchError}
    />
  );
}
```

### 3. Create Client Components for User Interactions

Create a client component to handle user interactions:

```tsx
// src/app/admin/your-feature/_components/client-feature-data.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { performFeatureAction } from '../actions';

interface ClientFeatureDataComponentProps {
  data: any[];
  isLoading: boolean;
  error: string | null;
}

export function ClientFeatureDataComponent({
  data,
  isLoading,
  error
}: ClientFeatureDataComponentProps) {
  const router = useRouter();
  const [actionInProgress, setActionInProgress] = useState(false);
  
  const handleAction = async (itemId: string) => {
    setActionInProgress(true);
    try {
      await performFeatureAction(itemId);
      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setActionInProgress(false);
    }
  };

  if (isLoading) {
    return <div>Loading data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-4">
      {data.map(item => (
        <div key={item.id} className="p-4 border rounded">
          <h3>{item.name}</h3>
          <Button 
            onClick={() => handleAction(item.id)}
            disabled={actionInProgress}
          >
            Perform Action
          </Button>
        </div>
      ))}
    </div>
  );
}
```

### 4. Create Server Actions for Data Mutations

Create server actions to handle data mutations:

```tsx
// src/app/admin/your-feature/actions.ts
'use server';

import { dbAdmin } from '@/lib/firebaseAdmin';
import { revalidatePath } from 'next/cache';
import { isFirestoreAdminAvailable } from '@/lib/server/your-feature-data';

/**
 * Perform an action on a feature item
 */
export async function performFeatureAction(itemId: string) {
  if (!isFirestoreAdminAvailable()) {
    console.error('[Server] Firebase Admin is not initialized');
    throw new Error('Firebase Admin is not initialized');
  }

  try {
    // Perform the action in Firestore
    await dbAdmin.collection('your-feature-collection').doc(itemId).update({
      someField: 'some value',
      updatedAt: new Date()
    });
    
    console.log(`[Server] Updated item ${itemId}`);
    
    // Invalidate cached data
    revalidatePath('/admin/your-feature');
    
    return { success: true };
  } catch (error) {
    console.error(`[Server] Error updating item ${itemId}:`, error);
    throw new Error(`Failed to update item: ${error}`);
  }
}
```

### 5. Add Server-Side Data Utilities

Create utilities for data fetching:

```tsx
// src/lib/server/your-feature-data.ts
import { dbAdmin } from '@/lib/firebaseAdmin';
import { cache } from 'next/cache';

// Define types for the data model
export interface FeatureItem {
  id: string;
  name: string;
  // Add other fields...
}

/**
 * Fetch feature data
 * 
 * This function is cached to reduce database queries for repeated calls
 */
export const getFeatureData = cache(async (someId: string): Promise<FeatureItem[]> => {
  if (!dbAdmin) {
    console.error('Firebase Admin is not initialized');
    return [];
  }

  try {
    console.log(`[Server] Fetching feature data for ${someId}`);
    const snapshot = await dbAdmin
      .collection('your-feature-collection')
      .where('someField', '==', someId)
      .get();
    
    if (snapshot.empty) {
      console.log(`[Server] No feature data found for ${someId}`);
      return [];
    }

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed',
        // Map other fields...
      };
    });
  } catch (error) {
    console.error(`[Server] Error fetching feature data for ${someId}:`, error);
    return [];
  }
});

/**
 * Helper function to check if Firestore Admin is available
 */
export const isFirestoreAdminAvailable = (): boolean => {
  return !!dbAdmin;
};
```

### 6. Add a Navigation Link

Add a link to your new feature in the admin navbar:

```tsx
// src/app/admin/_components/ClientAdminNavbar.tsx
'use client';

import Link from 'next/link';
// ...imports...

export function ClientAdminNavbar() {
  // ...existing code...
  
  return (
    <header className="...">
      <div className="...">
        {/* Logo */}
        
        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-4">
          {/* Existing links */}
          
          {/* Add your new feature link */}
          <Link 
            href="/admin/your-feature" 
            className={`text-sm hover:underline flex items-center ${isActive('/admin/your-feature') ? 'font-semibold text-primary' : ''}`}
          >
            <YourIcon className="mr-1 h-4 w-4" /> Your Feature
          </Link>
          
          {/* Logout button */}
        </nav>
      </div>
    </header>
  );
}
```

## Development vs. Production

When developing new admin features, remember these key differences between development and production environments:

### Development Mode

- Authentication is bypassed automatically
- Sample data is used when Firestore is unavailable
- Visual indicators show you're in development mode
- Console logs provide detailed debugging information

### Production Mode

- Full authentication and authorization checks are enforced
- Real Firestore data is used
- No development mode indicators are shown
- Errors are logged but not displayed as prominently

## Best Practices

1. **Use Server Components for Data Fetching**
   - Keep Firestore Admin SDK operations on the server
   - Use the centralized `dbAdmin` instance from `/lib/firebaseAdmin.ts`
   - Implement proper error handling and fallbacks

2. **Use Client Components for Interactions**
   - Keep UI state and interactions in client components
   - Accept data as props from server components
   - Use server actions for data mutations

3. **Implement Proper Authentication**
   - All admin features should be inside the admin layout
   - Use the AdminAuthCheck component for new top-level pages
   - Don't bypass authentication checks in production code

4. **Provide Development Features**
   - Include sample data for development and testing
   - Log diagnostic information to the console
   - Add clear visual cues for development mode

5. **Document Your Features**
   - Add documentation for new admin features
   - Include information on data models and operations
   - Document any special considerations or requirements

## Troubleshooting

### Firebase Admin SDK Issues

- Ensure the `dbAdmin` instance is being used properly
- Check that the Firebase Admin SDK is initialized
- Look for error messages in the server console

### Component Rendering Issues

- Ensure server components don't use client-side hooks
- Check that client components are properly marked with 'use client'
- Verify that data is being passed correctly from server to client

### Authentication Issues

- Check that new routes are under the `/admin/` path
- Verify that authentication checks are not bypassed in production
- Ensure that users have the proper admin role in Firestore