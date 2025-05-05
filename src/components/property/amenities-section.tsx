// src/components/property/amenities-section.tsx
import type { Property } from '@/types';
import {
  Wifi, ParkingCircle, Tv, Utensils, Wind, Home, CheckCircle, MountainSnow, Trees, Building, Snowflake, Flame, WashingMachine // Changed Fireplace to Flame
} from 'lucide-react'; // Add more icons as needed

interface AmenitiesSectionProps {
  amenities?: string[]; // Pass the amenities array
}

// Map amenity names (lowercase) to icons
const amenityIcons: { [key: string]: React.ReactNode } = {
  wifi: <Wifi className="h-4 w-4 mr-1 text-primary" />,
  kitchen: <Utensils className="h-4 w-4 mr-1 text-primary" />,
  parking: <ParkingCircle className="h-4 w-4 mr-1 text-primary" />,
  tv: <Tv className="h-4 w-4 mr-1 text-primary" />,
  fireplace: <Flame className="h-4 w-4 mr-1 text-primary" />, // Use Flame icon for fireplace
  'mountain view': <MountainSnow className="h-4 w-4 mr-1 text-primary" />,
  garden: <Trees className="h-4 w-4 mr-1 text-primary" />,
  'air conditioning': <Wind className="h-4 w-4 mr-1 text-primary" />,
  'washer/dryer': <WashingMachine className="h-4 w-4 mr-1 text-primary" />, // Use WashingMachine icon
  elevator: <Building className="h-4 w-4 mr-1 text-primary" />,
  heating: <Snowflake className="h-4 w-4 mr-1 text-primary" />, // Example for heating
  // Add more specific mappings
};


export function AmenitiesSection({ amenities }: AmenitiesSectionProps) {
  if (!amenities || amenities.length === 0) {
    return null; // Don't render if no amenities
  }

  return (
    <section className="py-8 md:py-12" id="amenities">
      <div className="container mx-auto px-4">
        <h3 className="text-xl font-semibold mb-4 text-foreground">Amenities</h3>
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm list-none pl-0 text-muted-foreground">
          {amenities.map((amenity) => (
            <li key={amenity} className="flex items-center">
              {/* Find icon based on lowercase amenity name, fallback to CheckCircle */}
              {amenityIcons[amenity.toLowerCase()] || <CheckCircle className="h-4 w-4 mr-1 text-primary" />}
              {amenity}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
