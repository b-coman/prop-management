'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Property } from '@/lib/server/pricing-data';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface ClientPropertySelectorProps {
  properties: Property[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Client component for property selection
 * 
 * This component handles the UI interaction for selecting a property.
 * It manages the selected property in the URL parameters.
 */
export function ClientPropertySelector({
  properties,
  isLoading,
  error
}: ClientPropertySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get propertyId from URL query params
  const propertyIdFromUrl = searchParams.get('propertyId');
  
  // Set initial selected property from URL or auto-select first property
  useEffect(() => {
    if (!propertyIdFromUrl && properties.length > 0) {
      // Auto-select the first property
      const newParams = new URLSearchParams(searchParams);
      newParams.set('propertyId', properties[0].id);
      router.replace(`${pathname}?${newParams.toString()}`);
    }
  }, [propertyIdFromUrl, properties, router, pathname, searchParams]);

  // Handle property selection
  const handlePropertyChange = (propertyId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('propertyId', propertyId);
    router.replace(`${pathname}?${newParams.toString()}`);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="property-select" className="text-sm font-medium">
            Select Property
          </label>
          
          <Select
            value={propertyIdFromUrl || ''}
            onValueChange={handlePropertyChange}
            disabled={isLoading || properties.length === 0}
          >
            <SelectTrigger id="property-select" className="w-full">
              <SelectValue placeholder={isLoading ? 'Loading properties...' : 'Select a property'} />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name} {property.location && typeof property.location === 'string' ? `(${property.location})` : ''}
                </SelectItem>
              ))}
              {properties.length === 0 && !isLoading && (
                <SelectItem value="none" disabled>
                  No properties available
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}