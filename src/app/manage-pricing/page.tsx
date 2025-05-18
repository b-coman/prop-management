'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import ClientPropertySelector from './_components/client-property-selector';
import ClientSeasonalPricingTable from './_components/client-seasonal-pricing-table';
import ClientDateOverridesTable from './_components/client-date-overrides-table';
import ClientPriceCalendarManager from './_components/client-price-calendar-manager';
import DirectPropertySelector from './_components/direct-property-selector';
import DirectSeasonalPricingTable from './_components/direct-seasonal-pricing-table';
import DirectDateOverridesTable from './_components/direct-date-overrides-table';
import FirebaseDiagnostics from './_components/firebase-diagnostics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// Debug info
console.log('🚀 Manage Pricing Page Component Loading');
try {
  // Force import the Firebase client to check it's working
  import('@/lib/firebase').then(module => {
    console.log('✅ Firebase Client Import Success:', {
      db: !!module.db,
      auth: !!module.auth,
      firestore: typeof module.db?.collection === 'function'
    });

    // Check if we can access the properties collection
    if (module.db) {
      try {
        const propertiesRef = module.db.collection('properties');
        console.log('✅ Properties collection reference created successfully');

        // Attempt to get a document count (limit 1 just to test the query)
        propertiesRef.limit(1).get()
          .then(snap => {
            console.log(`✅ Test query successful: Found ${snap.size} documents`);
          })
          .catch(err => {
            console.error('❌ Test query failed:', err.message);
          });
      } catch (err: any) {
        console.error('❌ Failed to create collection reference:', err.message);
      }
    } else {
      console.error('❌ Firebase db instance is not available');
    }
  }).catch(err => {
    console.error('❌ Firebase Client Import Error:', err);
  });
} catch (err) {
  console.error('❌ Firebase Import Error in page component:', err);
}

export default function ManagePricingPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [useDirectData, setUseDirectData] = useState(false);

  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  // Reset selected property when switching data sources
  useEffect(() => {
    setSelectedPropertyId(null);
  }, [useDirectData]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pricing Management</h1>
      </div>

      {/* Navigation */}
      <div className="flex mb-6 space-x-4">
        <Link href="/pricing-test">
          <Button variant="outline" className="border-blue-300 bg-blue-50">Basic Pricing Test</Button>
        </Link>
        <Link href="/pricing-test/dynamic">
          <Button variant="outline" className="border-green-300 bg-green-50">Dynamic Pricing Test</Button>
        </Link>
        <Link href="/manage-pricing">
          <Button variant="outline" className="border-purple-300 bg-purple-50">Pricing Management</Button>
        </Link>
      </div>

      {/* Data Source Toggle */}
      <div className="flex flex-col space-y-2 mb-4">
        <div className="flex items-center justify-end space-x-2">
          <span className="text-sm font-medium">Firestore Data</span>
          <Switch
            checked={useDirectData}
            onCheckedChange={setUseDirectData}
          />
          <span className="text-sm font-medium">Local Test Data</span>
        </div>

        {!useDirectData && <FirebaseDiagnostics />}
      </div>

      {/* Info notice */}
      <div className={`border rounded-md p-4 mb-6 flex items-start ${useDirectData
        ? "bg-purple-50 border-purple-200"
        : "bg-blue-50 border-blue-200"}`}
      >
        <AlertCircle className={`h-5 w-5 mt-0.5 mr-2 flex-shrink-0 ${useDirectData
          ? "text-purple-500"
          : "text-blue-500"}`}
        />
        <div>
          <h3 className={`font-medium ${useDirectData ? "text-purple-800" : "text-blue-800"}`}>
            {useDirectData ? "Local Test Data Mode" : "Firestore Data Mode"}
          </h3>
          <p className={`text-sm ${useDirectData ? "text-purple-700" : "text-blue-700"}`}>
            {useDirectData
              ? "Using local test data for development. Changes won't be saved to the database."
              : "This page allows you to manage pricing rules using Firestore database. Changes will be persisted."
            }
          </p>
        </div>
      </div>

      {/* Property Selector */}
      {useDirectData
        ? <DirectPropertySelector
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={setSelectedPropertyId}
          />
        : <ClientPropertySelector
            selectedPropertyId={selectedPropertyId}
            onSelectProperty={setSelectedPropertyId}
          />
      }

      {/* Error & Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="bg-green-50 border-green-200 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {selectedPropertyId ? (
        <Tabs defaultValue="seasons">
          <TabsList>
            <TabsTrigger value="seasons">Seasonal Pricing</TabsTrigger>
            <TabsTrigger value="overrides">Date Overrides</TabsTrigger>
            <TabsTrigger value="calendar">Price Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="seasons">
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Pricing</CardTitle>
                <CardDescription>
                  Define seasons with different pricing rules that apply to specific date ranges
                </CardDescription>
              </CardHeader>
              <CardContent>
                {useDirectData
                  ? <DirectSeasonalPricingTable propertyId={selectedPropertyId} />
                  : <ClientSeasonalPricingTable propertyId={selectedPropertyId} />
                }
              </CardContent>
              <CardContent className="flex justify-end">
                {!useDirectData && (
                  <Button
                    onClick={() => window.location.href = `/manage-pricing/seasons/new?propertyId=${selectedPropertyId}`}
                  >
                    Add New Season
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overrides">
            <Card>
              <CardHeader>
                <CardTitle>Date Overrides</CardTitle>
                <CardDescription>
                  Set specific prices for individual dates (holidays, events, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {useDirectData
                  ? <DirectDateOverridesTable propertyId={selectedPropertyId} />
                  : <ClientDateOverridesTable propertyId={selectedPropertyId} />
                }
              </CardContent>
              <CardContent className="flex justify-end">
                {!useDirectData && (
                  <Button
                    onClick={() => window.location.href = `/manage-pricing/date-overrides/new?propertyId=${selectedPropertyId}`}
                  >
                    Add Date Override
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Price Calendar</CardTitle>
                <CardDescription>
                  View and manage pre-calculated price calendars
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!useDirectData && (
                  <ClientPriceCalendarManager propertyId={selectedPropertyId} />
                )}
                {useDirectData && (
                  <div className="py-6 text-center">
                    <p className="text-slate-500 mb-4">
                      Price calendar management is not available in local test data mode
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">
                Please select a property to manage its pricing
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}