// src/components/property/property-details-section.tsx
import type { Property } from '@/types';
import { Users, BedDouble, Bath, Home as HomeIcon } from 'lucide-react'; // Renamed Home to HomeIcon

interface PropertyDetailsSectionProps {
  property: Property; // Pass relevant property details
}

export function PropertyDetailsSection({ property }: PropertyDetailsSectionProps) {
  return (
    <section className="py-8 md:py-12" id="details">
      <div className="container mx-auto px-4">
        <h3 className="text-xl font-semibold mb-4 text-foreground">Key Features</h3>
         {/* Use a fluid grid layout */}
        <div className="grid gap-4 text-sm text-muted-foreground" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
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
             {property.beds && (
                 <div className="flex items-center">
                     <BedDouble className="h-4 w-4 mr-2 text-primary" /> {property.beds} Bed{property.beds > 1 ? 's' : ''}
                 </div>
             )}
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
            {/* Add other relevant details here */}
        </div>
      </div>
    </section>
  );
}