// src/app/admin/pricing/page.tsx
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { fetchSeasonalPricing, fetchDateOverrides, fetchLengthOfStayDiscounts } from './server-actions-hybrid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { SeasonalPricingTable } from './_components/seasonal-pricing-table';
import { DateOverridesTable } from './_components/date-overrides-table';
import { PriceCalendarManager } from './_components/price-calendar-manager';
import { PricingTestPanel } from './_components/pricing-test-panel';
import { LengthOfStayDiscounts } from './_components/length-of-stay-discounts';

export const dynamic = 'force-dynamic'; // Ensure the page is dynamically rendered

/**
 * Server-side rendered pricing management page using Client SDK
 * 
 * This matches the pattern used in the coupons section
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Get propertyId from URL query params - handle searchParams as a Promise
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string'
    ? params.propertyId
    : undefined;

  // Fetch seasonal pricing and date overrides if a property is selected
  let seasonalPricing = [];
  let dateOverrides = [];
  let lengthOfStayDiscounts: Awaited<ReturnType<typeof fetchLengthOfStayDiscounts>> = [];

  if (propertyId) {
    // Fetch in parallel
    [seasonalPricing, dateOverrides, lengthOfStayDiscounts] = await Promise.all([
      fetchSeasonalPricing(propertyId),
      fetchDateOverrides(propertyId),
      fetchLengthOfStayDiscounts(propertyId)
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing Management</h1>
          <p className="text-muted-foreground mt-1">Manage seasonal pricing, date overrides, and price calendars</p>
        </div>
        {propertyId && (
          <Button variant="outline" asChild>
            <Link href={`/admin/calendar?propertyId=${propertyId}`}>
              <CalendarDays className="mr-2 h-4 w-4" />
              View Calendar
            </Link>
          </Button>
        )}
      </div>

      <PropertyUrlSync />

      {propertyId ? (
        <Tabs defaultValue="seasons">
          <TabsList>
            <TabsTrigger value="seasons">Seasonal Pricing</TabsTrigger>
            <TabsTrigger value="overrides">Date Overrides</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="calendar">Price Calendar</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
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
                <SeasonalPricingTable
                  seasons={seasonalPricing}
                  propertyId={propertyId}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button asChild>
                  <Link href={`/admin/pricing/seasons/new?propertyId=${propertyId}`}>
                    Add New Season
                  </Link>
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
                <DateOverridesTable
                  overrides={dateOverrides}
                  propertyId={propertyId}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button asChild>
                  <Link href={`/admin/pricing/date-overrides/new?propertyId=${propertyId}`}>
                    Add Date Override
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="discounts">
            <Card>
              <CardHeader>
                <CardTitle>Length-of-Stay Discounts</CardTitle>
                <CardDescription>
                  Offer percentage discounts for longer bookings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LengthOfStayDiscounts
                  discounts={lengthOfStayDiscounts}
                  propertyId={propertyId}
                />
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
                <PriceCalendarManager propertyId={propertyId} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="testing">
            <Card>
              <CardHeader>
                <CardTitle>Pricing & Availability Testing</CardTitle>
                <CardDescription>
                  Test your property's pricing and availability rules with real-time interactive tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PricingTestPanel propertyId={propertyId} />
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