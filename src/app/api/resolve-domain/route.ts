// src/app/api/resolve-domain/route.ts
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property, CurrencyCode } from '@/types'; // Added CurrencyCode

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
  }
  console.log(`[API /resolve-domain] Resolving domain: ${domain}`);

  try {
    const propertiesCollection = collection(db, 'properties');
    const q = query(
      propertiesCollection,
      where('customDomain', '==', domain),
      where('useCustomDomain', '==', true),
      where('status', '==', 'active'), // Ensure property is active
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const propertyDoc = querySnapshot.docs[0];
      const propertyData = propertyDoc.data() as Property;
      console.log(`[API /resolve-domain] Domain ${domain} resolved to property slug: ${propertyDoc.id} (base currency: ${propertyData.baseCurrency})`);
      return NextResponse.json({
        slug: propertyDoc.id, // The document ID is the slug
        name: propertyData.name,
        baseCurrency: propertyData.baseCurrency, // Include base currency
      });
    } else {
      console.log(`[API /resolve-domain] Domain not found or not active: ${domain}`);
      return NextResponse.json({ error: 'Domain not found or not configured for this property' }, { status: 404 });
    }
  } catch (error) {
    console.error(`[API /resolve-domain] Error resolving domain ${domain}:`, error);
    return NextResponse.json({ error: 'Internal server error while resolving domain' }, { status: 500 });
  }
}