import { useEffect, useState } from 'react';
import { collection, getDocs, where, query, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLanguage } from '@/hooks/useLanguage';
import { Card } from '@/components/ui/card';

interface Amenity {
  id: string;
  name: { en: string; ro: string };
  icon: string;
  category?: { en: string; ro: string };
}

interface AmenitiesFromReferencesProps {
  amenityIds: string[];
}

export function AmenitiesFromReferences({ amenityIds }: AmenitiesFromReferencesProps) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const { tc } = useLanguage();

  useEffect(() => {
    async function fetchAmenities() {
      if (!amenityIds || amenityIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        // Fetch amenities in batches (Firestore limit is 10 for 'in' queries)
        const batchSize = 10;
        const allAmenities: Amenity[] = [];

        for (let i = 0; i < amenityIds.length; i += batchSize) {
          const batch = amenityIds.slice(i, i + batchSize);
          const q = query(
            collection(db, 'amenities'),
            where(documentId(), 'in', batch)
          );
          
          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
            allAmenities.push({ id: doc.id, ...doc.data() } as Amenity);
          });
        }

        setAmenities(allAmenities);
      } catch (error) {
        console.error('Error fetching amenities:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAmenities();
  }, [amenityIds]);

  if (loading) return <div>Loading amenities...</div>;
  if (amenities.length === 0) return null;

  // Group amenities by category
  const groupedAmenities = amenities.reduce((acc, amenity) => {
    const category = amenity.category ? tc(amenity.category) : 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(amenity);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedAmenities).map(([category, categoryAmenities]) => (
        <Card key={category} className="p-6">
          <h3 className="text-lg font-semibold mb-4">{category}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categoryAmenities.map(amenity => (
              <div key={amenity.id} className="flex items-center space-x-3">
                <span className="text-2xl">{amenity.icon}</span>
                <span>{tc(amenity.name)}</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}