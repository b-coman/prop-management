import type { Property } from '@/types';
import { PropertyCard } from './property-card';

interface PropertyListProps {
  properties: Property[];
}

export function PropertyList({ properties }: PropertyListProps) {
  if (!properties || properties.length === 0) {
    return <p className="text-center text-muted-foreground">No properties found.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}
