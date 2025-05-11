// src/lib/property-utils.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property } from '@/types';

/**
 * Retrieves property data by slug from Firestore
 * @param slug The property slug
 * @returns The property data or null if not found
 */
export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  if (!slug) {
    console.warn("[getPropertyBySlug] Attempted to fetch property with empty slug.");
    return null;
  }
  
  const propertyRef = doc(db, 'properties', slug);
  try {
    const docSnap = await getDoc(propertyRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return { id: docSnap.id, slug: docSnap.id, ...data } as Property;
    } else {
      console.warn(`[getPropertyBySlug] Property document not found: properties/${slug}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching property with slug ${slug}:`, error);
    return null;
  }
}

/**
 * Gets a property with default data if the real property can't be found
 * Useful for previews or development
 */
export async function getPropertyWithDefaults(slug: string): Promise<Property> {
  const property = await getPropertyBySlug(slug);
  
  if (property) {
    return property;
  }
  
  // Return a default property if not found
  return {
    id: slug,
    slug: slug,
    name: 'Demo Property',
    description: 'This is a demo property for development purposes.',
    baseCurrency: 'EUR',
    baseRate: 150,
    advertisedRate: 150,
    advertisedRateType: "from",
    minNights: 2,
    maxNights: 14,
    maxGuests: 6,
    bedrooms: 2,
    bathrooms: 1,
    beds: 3,
    // Add other required properties
  } as Property;
}