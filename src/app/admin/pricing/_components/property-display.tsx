'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Define Property interface
interface Property {
  id: string;
  name: string;
  location?: string | any;
  status: string;
  pricePerNight?: number;
  [key: string]: any;
}

interface PropertyDisplayProps {
  properties: Property[];
  selectedPropertyId?: string;
}

/**
 * Client component for property selection
 * 
 * This component handles the UI interaction for selecting a property.
 * It manages the selected property in the URL parameters.
 */
export function PropertyDisplay({
  properties,
  selectedPropertyId
}: PropertyDisplayProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Handle property selection
  const handlePropertyChange = (propertyId: string) => {
    router.push(`${pathname}?propertyId=${propertyId}`);
  };

  // Auto-select first property if none is selected
  if (!selectedPropertyId && properties.length > 0) {
    // This will run on the client
    setTimeout(() => {
      handlePropertyChange(properties[0].id);
    }, 0);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="property-select" className="text-sm font-medium">
            Select Property
          </label>
          
          <Select
            value={selectedPropertyId || ''}
            onValueChange={handlePropertyChange}
            disabled={properties.length === 0}
          >
            <SelectTrigger id="property-select" className="w-full">
              <SelectValue placeholder={
                properties.length === 0
                  ? "No properties available"
                  : "Select a property"
              } />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name} {property.location && typeof property.location === 'string' ? `(${property.location})` : ''}
                </SelectItem>
              ))}
              {properties.length === 0 && (
                <SelectItem value="none" disabled>
                  No properties available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}