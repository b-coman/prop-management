// src/components/property/amenities-list.tsx
"use client";

import { AmenitiesListBlock } from '@/lib/overridesSchemas-multipage';
import {
  Wifi, Tv, Thermometer,
  ParkingSquare, Trees, Flame, ChefHat,
  Utensils, Car, Mountain, Building,
  Coffee, Dumbbell, Gamepad2, Popcorn,
  Baby, PawPrint, Bath, Wind, Droplets,
  Waves, Gem, AirVent, LampDesk
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

// Map of icon names to Lucide icon components
const iconMap: Record<string, React.ElementType> = {
  // Base icons
  Wifi, Tv, Thermometer,
  ParkingSquare, Trees, Flame, ChefHat,
  Utensils, Car, Mountain, Building,
  Coffee, Dumbbell, Gamepad2, Popcorn,
  Baby, PawPrint, Bath, Wind, Droplets,
  Waves, Gem, AirVent, LampDesk,

  // Aliases for common variations
  // Use ShowerHead -> Droplets
  ShowerHead: Droplets,
  // Case variations
  tv: Tv,
  TV: Tv,
  // Common alternate names
  Parking: ParkingSquare,
  AirConditioning: Thermometer,
  AC: Thermometer,
  "Air Conditioning": Thermometer,
  HotWater: Droplets,
  "Hot Water": Droplets,
  Kitchen: ChefHat,
  Gym: Dumbbell,
  Pool: Waves,
  Luxury: Gem,
  "Air Vent": AirVent,
  Lamp: LampDesk
};

interface AmenitiesListProps {
  content: AmenitiesListBlock;
  language?: string;
}

export function AmenitiesList({ content, language = 'en' }: AmenitiesListProps) {
  const { tc, t } = useLanguage();
  
  // Add safety check for missing content
  if (!content) {
    console.warn("AmenitiesList received invalid content");
    return null;
  }

  const { title = t('property.amenities', 'Amenities'), categories = [] } = content;

  // Function to get an icon component by name, with safety checks
  const getIconByName = (name: string): React.ElementType => {
    try {
      // Handle undefined or null values
      if (!name) {
        return Building;
      }

      // Try direct match first
      if (iconMap[name]) {
        return iconMap[name];
      }

      // If not found, try case-insensitive match
      const lowerName = name.toLowerCase();
      const iconKeys = Object.keys(iconMap);
      const matchingKey = iconKeys.find(key => key.toLowerCase() === lowerName);

      if (matchingKey) {
        return iconMap[matchingKey];
      }

      // Check if the name contains common words
      for (const key of iconKeys) {
        if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
          return iconMap[key];
        }
      }

      // If still not found, log warning and return fallback
      console.warn(`Icon not found: ${name}. Using fallback icon.`);
      return Building; // Fallback to Building icon if not found
    } catch (error) {
      console.error(`Error loading icon ${name}:`, error);
      return Building; // Fallback on any error
    }
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>

        <div className="grid md:grid-cols-2 gap-8 mx-auto max-w-5xl">
          {categories && categories.map((category, categoryIndex) => {
            if (!category || !category.name) {
              console.warn("Invalid category data", category);
              return null;
            }

            return (
              <div key={categoryIndex} className="border rounded-lg p-6 bg-card shadow-sm">
                <h3 className="text-xl font-semibold mb-6 text-primary">{tc(category.name)}</h3>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  {category.amenities && category.amenities.map((amenity, amenityIndex) => {
                    if (!amenity || !amenity.name) {
                      console.warn("Invalid amenity data", amenity);
                      return null;
                    }

                    // Safely get the icon
                    const Icon = getIconByName(amenity.icon || "Building");

                    return (
                      <div key={amenityIndex} className="flex items-center gap-3">
                        <div className="text-primary">
                          <Icon size={18} />
                        </div>
                        <span className="text-sm">{tc(amenity.name)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}