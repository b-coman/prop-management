# Troubleshooting Guide

This guide covers common issues encountered in the RentalSpot Builder application and their solutions.

## Table of Contents

1. [React Rendering Errors](#react-rendering-errors)
2. [Edge Runtime Compatibility](#edge-runtime-compatibility)
3. [Header Positioning Issues](#header-positioning-issues)
4. [Timestamp Serialization](#timestamp-serialization)
5. [Language Routing Issues](#language-routing-issues)
6. [Theme Application Problems](#theme-application-problems)
7. [WebAssembly Build Errors](#webassembly-build-errors)
8. [Route Handling with Optional Catch-All](#route-handling-with-optional-catch-all)
9. [CSS Layer Conflicts](#css-layer-conflicts)
10. [Performance Issues with Translations](#performance-issues-with-translations)

## React Rendering Errors

### Problem: "Objects are not valid as React child" with tc() function

This error occurs when trying to render the result of the translation function `tc()` directly as a React child.

**Common Scenario:**
```typescript
// ❌ Incorrect - returns an object that React can't render
<p>{tc('error.unauthorized')}</p>
```

**Solution:**
```typescript
// ✅ Correct - convert to string explicitly
<p>{String(tc('error.unauthorized'))}</p>

// ✅ Also correct - use template literal
<p>{`${tc('error.unauthorized')}`}</p>

// ✅ For components expecting strings
<Button>{String(tc('action.save'))}</Button>
```

**Prevention:**
- Always wrap `tc()` calls with `String()` when rendering in JSX
- Create a wrapper component for consistent usage:
```typescript
const T = ({ id }: { id: string }) => <>{String(tc(id))}</>;
// Usage: <T id="error.unauthorized" />
```

## Edge Runtime Compatibility

### Problem: firebase-admin doesn't work with Edge Runtime

Firebase Admin SDK is not compatible with Next.js Edge Runtime due to Node.js dependencies.

**Error:**
```
Module not found: Can't resolve 'fs'
```

**Solution:**

1. **Use Node.js Runtime for Admin Operations:**
```typescript
// app/admin/properties/actions.ts
export const runtime = 'nodejs'; // Force Node.js runtime

import { adminFirestore } from '@/lib/firebaseAdmin';

export async function updateProperty(data: any) {
  // Admin operations work here
  const doc = await adminFirestore
    .collection('properties')
    .doc(data.id)
    .update(data);
}
```

2. **Create Separate Admin Pages:**
```typescript
// app/admin/layout.tsx
export const runtime = 'nodejs'; // Admin routes use Node.js

// app/api/admin/route.ts
export const runtime = 'nodejs'; // Admin API routes too
```

3. **Use Client-Side Firebase for Edge Routes:**
```typescript
// For edge routes, use client SDK instead
import { firestore } from '@/lib/firebase'; // Client SDK

export async function getProperty(id: string) {
  const doc = await firestore
    .collection('properties')
    .doc(id)
    .get();
  return doc.data();
}
```

## Header Positioning Issues

### Problem: Fixed header overlapping content

Fixed or absolute positioned headers can overlap page content.

**Solution:**

1. **Add appropriate padding to main content:**
```css
/* globals.css */
.main-content {
  padding-top: var(--header-height, 80px);
}

/* For responsive headers */
@media (max-width: 768px) {
  .main-content {
    padding-top: var(--mobile-header-height, 60px);
  }
}
```

2. **Use CSS custom properties for dynamic heights:**
```typescript
// components/header.tsx
useEffect(() => {
  const header = document.querySelector('header');
  if (header) {
    document.documentElement.style.setProperty(
      '--header-height',
      `${header.offsetHeight}px`
    );
  }
}, []);
```

3. **Implement scroll-aware header:**
```typescript
const [isScrolled, setIsScrolled] = useState(false);

useEffect(() => {
  const handleScroll = () => {
    setIsScrolled(window.scrollY > 0);
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

return (
  <header className={cn(
    "fixed top-0 z-50 transition-all",
    isScrolled && "shadow-md backdrop-blur"
  )}>
    {/* Header content */}
  </header>
);
```

## Timestamp Serialization

### Problem: Cannot serialize Firestore Timestamp in Server Components

Firestore Timestamps are not serializable when passing from Server to Client Components.

**Solution:**

1. **Convert timestamps to ISO strings:**
```typescript
// server component
export default async function BookingPage() {
  const booking = await getBooking(id);
  
  // Convert timestamp to string
  const serializedBooking = {
    ...booking,
    createdAt: booking.createdAt?.toDate().toISOString(),
    // For optional timestamps
    updatedAt: booking.updatedAt?.toDate().toISOString() || null
  };
  
  return <BookingDetails booking={serializedBooking} />;
}
```

2. **Create a utility function:**
```typescript
// lib/utils.ts
export function serializeTimestamp(timestamp: Timestamp | null): string | null {
  return timestamp ? timestamp.toDate().toISOString() : null;
}

export function serializeDocument<T>(doc: T): T {
  const serialized = { ...doc };
  
  // Handle common timestamp fields
  const timestampFields = ['createdAt', 'updatedAt', 'checkIn', 'checkOut'];
  
  timestampFields.forEach(field => {
    if (serialized[field] && serialized[field].toDate) {
      serialized[field] = serializeTimestamp(serialized[field]);
    }
  });
  
  return serialized;
}
```

3. **Use type guards:**
```typescript
interface SerializedBooking extends Omit<Booking, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string | null;
}

// In component
function parseDate(dateString: string): Date {
  return new Date(dateString);
}
```

## Language Routing Issues

### Problem: Incorrect routing with multilingual paths

Language prefixes in URLs can cause routing issues with dynamic segments.

**Solution:**

1. **Use middleware for language detection:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Handle language prefix
  const supportedLocales = ['en', 'ro', 'fr'];
  const locale = supportedLocales.find(
    loc => pathname.startsWith(`/${loc}/`) || pathname === `/${loc}`
  );
  
  if (!locale && !pathname.startsWith('/api')) {
    // Redirect to default locale
    return NextResponse.redirect(
      new URL(`/en${pathname}`, request.url)
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

2. **Structure routes properly:**
```
app/
  [locale]/
    page.tsx
    properties/
      [slug]/
        page.tsx
    layout.tsx
```

3. **Use proper language links:**
```typescript
// components/LanguageSwitcher.tsx
function LanguageSwitcher({ currentLocale }: { currentLocale: string }) {
  const pathname = usePathname();
  
  const switchLanguage = (newLocale: string) => {
    // Replace locale in path
    const newPath = pathname.replace(
      new RegExp(`^/${currentLocale}`),
      `/${newLocale}`
    );
    
    return newPath;
  };
  
  return (
    <select 
      value={currentLocale}
      onChange={(e) => router.push(switchLanguage(e.target.value))}
    >
      <option value="en">English</option>
      <option value="ro">Română</option>
    </select>
  );
}
```

## Theme Application Problems

### Problem: Theme styles not applying correctly

Themes might not apply due to CSS specificity, loading order, or missing CSS variables.

**Solution:**

1. **Ensure CSS variables are defined:**
```css
/* globals.css */
@layer base {
  :root {
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... other variables */
  }
  
  .dark {
    --primary: 217.2 32.6% 17.5%;
    --primary-foreground: 210 40% 98%;
    /* ... other variables */
  }
}
```

2. **Apply theme class to root:**
```typescript
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        geistSans.variable
      )}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

3. **Use CSS layers for proper specificity:**
```css
/* Use layers to control specificity */
@layer base {
  /* Base theme styles */
}

@layer components {
  /* Component overrides */
}

@layer utilities {
  /* Utility overrides */
}
```

## WebAssembly Build Errors

### Problem: WebAssembly modules cause build errors

Some dependencies might include WebAssembly that doesn't work with certain build configurations.

**Solution:**

1. **Configure webpack to handle WASM:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle WebAssembly
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Exclude problematic modules from server builds
    if (isServer) {
      config.externals = [
        ...config.externals,
        'canvas',
        'jsdom',
      ];
    }
    
    return config;
  },
};
```

2. **Use dynamic imports for WASM modules:**
```typescript
// Lazy load WebAssembly modules
const loadWasmModule = async () => {
  if (typeof window !== 'undefined') {
    const module = await import('wasm-module');
    return module;
  }
  return null;
};
```

3. **Polyfill for Edge Runtime:**
```typescript
// For Edge Runtime compatibility
if (typeof globalThis.WebAssembly === 'undefined') {
  // Provide fallback or throw meaningful error
  console.warn('WebAssembly not available in this environment');
}
```

## Route Handling with Optional Catch-All

### Problem: Optional catch-all routes ([...path]) not matching correctly

Optional catch-all routes can have unexpected behavior with nested paths.

**Solution:**

1. **Structure routes properly:**
```typescript
// app/properties/[slug]/[...path]/page.tsx
export default function PropertySubPage({
  params
}: {
  params: { slug: string; path?: string[] }
}) {
  // Handle both cases
  if (!params.path || params.path.length === 0) {
    // Root property page
    return <PropertyPage slug={params.slug} />;
  }
  
  // Sub-pages
  const subPath = params.path.join('/');
  switch (params.path[0]) {
    case 'gallery':
      return <GalleryPage slug={params.slug} />;
    case 'booking':
      return <BookingPage slug={params.slug} />;
    default:
      notFound();
  }
}
```

2. **Use generateStaticParams correctly:**
```typescript
export async function generateStaticParams() {
  const properties = await getProperties();
  
  // Generate all possible paths
  const paths = [];
  
  for (const property of properties) {
    // Root path
    paths.push({ slug: property.slug, path: [] });
    
    // Sub-paths
    paths.push({ slug: property.slug, path: ['gallery'] });
    paths.push({ slug: property.slug, path: ['booking'] });
  }
  
  return paths;
}
```

## CSS Layer Conflicts

### Problem: Tailwind utilities being overridden by component styles

CSS layer order can cause unexpected style precedence.

**Solution:**

1. **Use proper layer organization:**
```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom layers after Tailwind */
@layer base {
  /* Base overrides */
}

@layer components {
  /* Component styles */
  .btn-primary {
    @apply bg-primary text-primary-foreground;
  }
}

@layer utilities {
  /* Utility overrides - highest specificity */
  .text-gradient {
    @apply bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent;
  }
}
```

2. **Use important modifier when needed:**
```typescript
// For critical overrides
<div className="!bg-primary">
  {/* Content */}
</div>
```

3. **Configure Tailwind important:**
```javascript
// tailwind.config.ts
module.exports = {
  important: '#app', // Scope important to app root
  // or
  important: true, // Make all utilities important
};
```

## Performance Issues with Translations

### Problem: Large translation files causing performance issues

Loading large translation files can impact initial page load.

**Solution:**

1. **Code-split translations by route:**
```typescript
// Split translations by feature
const loadTranslations = async (locale: string, namespace: string) => {
  const translations = await import(`@/locales/${locale}/${namespace}.json`);
  return translations.default;
};

// In page component
export default async function PropertyPage({ params: { locale } }) {
  const propertyTranslations = await loadTranslations(locale, 'property');
  
  return (
    <TranslationProvider 
      translations={propertyTranslations} 
      namespace="property"
    >
      {/* Page content */}
    </TranslationProvider>
  );
}
```

2. **Use dynamic imports:**
```typescript
// Lazy load translations
const [translations, setTranslations] = useState({});

useEffect(() => {
  import(`@/locales/${locale}/common.json`)
    .then(module => setTranslations(module.default));
}, [locale]);
```

3. **Implement translation caching:**
```typescript
// Cache translations in memory
const translationCache = new Map();

export async function getTranslations(locale: string, namespace: string) {
  const cacheKey = `${locale}-${namespace}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  const translations = await loadTranslations(locale, namespace);
  translationCache.set(cacheKey, translations);
  
  return translations;
}
```

4. **Optimize bundle size:**
```typescript
// next.config.ts
module.exports = {
  i18n: {
    locales: ['en', 'ro', 'fr'],
    defaultLocale: 'en',
  },
  // Exclude unused locales from bundle
  webpack: (config) => {
    config.plugins.push(
      new webpack.ContextReplacementPlugin(
        /locales/,
        new RegExp(`(${locales.join('|')})`)
      )
    );
    return config;
  },
};
```

## Debugging Tips

### General Debugging Strategies

1. **Enable verbose logging:**
```typescript
// Add debug logging
const DEBUG = process.env.NODE_ENV === 'development';

export function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
}
```

2. **Use React DevTools:**
- Install React Developer Tools browser extension
- Check component props and state
- Profile performance issues

3. **Next.js debugging:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Next.js Debug",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "env": {
        "NODE_OPTIONS": "--inspect"
      }
    }
  ]
}
```

4. **Check build output:**
```bash
# Analyze bundle size
npm run build
npm run analyze

# Check for errors
npm run lint
npm run type-check
```

## Related Documentation

- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Tailwind CSS Layers](https://tailwindcss.com/docs/adding-custom-styles#using-css-layers)
- [Firebase Admin SDK Guide](https://firebase.google.com/docs/admin/setup)