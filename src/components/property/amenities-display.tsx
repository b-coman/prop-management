import { useEffect, useState } from 'react';
import { collection, getDocs, where, query, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLanguage } from '@/hooks/useLanguage';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import * as Icons from 'lucide-react';

interface Amenity {
  id: string;
  name: { en: string; ro: string };
  icon: string;
  category?: { en: string; ro: string };
}

interface AmenityCategory {
  name: { en: string; ro: string };
  amenityRefs: string[];
}

interface AmenitiesDisplayProps {
  categories?: AmenityCategory[];
  amenityIds?: string[]; // For simple list
  title?: { en: string; ro: string };
  className?: string;
}

export function AmenitiesDisplay({ 
  categories, 
  amenityIds, 
  title,
  className 
}: AmenitiesDisplayProps) {
  const [amenities, setAmenities] = useState<Map<string, Amenity>>(new Map());
  const [loading, setLoading] = useState(true);
  const { tc } = useLanguage();

  // Collect all amenity IDs
  const allAmenityIds = categories 
    ? categories.flatMap(cat => cat.amenityRefs)
    : amenityIds || [];

  useEffect(() => {
    async function fetchAmenities() {
      if (allAmenityIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const amenitiesMap = new Map<string, Amenity>();
        
        // Fetch amenities in batches (Firestore limit is 10 for 'in' queries)
        const batchSize = 10;
        for (let i = 0; i < allAmenityIds.length; i += batchSize) {
          const batch = allAmenityIds.slice(i, i + batchSize);
          const q = query(
            collection(db, 'amenities'),
            where(documentId(), 'in', batch)
          );
          
          const snapshot = await getDocs(q);
          snapshot.forEach(doc => {
            amenitiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Amenity);
          });
        }

        setAmenities(amenitiesMap);
      } catch (error) {
        console.error('Error fetching amenities:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAmenities();
  }, [allAmenityIds.join(',')]);

  if (loading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (amenities.size === 0) return null;

  // Render icon
  const renderIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName];
    if (IconComponent) {
      return <IconComponent className="w-5 h-5" />;
    }
    return <Icons.Home className="w-5 h-5" />;
  };

  // Render by categories
  if (categories) {
    return (
      <div className={cn("space-y-6", className)}>
        {title && (
          <h2 className="text-2xl font-semibold">{tc(title)}</h2>
        )}
        
        {categories.map((category, index) => {
          const categoryAmenities = category.amenityRefs
            .map(ref => amenities.get(ref))
            .filter(Boolean) as Amenity[];

          if (categoryAmenities.length === 0) return null;

          return (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{tc(category.name)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryAmenities.map(amenity => (
                    <div key={amenity.id} className="flex items-center space-x-3">
                      {renderIcon(amenity.icon)}
                      <span className="text-sm">{tc(amenity.name)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Render simple list
  const simpleAmenities = allAmenityIds
    .map(id => amenities.get(id))
    .filter(Boolean) as Amenity[];

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle>{tc(title)}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {simpleAmenities.map(amenity => (
            <div key={amenity.id} className="flex items-center space-x-2">
              {renderIcon(amenity.icon)}
              <span className="text-sm">{tc(amenity.name)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}