# Pricing Management Implementation

This document explains the implementation details of the pricing management system in the admin interface, focusing on how it uses the server component architecture with Firebase Client SDK.

## Overview

The pricing management system allows administrators to:

1. Manage seasonal pricing rules
2. Set date-specific price overrides
3. Generate and view price calendars

The implementation uses the Next.js server component architecture with Firebase Client SDK to ensure security, performance, and separation of concerns.

## Component Structure

### Page Component

The main page component (`/admin/pricing/page.tsx`) is a server component that:

- Renders the UI structure
- Uses Suspense for loading states
- Coordinates between different feature components

```tsx
export default async function PricingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Handle searchParams as a Promise to avoid TypeScript warnings
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' 
    ? params.propertyId 
    : undefined;

  // Fetch properties server-side using the client SDK
  const properties = await fetchProperties();
  
  // Fetch seasonal pricing and date overrides if a property is selected
  let seasonalPricing = [];
  let dateOverrides = [];
  
  if (propertyId) {
    [seasonalPricing, dateOverrides] = await Promise.all([
      fetchSeasonalPricing(propertyId),
      fetchDateOverrides(propertyId)
    ]);
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pricing Management</h1>
        <div className="text-sm text-green-600 font-medium">Server-side Rendered</div>
      </div>

      {/* Property Selector */}
      <PropertySelector properties={properties} />

      {propertyId ? (
        <Tabs defaultValue="seasons">
          {/* Tab navigation */}
          <TabsList>...</TabsList>
          
          {/* Seasonal Pricing Tab */}
          <TabsContent value="seasons">
            <Card>
              <CardContent>
                <SeasonalPricingTable 
                  seasonalPricing={seasonalPricing} 
                  propertyId={propertyId} 
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Date Overrides Tab */}
          <TabsContent value="overrides">...</TabsContent>
          
          {/* Price Calendar Tab */}
          <TabsContent value="calendar">...</TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">
                Please select a property to manage its pricing
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### Server Actions for Data Fetching

Server actions handle data fetching using the Firebase Client SDK:

```tsx
// src/app/admin/pricing/server-actions-hybrid.ts
'use server';

import { revalidatePath } from 'next/cache';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import the client SDK

export async function fetchProperties() {
  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);

    const properties = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name || doc.id,
      // ...other properties
    }));
    
    console.log(`[Server] Fetched ${properties.length} properties using client SDK`);
    return properties;
  } catch (error) {
    console.error('[Server] Error fetching properties:', error);
    return [];
  }
}

export async function fetchSeasonalPricing(propertyId: string) {
  try {
    const seasonalPricingRef = collection(db, 'seasonalPricing');
    const q = query(seasonalPricingRef, where('propertyId', '==', propertyId));
    const snapshot = await getDocs(q);

    const seasonalPricing = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    console.log(`[Server] Fetched ${seasonalPricing.length} seasonal pricing rules for property ${propertyId}`);
    return seasonalPricing;
  } catch (error) {
    console.error('[Server] Error fetching seasonal pricing:', error);
    return [];
  }
}
```

### Client Components

Client components handle user interactions:

```tsx
// src/app/admin/pricing/components/seasonal-pricing-table.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleSeasonalPricingStatus } from '../server-actions-hybrid';

