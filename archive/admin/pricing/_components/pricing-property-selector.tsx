'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProperties } from '../actions';

interface Property {
  id: string;
  name: string;
  location: string;
  status: string;
}

interface PricingPropertySelectorProps {
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
}

export default function PricingPropertySelector({
  selectedPropertyId,
  onSelectProperty
}: PricingPropertySelectorProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load properties on component mount
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const result = await getProperties();
        
        if (result.success) {
          setProperties(result.properties);
          
          // Auto-select the first property if none selected
          if (!selectedPropertyId && result.properties.length > 0) {
            onSelectProperty(result.properties[0].id);
          }
        } else {
          setError(result.error || 'Failed to load properties');
        }
      } catch (err) {
        console.error('Error loading properties:', err);
        setError('An unexpected error occurred while loading properties');
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, [selectedPropertyId, onSelectProperty]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <label htmlFor="property-select" className="text-sm font-medium mb-2">
            Select Property
          </label>
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