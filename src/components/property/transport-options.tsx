// src/components/property/transport-options.tsx
"use client";

import { TransportOptionsBlock } from '@/lib/overridesSchemas-multipage';
import {
  Car, Bus, Train, Plane,
  Bike, User, MapPin, Ship
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';

// Map of icon names to Lucide icon components
const iconMap: Record<string, React.ElementType> = {
  Car, Bus, Train, Plane, Bike, User, MapPin, Ship,
  // Add aliases for icons that might be used in the data
  Walking: User,
  PersonStanding: User,
  Taxi: MapPin,
  Cab: MapPin
};

interface TransportOptionsProps {
  content: TransportOptionsBlock;
}

export function TransportOptions({ content }: TransportOptionsProps) {
  const { title, description, options = [] } = content;
  const { tc } = useLanguage();

  // Function to get an icon component by name
  const getIconByName = (name: string): React.ElementType => {
    return iconMap[name] || Car; // Fallback to Car icon if not found
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-4">{tc(title)}</h2>
          {description && <p className="text-muted-foreground">{tc(description)}</p>}
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {options.map((option, index) => {
            const Icon = getIconByName(option.icon);
            
            return (
              <Card key={index} className="border border-primary/10 hover:border-primary/30 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-full text-primary">
                      <Icon size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mb-2">{tc(option.name)}</h3>
                      <p className="text-sm text-muted-foreground">{tc(option.description)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}