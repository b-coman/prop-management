'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientPropertySelector } from './client-property-selector';
import { getAdminProperties } from '@/lib/firebaseClientAdmin';

/**
 * Client component that loads properties from Firestore
 * and displays the property selector
 */
export function ClientPropertySelectorLoader() {
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadProperties = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const propertiesData = await getAdminProperties();
        console.log(`[Client] Fetched ${propertiesData.length} properties`);
        
        setProperties(propertiesData);
      } catch (err) {
        console.error('[Client] Error fetching properties:', err);
        setError('Failed to fetch properties');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProperties();
  }, []);
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <p className="text-slate-500">Loading properties...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Properties Found</AlertTitle>
            <AlertDescription>
              No properties found in the database. Please ensure you have at least one property created.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <ClientPropertySelector
      properties={properties}
      isLoading={isLoading}
      error={error}
    />
  );
}