export function SeasonalPricingTable({ 
  seasonalPricing, 
  propertyId 
}: { 
  seasonalPricing: SeasonalPricing[], 
  propertyId: string 
}) {
  const router = useRouter();
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Record<string, boolean>>({});
  
  // Handle status change
  const handleStatusChange = async (seasonId: string, enabled: boolean) => {
    setPendingStatusChanges(prev => ({ ...prev, [seasonId]: true }));
    
    try {
      await toggleSeasonalPricingStatus(seasonId, enabled);
      router.refresh(); // Refresh the page to get updated data
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setPendingStatusChanges(prev => ({ ...prev, [seasonId]: false }));
    }
  };
  
  return (
    <Table>
      {/* Table header */}
      <TableHeader>...</TableHeader>
      
      {/* Table body */}
      <TableBody>
        {seasonalPricing.map(season => (
          <TableRow key={season.id}>
            {/* Season details */}
            <TableCell>
              <Switch
                checked={season.enabled}
                disabled={!!pendingStatusChanges[season.id]}
                onCheckedChange={(checked) => handleStatusChange(season.id, checked)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Server Actions for Mutations

Server actions handle data mutations using the Firebase Client SDK:

```tsx
// src/app/admin/pricing/server-actions-hybrid.ts
'use server';

import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';

export async function toggleSeasonalPricingStatus(seasonId: string, enabled: boolean) {
  try {
    const docRef = doc(db, 'seasonalPricing', seasonId);
    await updateDoc(docRef, {
      enabled: enabled
    });
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating seasonal pricing:', error);
    throw new Error(`Failed to update seasonal pricing: ${error}`);
  }
}

export async function createSeasonalPricing(formData: FormData) {
  try {
    const propertyId = formData.get('propertyId') as string;
    const name = formData.get('name') as string;
    // Get other form fields...
    
    const newSeason = {
      propertyId,
      name,
      // Other fields...
      enabled: true
    };

    await addDoc(collection(db, 'seasonalPricing'), newSeason);
    
    // Invalidate cached data
    revalidatePath('/admin/pricing');
    
    // Redirect back to the pricing page
    redirect(`/admin/pricing?propertyId=${propertyId}`);
  } catch (error) {
    console.error('Error creating seasonal pricing:', error);
    throw new Error(`Failed to create seasonal pricing: ${error}`);
  }
}
```

## Data Flow

### 1. Initial Page Load

1. User navigates to `/admin/pricing`
2. Server component loads and fetches properties using the Client SDK
3. Server component renders the page with the property selector
4. Client components receive the initial data and render

### 2. Property Selection

1. User selects a property in the dropdown
2. Client updates the URL with the selected property ID
3. Page refreshes with the new URL
4. Server component fetches data for the selected property using the Client SDK

### 3. Tab Navigation

1. User clicks a tab (Seasons, Overrides, Calendar)
2. Client handles tab switching without server involvement
3. Content for all tabs is pre-fetched on initial load

### 4. Status Updates

1. User toggles a status switch (e.g., enabling a season)
2. Client calls the server action with the new status
3. Server action updates the data in Firestore using the Client SDK
4. Server action invalidates cached data
5. Page refreshes to show the updated data

### 5. New Item Creation

1. User clicks "Add New Season" button
2. Client navigates to the new season page
3. User fills out the form and submits
4. Server processes the form data
5. Server creates the new item in Firestore using the Client SDK
6. Server redirects back to the pricing page with updated data

## Data Models

### Property

```typescript
interface Property {
  id: string;
  name: string;
  location: string;
  status: string;
  pricePerNight?: number;
  baseCurrency?: string;
  baseOccupancy?: number;
  extraGuestFee?: number;
  maxGuests?: number;
  pricingConfig?: {
    weekendAdjustment?: number;
    weekendDays?: string[];
    lengthOfStayDiscounts?: Array<{
      nightsThreshold: number;
      discountPercentage: number;
    }>;
  };
}
```

### Seasonal Pricing

```typescript
interface SeasonalPricing {
  id: string;
  propertyId: string;
  name: string;
  seasonType: 'minimum' | 'low' | 'standard' | 'medium' | 'high';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  priceMultiplier: number;
  minimumStay?: number;
  enabled: boolean;
}
```

### Date Override

```typescript
interface DateOverride {
  id: string;
  propertyId: string;
  date: string; // YYYY-MM-DD
  customPrice: number;
  reason?: string;
  minimumStay?: number;
  available: boolean;
  flatRate: boolean;
}
```

## Fallback Data for Development

Each function provides fallback sample data when Firestore operations fail:

```typescript
// Sample data for development/fallback
const sampleSeasonalPricing: SeasonalPricing[] = [
  {
    id: 'winter-season-2023',
    propertyId,
    name: 'Winter Season 2023 [Sample]',
    seasonType: 'high',
    startDate: '2023-12-01',
    endDate: '2024-02-28',
    priceMultiplier: 1.5,
    minimumStay: 3,
    enabled: true
  },
  // More sample data...
];
```

This ensures the UI can be developed and tested even without a Firestore connection.

## Error Handling

Error handling happens at multiple levels:

1. **Server Actions for Fetching**: Catch Firestore errors and provide fallback data
2. **Client Components**: Display error states to the user
3. **Server Actions for Mutations**: Handle mutation errors and provide feedback

Example error handling in a server action:

```typescript
try {
  // Perform Firestore operation
  return result;
} catch (error) {
  console.error(`[Server] Error:`, error);
  return fallbackData; // For fetching actions
  // Or
  throw new Error(`Failed to perform action: ${error}`); // For mutation actions
}
```

Example client component error handling:

```typescript
if (error) {
  return <div className="py-6 text-center text-red-500">{error}</div>;
}
```

## Performance Considerations

The implementation includes several performance optimizations:

1. **Server-side Data Fetching**: Reduces client-side network requests
2. **Parallel Data Fetching**: Uses Promise.all for fetching multiple resources
3. **Suspense**: Uses React Suspense for loading states
4. **Minimal Client JavaScript**: Keeps most logic on the server

## Security Considerations

Security is ensured through several measures:

1. **Firebase Authentication**: Users must be authenticated to access admin routes
2. **Firestore Security Rules**: Rules enforce access control on the database level
3. **Server Actions**: Validate inputs before performing mutations
4. **Input Validation**: Ensures data integrity

## Conclusion

The pricing management system demonstrates the power of the server component architecture with Firebase Client SDK:

- **Security**: Authentication and Firestore security rules protect data
- **Performance**: Server-side rendering and data fetching improve speed
- **Separation of Concerns**: Clear boundaries between data fetching and UI
- **Development Experience**: Easy local development with sample data
- **Error Handling**: Graceful fallbacks and user feedback