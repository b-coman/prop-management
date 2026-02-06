import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Amenity } from '@/types';

/**
 * Fetches amenity documents from Firestore by their IDs.
 * Used server-side for structured data generation.
 */
export async function getAmenitiesByRefs(amenityRefs: string[]): Promise<Amenity[]> {
  if (!amenityRefs.length) return [];

  const results = await Promise.all(
    amenityRefs.map(async (refId) => {
      try {
        const docSnap = await getDoc(doc(db, 'amenities', refId));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Amenity;
        }
        return null;
      } catch {
        return null;
      }
    })
  );

  return results.filter((a): a is Amenity => a !== null);
}
