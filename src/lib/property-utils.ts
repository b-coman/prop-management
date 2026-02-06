// src/lib/property-utils.ts
import { doc, getDoc, collection, query, where, getCountFromServer, Timestamp } from 'firebase/firestore';
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
    location: { city: 'Demo City', country: 'Demo Country' },
    pricePerNight: 150,
    baseOccupancy: 2,
    defaultMinimumStay: 2,
    templateId: 'default'
  } as unknown as Property;
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
  if (result.createdAt) result.createdAt = serializeTimestamp(result.createdAt) || undefined;
  if (result.updatedAt) result.updatedAt = serializeTimestamp(result.updatedAt) || undefined;
  
  // Handle _translationStatus field if it exists
  if ((result as any)._translationStatus) {
    (result as any)._translationStatus = serializeTimestampsInObject((result as any)._translationStatus);
  }
  
  return result;
}

/**
 * Retrieves hero image path from property overrides with enhanced path checking
 * @param slug The property slug
 * @param debugMode Enable additional debug logging
 * @returns The hero image path or null if not found
 */
export async function getPropertyHeroImage(slug: string, debugMode = false): Promise<string | null> {
  if (!slug) return null;
  
  try {
    // First try to get the hero image from propertyOverrides
    const overridesRef = doc(db, 'propertyOverrides', slug);
    const docSnap = await getDoc(overridesRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      if (debugMode) {
        console.log(`[PropertyUtils:DEBUG] Override document structure for ${slug}:`, 
          JSON.stringify({
            hasHomepage: !!data.homepage,
            hasHero: !!data.hero,
            topLevelKeys: Object.keys(data)
          })
        );
      }
      
      // All possible paths based on documentation and different formats
      const possiblePaths = [
        // Standard multipage architecture path
        data?.homepage?.hero?.backgroundImage,
        
        // Alternative paths
        data?.homepage?.hero?.imageUrl,
        data?.homepage?.hero?.image?.url,
        data?.homepage?.backgroundImage,
        
        // Legacy / alternative structure paths
        data?.hero?.backgroundImage,
        data?.hero?.imageUrl,
        data?.hero?.image?.url,
        
        // Direct paths
        data?.heroImage,
        data?.backgroundImage,
        data?.featuredImage
      ];
      
      // Find the first non-null path
      for (const path of possiblePaths) {
        if (path) {
          if (debugMode) {
            console.log(`[PropertyUtils:DEBUG] Found hero image for ${slug}:`, path);
          }
          return path;
        }
      }
      
      if (debugMode) {
        console.warn(`[PropertyUtils:DEBUG] No hero image found in propertyOverrides. Checking property document.`);
      }
    } else if (debugMode) {
      console.warn(`[PropertyUtils:DEBUG] No propertyOverrides document found for ${slug}`);
    }
    
    // If we can't find the hero image in overrides, try to get from the property
    const propertyRef = doc(db, 'properties', slug);
    const propertySnap = await getDoc(propertyRef);
    
    if (propertySnap.exists()) {
      const propertyData = propertySnap.data();
      
      if (debugMode) {
        console.log(`[PropertyUtils:DEBUG] Property document structure for ${slug}:`, 
          JSON.stringify({
            hasImages: !!propertyData.images && Array.isArray(propertyData.images),
            imageCount: propertyData.images?.length || 0,
            hasHeroImage: !!propertyData.heroImage
          })
        );
      }
      
      // Check for heroImage field first
      if (propertyData.heroImage) {
        const heroImage = propertyData.heroImage;
        if (typeof heroImage === 'string') {
          return heroImage;
        } else if (typeof heroImage === 'object' && heroImage !== null && 'url' in heroImage) {
          return heroImage.url;
        }
      }
      
      // Try to get the first image from the property's images array
      if (propertyData.images && Array.isArray(propertyData.images) && propertyData.images.length > 0) {
        const firstImage = propertyData.images[0];
        
        // Image can be a string or an object with a url property
        if (typeof firstImage === 'string') {
          return firstImage;
        } else if (typeof firstImage === 'object' && firstImage !== null && 'url' in firstImage) {
          return firstImage.url;
        }
      }
    } else if (debugMode) {
      console.warn(`[PropertyUtils:DEBUG] No property document found for ${slug}`);
    }
    
    // If all else fails, return null
    console.warn(`[PropertyUtils] No hero image found for ${slug}`);
    return null;
  } catch (error) {
    console.error(`[PropertyUtils] Error fetching property hero image for ${slug}:`, error);
    return null;
  }
}

/**
 * Counts published reviews for a property from the reviews collection.
 * Used to guard aggregateRating in JSON-LD structured data.
 */
export async function getPublishedReviewCount(propertySlug: string): Promise<number> {
  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('propertyId', '==', propertySlug),
      where('isPublished', '==', true)
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    return 0;
  }
}