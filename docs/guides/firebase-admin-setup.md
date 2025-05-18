# Firebase Client SDK for Admin Usage Guide

This guide explains how to properly use the Firebase Client SDK for admin operations, replacing the previous Admin SDK approach for better compatibility with Next.js server components and server actions.

## Key Changes

- **Using Client SDK**: We now use the Firebase Client SDK for admin operations instead of the Admin SDK
- **Simplified Setup**: No need for service account credentials
- **Better Compatibility**: Works in all environments including Edge Runtime
- **Unified Approach**: Same SDK for both client and server operations

## Setup Instructions

### 1. Firebase Client SDK Configuration

Ensure your Firebase Client SDK is properly configured in `/src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
```

### 2. Environment Variables

Ensure these environment variables are set in your `.env.local` file:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 3. Create Admin Client Functions

Create a dedicated file for admin operations using the Firebase Client SDK:

```typescript
// src/lib/firebaseClientAdmin.ts
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

// Example function to get all properties
export async function getAdminProperties() {
  if (!db) {
    console.error('Firestore client not available');
    return [];
  }
  
  try {
    const propertiesRef = collection(db, 'properties');
    const snapshot = await getDocs(propertiesRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching properties:', error);
    return [];
  }
}

// Add more admin functions as needed
```

### 4. Creating Server Actions

Use the Firebase Client SDK in your server actions:

```typescript
// src/app/admin/your-feature/server-actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { collection, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function updateAdminItem(id: string, data: any) {
  try {
    const docRef = doc(db, 'collection-name', id);
    await updateDoc(docRef, data);
    
    // Revalidate the path to refresh server component data
    revalidatePath('/admin/your-feature');
    
    return { success: true };
  } catch (error) {
    console.error('Error updating item:', error);
    return { success: false, error: 'Failed to update item' };
  }
}
```

### 5. Using in Server Components

Use your admin functions in server components:

```typescript
// src/app/admin/your-feature/page.tsx
import { getAdminItems } from '@/lib/firebaseClientAdmin';

export default async function AdminPage() {
  // Fetch data using the admin client functions
  const items = await getAdminItems();
  
  return (
    <div>
      {/* Render your admin UI */}
      <ItemList items={items} />
    </div>
  );
}
```

## Best Practices

1. **Separate Files**: Keep admin-specific Firebase functions in a separate file
2. **Error Handling**: Always include proper error handling for Firestore operations
3. **Data Validation**: Validate data before writing to Firestore
4. **Path Revalidation**: Use `revalidatePath()` after mutations to refresh server component data
5. **Security Rules**: Ensure your Firestore security rules properly restrict access based on authentication

## Security Considerations

When using the Firebase Client SDK for admin operations, security is primarily enforced through Firebase Security Rules, not service account permissions. Ensure your security rules are properly configured to:

1. Verify authentication status
2. Check admin claims or custom claims
3. Restrict access based on user roles
4. Validate data structure and types

Example security rules for admin operations:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if a user is an admin
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }
    
    // Collection that only admins can access
    match /adminCollection/{document=**} {
      allow read, write: if isAdmin();
    }
    
    // Regular collections with admin override
    match /properties/{propertyId} {
      allow read: if true; // Public read access
      allow write: if isAdmin(); // Only admins can write
    }
  }
}
```

## Troubleshooting

### Authentication Issues

If your admin operations are failing due to authentication:

1. Verify the user has properly signed in
2. Check if admin claims are correctly set on the user
3. Test your security rules in the Firebase console

### Firestore Operation Failures

If Firestore operations are failing:

1. Check console for specific error messages
2. Verify you're using the correct collection and document paths
3. Ensure you have proper error handling

### Server Action Issues

If server actions aren't working:

1. Make sure you've added the 'use server' directive
2. Check that you're importing the Firebase client correctly
3. Verify that revalidation is working by checking server logs