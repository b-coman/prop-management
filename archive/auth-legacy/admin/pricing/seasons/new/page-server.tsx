import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ServerSeasonalPricingForm } from './_components/server-seasonal-pricing-form';

/**
 * Server component for adding new seasonal pricing
 */
export default async function NewSeasonalPricingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Get propertyId from URL query params
  const propertyId = 
    typeof searchParams.propertyId === 'string' ? searchParams.propertyId : undefined;
  
  if (!propertyId) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <h2 className="text-lg font-medium text-red-600 mb-2">Missing Property ID</h2>
              <p className="text-slate-600 mb-4">
                A property ID is required to create seasonal pricing.
              </p>
              <Button asChild variant="outline">
                <Link href="/admin/pricing">Return to Pricing Management</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Add Seasonal Pricing</h1>
        <Button asChild variant="outline">
          <Link href={`/admin/pricing?propertyId=${propertyId}&server=true`}>
            Cancel
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Seasonal Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading form...</div>}>
            <ServerSeasonalPricingForm propertyId={propertyId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}