// src/app/admin/pricing/page.tsx
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { fetchSeasonalPricing, fetchDateOverrides, fetchLengthOfStayDiscounts, fetchProperty } from './server-actions-hybrid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { SeasonalPricingTable } from './_components/seasonal-pricing-table';
import { DateOverridesTable } from './_components/date-overrides-table';
import { PriceCalendarManager } from './_components/price-calendar-manager';
import { PricingTestPanel } from './_components/pricing-test-panel';
import { LengthOfStayDiscounts } from './_components/length-of-stay-discounts';
import { ChannelsCard, type ChannelRow } from './_components/channels-card';
import { RateSheetGrid, type RateSheetGridRow } from './_components/rate-sheet-grid';
import { generateRateSheet, getPushes } from '@/services/rateSheetService';
import { pushId } from '@/lib/pricing/rateSheet';
import { getChannels } from '@/services/channelService';
import { headroomPct } from '@/lib/growth/parityMath';
import { CHANNEL_IDS } from '@/lib/channels';

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
  // The calendar renders money; without this it fell back to formatPrice's USD default and showed
  // RON amounts as "$523".
  let currency = 'RON';
  let channelRows: ChannelRow[] = [];
  let sheetRows: RateSheetGridRow[] = [];
  let sheetChannelIds: string[] = [];
  let sheetVersion: number | null = null;
  let sheetComputedAt: string | null = null;
  let sheetWarnings: string[] = [];
  let listingUrls: Record<string, string> = {};
  let channelLabels: Record<string, string> = {};

  if (propertyId) {
    // Fetch in parallel
    const [sp, dov, losd, prop, channelSet] = await Promise.all([
      fetchSeasonalPricing(propertyId),
      fetchDateOverrides(propertyId),
      fetchLengthOfStayDiscounts(propertyId),
      fetchProperty(propertyId),
      getChannels(propertyId),
    ]);
    seasonalPricing = sp;
    dateOverrides = dov;
    lengthOfStayDiscounts = losd;
    currency = (prop as { baseCurrency?: string } | null)?.baseCurrency ?? 'RON';

    // Mapped to a plain shape here: ChannelConfig carries a Firestore Timestamp (`updatedAt`) that
    // does not survive the server/client boundary, and headroom needs the direct economics to compute.
    const directEcon = channelSet.byId.get('direct')?.directEconomics ?? null;
    channelRows = CHANNEL_IDS
      .map((id) => channelSet.byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        channelId: c.channelId,
        displayName: c.displayName,
        active: c.active,
        inactiveReason: c.inactiveReason ?? undefined,
        commissionPct: c.economics?.commissionPct ?? null,
        headroomPct: c.economics && directEcon ? Number(headroomPct(c.economics, directEcon).toFixed(4)) : null,
        paymentCostPct: c.directEconomics?.paymentCostPct ?? null,
        targetDirectDiscountPct: c.targetDirectDiscountPct ?? null,
        listingUrl: c.listingUrl ?? undefined,
      }));
    channelLabels = Object.fromEntries(channelRows.map((c) => [c.channelId, c.displayName]));
    listingUrls = Object.fromEntries(channelRows.filter((c) => c.listingUrl).map((c) => [c.channelId, c.listingUrl!]));

    // Computed live rather than read from the last stored sheet, so the grid always reflects current
    // periods and rates. Nothing is written by rendering a page — `write` is deliberately absent.
    try {
      const [{ sheet, skippedChannels }, pushes] = await Promise.all([
        generateRateSheet(propertyId, {
          computedAt: new Date().toISOString(),
          from: new Date().toISOString().slice(0, 10),
        }),
        getPushes(propertyId),
      ]);
      const pushById = new Map(pushes.map((p) => [p.id, p]));
      sheetVersion = sheet.version;
      sheetComputedAt = sheet.computedAt;
      sheetWarnings = [
        ...sheet.warnings,
        ...skippedChannels.map((c) => `${c}: no commission recorded, so it is not priced here.`),
        ...[...new Set(sheet.rows.filter((r) => r.problem).map((r) => `${r.channelId}: ${r.problem}`))],
      ];
      sheetChannelIds = [...new Set(sheet.rows.map((r) => r.channelId))].filter((c) => c !== 'direct');
      const byPeriod = new Map<string, typeof sheet.rows>();
      sheet.rows.forEach((r) => byPeriod.set(r.periodId, [...(byPeriod.get(r.periodId) ?? []), r]));
      sheetRows = [...byPeriod.entries()].map(([periodId, rs]) => {
        const first = rs[0];
        return {
          periodId,
          periodName: first.periodName,
          startDate: first.startDate,
          endDate: first.endDate,
          nights: first.nights,
          directNightly: first.directNightly,
          cells: rs.filter((r) => r.channelId !== 'direct').map((r) => ({
            channelId: r.channelId,
            nightly: r.nightly,
            currency: r.currency,
            status: (pushById.get(pushId(propertyId, r.channelId, r.periodId))?.status ?? 'none') as RateSheetGridRow['cells'][number]['status'],
            problem: r.problem,
          })),
        };
      }).sort((a, b) => a.startDate.localeCompare(b.startDate));
    } catch (e) {
      // A property with no channels configured cannot have a rate sheet. That is a normal state, not
      // an error worth blanking the whole pricing admin for.
      sheetWarnings = [(e as Error).message];
    }
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
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-6">
            <ChannelsCard rows={channelRows} propertyId={propertyId} />
            <RateSheetGrid
              rows={sheetRows}
              channelIds={sheetChannelIds}
              channelLabels={channelLabels}
              listingUrls={listingUrls}
              version={sheetVersion}
              computedAt={sheetComputedAt}
              warnings={sheetWarnings}
            />
          </TabsContent>

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
                <PriceCalendarManager propertyId={propertyId} currency={currency} />
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