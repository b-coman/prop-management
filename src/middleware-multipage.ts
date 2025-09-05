// src/middleware-multipage.ts
import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { cert, getApps, initializeApp } from 'firebase-admin/app';

// Create a reusable singleton db connection
let db: FirebaseFirestore.Firestore | null = null;

function getDbAdmin() {
  // Initialize Firebase Admin SDK once if not already initialized
  if (getApps().length === 0) {
    // This is a simplified version - in production, use proper service account setup
    try {
      // Initialize from environment variable in production
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || '{}');
      initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      return null;
    }
  }

  // Get Firestore instance
  if (!db) {
    try {
      db = getFirestore();
    } catch (error) {
      console.error('Failed to get Firestore instance:', error);
      return null;
    }
  }

  return db;
}

// Function to resolve a domain to a property
async function resolveCustomDomain(hostname: string): Promise<string | null> {
  const adminDb = getDbAdmin();
  if (!adminDb) return null;

  try {
    // Query properties collection for a document with matching customDomain
    const propertiesRef = adminDb.collection('properties');
    const querySnapshot = await propertiesRef
      .where('customDomain', '==', hostname)
      .where('useCustomDomain', '==', true)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      return null;
    }

    // Return the slug (document ID) of the first matching property
    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error resolving custom domain:', error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  
  // Skip middleware for localhost and app's main domain
  const mainAppHost = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost';
  if (hostname.includes('localhost') || hostname === mainAppHost) {
    return NextResponse.next();
  }
  
  // Try to resolve the hostname to a property slug
  const propertySlug = await resolveCustomDomain(hostname);
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
  } else if (pathname.startsWith('/details') || 
             pathname.startsWith('/location') || 
             pathname.startsWith('/gallery') || 
             pathname.startsWith('/booking')) {
    // Handle known page types by extracting the first path segment
    const pageType = pathname.split('/')[1];
    url.pathname = `/properties/${propertySlug}/${pageType}`;
  } else {
    // For any other path, maintain it but within the property context
    url.pathname = `/properties/${propertySlug}${pathname}`;
  }
  
  return NextResponse.rewrite(url);
}