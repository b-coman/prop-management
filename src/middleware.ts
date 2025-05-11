// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// Edge-compatible domain resolution
// This is a simplified version that uses a map instead of Firestore
// In production, you would use a KV store or similar Edge-compatible storage
const DOMAIN_TO_PROPERTY_MAP: Record<string, string> = {
  // Example mappings - update with real domains
  'mountain-chalet.example.com': 'prahova-mountain-chalet',
  'apartment-bucharest.example.com': 'coltei-apartment-bucharest'
};

export const config = {
  matcher: [
    // Match all paths except for API routes, static files, etc.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';

  // Skip middleware for localhost and app's main domain
  const mainAppHost = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost';
  if (hostname.includes('localhost') || hostname === mainAppHost) {
    return NextResponse.next();
  }

  // Simplified domain resolution without Firestore
  // In production, this would be a call to a compatible data store
  const propertySlug = DOMAIN_TO_PROPERTY_MAP[hostname] || null;

  if (!propertySlug) {
    // If no property found for this domain, continue normally
    return NextResponse.next();
  }

  // Rewrite the URL to the correct property page
  // Handle different path patterns for multi-page structure
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '') {
    // Rewrite to the property homepage
    url.pathname = `/properties/${propertySlug}`;
  } else if (
    pathname.startsWith('/details') ||
    pathname.startsWith('/location') ||
    pathname.startsWith('/gallery') ||
    pathname.startsWith('/booking')
  ) {
    // Handle known page types by extracting the first path segment
    const pageType = pathname.split('/')[1];
    url.pathname = `/properties/${propertySlug}/${pageType}`;
  } else {
    // For any other path, maintain it but within the property context
    url.pathname = `/properties/${propertySlug}${pathname}`;
  }

  return NextResponse.rewrite(url);
}