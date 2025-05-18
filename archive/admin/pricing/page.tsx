'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import PricingPropertySelector from './_components/pricing-property-selector';
import SeasonalPricingTable from './_components/seasonal-pricing-table';
import DateOverridesTable from './_components/date-overrides-table';
import PriceCalendarManager from './_components/price-calendar-manager';
import { generatePriceCalendar } from './actions';

export default function PricingAdminPage() {
  const router = useRouter();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Clear success message after timeout
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage]);

  // Handle manual price calendar generation
  const handleGenerateCalendar = async () => {
    if (!selectedPropertyId) {
      setError('Please select a property first');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generatePriceCalendar(selectedPropertyId);
      if (result.success) {
        setSuccessMessage(`Successfully generated price calendars for ${result.months} months`);
      } else {
        setError(result.error || 'Failed to generate price calendars');
      }
    } catch (err) {
      console.error('Error generating price calendars:', err);
      setError('An unexpected error occurred while generating price calendars');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Pricing Management</h1>
        <Link href="/admin/pricing?server=true" className="text-sm text-blue-600 hover:text-blue-800">
          Try Server-Side Version
        </Link>
      </div>

      <PricingPropertySelector 
        selectedPropertyId={selectedPropertyId} 
        onSelectProperty={setSelectedPropertyId}
      />

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
                <SeasonalPricingTable propertyId={selectedPropertyId} />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button 
                  onClick={() => router.push(`/admin/pricing/seasons/new?propertyId=${selectedPropertyId}`)}
                >
                  Add New Season
                </Button>
              </CardFooter>
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
                <DateOverridesTable propertyId={selectedPropertyId} />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button 
                  onClick={() => router.push(`/admin/pricing/date-overrides/new?propertyId=${selectedPropertyId}`)}
                >
                  Add Date Override
                </Button>
              </CardFooter>
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
                <PriceCalendarManager propertyId={selectedPropertyId} />
                
                <Separator className="my-6" />
                
                <div className="bg-slate-50 p-4 rounded-md">
                  <h3 className="text-lg font-medium mb-2">Manual Calendar Generation</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Generate price calendars for this property for the next 12 months. 
                    This will create or update the pre-calculated price calendars based on
                    current seasonal pricing and date overrides.
                  </p>
                  <Button 
                    onClick={handleGenerateCalendar}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Generating...' : 'Generate Price Calendars'}
                  </Button>
                </div>
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