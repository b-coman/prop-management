'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperties } from '../client-props';

interface PricingPropertySelectorProps {
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
}

export default function ClientPropertySelector({
  selectedPropertyId,
  onSelectProperty
}: PricingPropertySelectorProps) {
  const { properties, loading, error, diagnosticInfo } = useProperties();
  const [showDebug, setShowDebug] = useState(false);
  const [showDetailedDiagnostics, setShowDetailedDiagnostics] = useState(false);

  console.log("Property Selector Rendering:", {
    propertiesCount: properties?.length || 0,
    loading,
    error,
    selectedPropertyId
  });

  // Auto-select the first property if none selected
  useEffect(() => {
    if (!selectedPropertyId && properties.length > 0) {
      console.log('Auto-selecting property:', properties[0].id);
      onSelectProperty(properties[0].id);
    }
  }, [selectedPropertyId, properties, onSelectProperty]);

  // For debugging - create a test property
  const handleCreateTestProperty = () => {
    const testProp = {
      id: 'test-property',
      name: 'Test Property',
      location: 'Test Location',
      status: 'active'
    };
    console.log('Using test property:', testProp);
    onSelectProperty(testProp.id);
  };

  // Check Firestore connection
  const checkFirestoreConnection = () => {
    console.log('🔍 Checking Firestore connection...');

    // Attempt to import and test the Firestore connection
    try {
      import('@/lib/firebase').then(module => {
        console.log('🔍 Firebase module imported:', {
          db: !!module.db,
          auth: !!module.auth,
          app: !!module.app
        });
      }).catch(err => {
        console.error('❌ Firebase import error:', err);
      });
    } catch (err) {
      console.error('❌ Error checking Firestore connection:', err);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="property-select" className="text-sm font-medium">
              Select Property
            </label>
            <div className="flex space-x-2">
              <button
                onClick={checkFirestoreConnection}
                className="text-xs text-green-500 hover:text-green-700"
              >
                Test DB
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {showDebug ? 'Hide' : 'Show'} Debug
              </button>
            </div>
          </div>

          {showDebug && (
            <div className="bg-gray-100 p-3 rounded text-xs mb-3 space-y-2">
              <div className="flex justify-between">
                <p className="font-medium">Debug Information</p>
                <button
                  onClick={() => setShowDetailedDiagnostics(!showDetailedDiagnostics)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {showDetailedDiagnostics ? 'Hide' : 'Show'} Details
                </button>
              </div>

              <div className="space-y-1">
                <p>Properties: <span className="font-medium">{properties.length}</span></p>
                <p>Loading: <span className={loading ? "text-yellow-600 font-medium" : "text-green-600 font-medium"}>{String(loading)}</span></p>
                <p>Error: <span className={error ? "text-red-600 font-medium" : "text-green-600 font-medium"}>{error || 'none'}</span></p>
                <p>Selected: <span className="font-medium">{selectedPropertyId || 'none'}</span></p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleCreateTestProperty}
                  className="px-2 py-1 bg-blue-100 rounded hover:bg-blue-200 text-blue-700"
                >
                  Use Test Property
                </button>
              </div>

              {showDetailedDiagnostics && diagnosticInfo && Object.keys(diagnosticInfo).length > 0 && (
                <div className="mt-3 border-t pt-2 border-gray-200">
                  <p className="font-medium mb-1">Diagnostic Steps:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {diagnosticInfo.steps?.map((step: string, i: number) => (
                      <li key={i} className="text-xs">{step}</li>
                    ))}
                  </ul>

                  {diagnosticInfo.errors?.length > 0 && (
                    <>
                      <p className="font-medium mt-2 mb-1 text-red-600">Errors:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {diagnosticInfo.errors.map((err: any, i: number) => (
                          <li key={i} className="text-xs text-red-600">
                            {typeof err === 'string' ? err : err.message || 'Unknown error'}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {diagnosticInfo.performance && (
                    <p className="mt-2">
                      <span className="font-medium">Query time:</span> {diagnosticInfo.performance.queryTime}
                    </p>
                  )}

                  {diagnosticInfo.firebaseConfig && (
                    <div className="mt-2">
                      <p className="font-medium">Firebase Config:</p>
                      <p>DB Type: {diagnosticInfo.firebaseConfig.dbType}</p>
                      <p>Has Firestore: {String(diagnosticInfo.firebaseConfig.hasFirestore)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Select
            value={selectedPropertyId || ''}
            onValueChange={onSelectProperty}
            disabled={loading || (properties.length === 0 && !showDebug)}
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
              {showDebug && (
                <SelectItem value="test-property">
                  Test Property (Debug)
                </SelectItem>
              )}
              {properties.length === 0 && !loading && !showDebug && (
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