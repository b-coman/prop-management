// src/lib/property-utils.ts
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Property, SerializableTimestamp } from '@/types';

/**
 * Retrieves property data by slug from Firestore
 * @param slug The property slug
 * @param serializeTimestamps Whether to serialize timestamps to ISO strings (default true)
 * @returns The property data or null if not found
 */
export async function getPropertyBySlug(
  slug: string, 
  serializeTimestamps: boolean = true
): Promise<Property | null> {
  if (!slug) {
    console.warn("[getPropertyBySlug] Attempted to fetch property with empty slug.");
    return null;
  }
  
  const propertyRef = doc(db, 'properties', slug);
  try {
    const docSnap = await getDoc(propertyRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const property = { id: docSnap.id, slug: docSnap.id, ...data } as Property;
      
      // Serialize timestamps if needed
      return serializeTimestamps ? serializePropertyTimestamps(property) : property;
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

/**
 * Helper function to serialize timestamps in an object for client components
 * @param data The object containing potential timestamp fields
 * @returns A new object with all timestamps serialized to ISO strings
 */
export function serializePropertyTimestamps(property: Property): Property {
  if (!property) return property;
  
  const result = { ...property };
  
  // Helper function to serialize a single timestamp
  const serializeTimestamp = (timestamp: SerializableTimestamp | undefined | null): string | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Timestamp) return timestamp.toDate().toISOString();
    if (timestamp instanceof Date) return timestamp.toISOString();
    if (typeof timestamp === 'string') return timestamp;
    
    // Handle Firestore-like objects with seconds and nanoseconds
    if (typeof timestamp === 'object' && 
        ('seconds' in timestamp || '_seconds' in timestamp) && 
        ('nanoseconds' in timestamp || '_nanoseconds' in timestamp)) {
      try {
        const seconds = Number('seconds' in timestamp ? timestamp.seconds : timestamp._seconds);
        const nanoseconds = Number('nanoseconds' in timestamp ? timestamp.nanoseconds : timestamp._nanoseconds);
        if (!isNaN(seconds) && !isNaN(nanoseconds)) {
          return new Date(seconds * 1000 + nanoseconds / 1000000).toISOString();
        }
      } catch (error) {
        console.error("Error converting timestamp:", error);
        return null;
      }
    }
    
    // Last resort - try as is
    try {
      return new Date(timestamp as any).toISOString();
    } catch (error) {
      console.error("Invalid timestamp format:", timestamp);
      return null;
    }
  };
  
  // Helper function to recursively serialize all timestamps in an object
  const serializeTimestampsInObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // If it's an array, process each element
    if (Array.isArray(obj)) {
      return obj.map(item => serializeTimestampsInObject(item));
    }
    
    // If it's a timestamp-like object
    if (('seconds' in obj || '_seconds' in obj) && 
        ('nanoseconds' in obj || '_nanoseconds' in obj)) {
      return serializeTimestamp(obj);
    }
    
    // Process each property of the object
    const serialized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeTimestampsInObject(value);
    }
    
    return serialized;
  };
  
  // Serialize specific timestamp fields
  if (result.createdAt) result.createdAt = serializeTimestamp(result.createdAt);
  if (result.updatedAt) result.updatedAt = serializeTimestamp(result.updatedAt);
  
  // Handle _translationStatus field if it exists
  if (result._translationStatus) {
    result._translationStatus = serializeTimestampsInObject(result._translationStatus);
  }
  
  return result;
}