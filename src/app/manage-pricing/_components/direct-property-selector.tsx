'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDirectProperties } from '../direct-data';

interface DirectPropertySelectorProps {
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
}

export default function DirectPropertySelector({
  selectedPropertyId,
  onSelectProperty
}: DirectPropertySelectorProps) {
  const { properties, loading, error } = useDirectProperties();

  // Auto-select the first property if none selected
  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      console.log('Auto-selecting property:', properties[0].id);
      onSelectProperty(properties[0].id);
    }
  }, [selectedPropertyId, properties, onSelectProperty]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="property-select" className="text-sm font-medium">
              Select Property <span className="text-xs text-blue-500">(Local Data)</span>
            </label>
          </div>
          
          <Select
            value={selectedPropertyId || ''}
            onValueChange={onSelectProperty}
            disabled={loading || properties.length === 0}
          >
            <SelectTrigger id="property-select" className="w-full">
              <SelectValue placeholder={loading ? 'Loading properties...' : 'Select a property'} />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name} {property.location ? `(${property.location})` : ''}
                </SelectItem>
              ))}
              {properties.length === 0 && !loading && (
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