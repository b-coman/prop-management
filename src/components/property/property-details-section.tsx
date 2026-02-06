// src/components/property/property-details-section.tsx
import type { Property } from '@/types';
import { Users, BedDouble, Bath, Home as HomeIcon, Tag } from 'lucide-react';

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  entire_place: 'Entire Place',
  chalet: 'Chalet',
  cabin: 'Cabin',
  villa: 'Villa',
  apartment: 'Apartment',
  house: 'House',
  cottage: 'Cottage',
  studio: 'Studio',
  bungalow: 'Bungalow',
};

const BED_TYPE_LABELS: Record<string, string> = {
  king: 'King',
  queen: 'Queen',
  double: 'Double',
  single: 'Single',
  sofa_bed: 'Sofa Bed',
  bunk: 'Bunk',
  crib: 'Crib',
};

function formatBedSummary(bedConfiguration: Property['bedConfiguration']): string | null {
  if (!bedConfiguration?.length) return null;
  const totals = new Map<string, number>();
  for (const room of bedConfiguration) {
    for (const bed of room.beds) {
      totals.set(bed.type, (totals.get(bed.type) || 0) + bed.count);
    }
  }
  const parts: string[] = [];
  for (const [type, count] of totals) {
    const label = BED_TYPE_LABELS[type] || type;
    parts.push(`${count} ${label}`);
  }
  return parts.join(', ');
}

interface PropertyDetailsSectionProps {
  property: Property;
}

export function PropertyDetailsSection({ property }: PropertyDetailsSectionProps) {
  const bedSummary = formatBedSummary(property.bedConfiguration);

  return (
    <section className="py-8 md:py-12" id="details">
      <div className="container mx-auto px-4">
        <h3 className="text-xl font-semibold mb-4 text-foreground">Key Features</h3>
         {/* Use a fluid grid layout */}
        <div className="grid gap-4 text-sm text-muted-foreground" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {property.propertyType && (
            <div className="flex items-center">
              <Tag className="h-4 w-4 mr-2 text-primary" /> {PROPERTY_TYPE_LABELS[property.propertyType] || property.propertyType}
            </div>
          )}
          {property.maxGuests && (
             <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary" /> Max {property.maxGuests} Guests
             </div>
          )}
           {property.bedrooms && (
              <div className="flex items-center">
                 <BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.bedrooms} Bedroom{property.bedrooms > 1 ? 's' : ''}
              </div>
            )}
             {bedSummary ? (
               <div className="flex items-center">
                 <BedDouble className="h-4 w-4 mr-2 text-primary" /> {bedSummary}
               </div>
             ) : property.beds ? (
                 <div className="flex items-center">
                     <BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.beds} Bed{property.beds > 1 ? 's' : ''}
                 </div>
             ) : null}
             {property.bathrooms && (
                 <div className="flex items-center">
                     <Bath className="h-4 w-4 mr-2 text-primary" /> {property.bathrooms} Bathroom{property.bathrooms > 1 ? 's' : ''}
                 </div>
             )}
           {property.squareFeet && (
               <div className="flex items-center">
                   <HomeIcon className="h-4 w-4 mr-2 text-primary" /> {property.squareFeet} sqm
               </div>
            )}
        </div>
      </div>
    </section>
  );
}
