# Admin Authentication System

This document describes the authentication system implemented for the admin interface, including how it works in both development and production environments.

## Overview

The admin interface uses a multi-layered authentication approach:

1. **Middleware Authentication**: Intercepts requests to admin routes and checks authentication
2. **Component Authentication**: Server components verify auth status before rendering
3. **Development Mode Bypass**: Authentication checks are bypassed in development for ease of use

## Authentication Layers

### 1. Edge Middleware

The first layer is implemented in `middleware.ts` using Next.js Edge Middleware:

```typescript
// When a request comes to an admin route
if (pathname.startsWith('/admin')) {
  return await handleAdminRoute(request);
}

// Inside handleAdminRoute
async function handleAdminRoute(request: NextRequest) {
  const { checkAuth, createLoginRedirect, createUnauthorizedRedirect } = 
    await import('./lib/auth-helpers');
  
  // Check authentication
  const authResult = await checkAuth(request);
  
  // If not authenticated, redirect to login
  if (!authResult.authenticated) {
    return createLoginRedirect(request);
  }
  
  // Continue to the requested page
  return NextResponse.next();
}
```

This middleware intercepts all requests to `/admin/*` routes and checks for authentication. If authentication fails, it redirects to the login page.

### 2. Server Component Authentication

The second layer is implemented in `AdminAuthCheck.tsx` as a server component:

```typescript
export async function AdminAuthCheck({
  children
}: {
  children: React.ReactNode
}) {
  // Skip authentication in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('🔓 [AdminAuthCheck] Development mode - bypassing authentication');
    return <>{children}</>;
  }
  
  // Get the user from the cookie
  const cookieStore = cookies();
  const authData = await getAuthUser(cookieStore);

  // Check if user is authenticated
  if (!authData.authenticated) {
    // Redirect to login page
    redirect('/login?error=unauthenticated');
  }

  // Check if user is an admin
  if (!authData.admin) {
    // Redirect to unauthorized page
    redirect('/login?error=unauthorized');
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
```

This component is used in the admin layout and checks authentication before rendering any admin content. It also performs an additional check for admin privileges.

### 3. Firebase Admin Auth Integration

The authentication system uses Firebase Admin SDK for verification in production:

```typescript
export async function verifySessionCookie(sessionCookie: string) {
  if (!auth) {
    throw new Error('Firebase Auth Admin not initialized');
  }
  
  try {
    // Verify the session cookie
    // Set checkRevoked to true to check if the session has been revoked
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    return decodedClaims;
  } catch (error) {
    console.error('Error verifying session cookie:', error);
    throw error;
  }
}

export async function isUserAdmin(uid: string) {
  if (!db) {
    throw new Error('Firebase Firestore Admin not initialized');
  }
  
  try {
    // Check in Firestore for admin status
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data();
    return userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
```

These functions verify the session cookie and check for admin privileges in the Firestore database.

## Development Mode Configuration

In development mode, authentication is bypassed for easier development:

```typescript
// In auth-helpers.ts
export async function checkAuth(request: NextRequest) {
  try {
    // Skip authentication in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('🔓 [Auth] Development mode - bypassing authentication check');
      return { 
        authenticated: true,
        admin: true,
        user: {
          uid: 'dev-admin-uid',
          email: 'dev-admin@example.com'
        }
      };
    }
    
    // Normal authentication flow...
  }
}
```

This bypass is present at both the middleware and component levels to ensure a seamless development experience.

## Visual Development Mode Indicators

To clearly indicate when authentication is bypassed in development, we have added:

1. A yellow banner at the top of the admin interface
2. A development mode indicator in the footer
3. Console logs that show when authentication is bypassed

```typescript
// In admin layout.tsx
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return (
    <AdminAuthCheck>
      <div className="flex min-h-screen flex-col">
        <ClientAdminNavbar />
        
        {isDevelopment && (
          <div className="bg-amber-500 text-amber-950 text-xs text-center py-1">
            Development Mode - Authentication Bypassed
          </div>
        )}

        {/* Main content... */}

        <footer className="border-t bg-muted/50">
          <div className="container py-4 text-center text-xs text-muted-foreground">
            RentalSpot Admin Panel &copy; {new Date().getFullYear()}
            {isDevelopment && (
              <span className="ml-2 text-amber-600 font-medium">Development Mode</span>
            )}
          </div>
        </footer>
      </div>
    </AdminAuthCheck>
  );
}
```

## Production Security Considerations

In production, the following security measures are enforced:

1. **Session Cookie Verification**: All session cookies are verified with Firebase Auth Admin
2. **Admin Role Check**: Users must have an admin role in the Firestore database
3. **Cookie Expiration**: Session cookies expire after their set lifetime
4. **Revocation Check**: Session verification checks if the session has been revoked

## Adding New Admin Users

To add a new admin user to the system:

1. The user must first register and authenticate using the normal authentication flow
2. An existing admin must update the user's document in Firestore:
   ```
   users/{userId}: {
     role: 'admin'
   }
   ```
3. The next time the user logs in, they will have admin privileges

## Troubleshooting

### Authentication Issues

- **Development Mode**: If authentication isn't being bypassed in development, check that `NODE_ENV` is correctly set to 'development'
- **Production Authentication Failures**: Check the server logs for detailed error messages from Firebase Admin
- **Invalid Session Cookies**: Ensure users are properly logging in and that cookies are being set correctly

### Access Control Issues

- **Admin Users Without Access**: Ensure the user has the 'admin' role in Firestore
- **Unexpected Redirects**: Check middleware and component authentication logic for inconsistencies