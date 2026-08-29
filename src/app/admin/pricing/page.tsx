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
import { RateSheetEditor } from './_components/rate-sheet-editor';
import { ParityPanel, type ParityWindow, type ParitySummaryShape } from './_components/parity-panel';
import { PositionView, type PositionRow, type PositionSummaryShape } from './_components/position-view';
import { fetchParityView, fetchPricingPosition } from './parity-actions';
import { getAnchorConfig } from '@/services/anchorConfigService';
import { getPeriods } from '@/services/periodService';
import { DEFAULT_TIER_MULTIPLIERS, datesInRange, type TierMultipliers } from '@/lib/pricing/periods';
import type { AnchoredPeriodInput } from '@/lib/pricing/anchorPricing';
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
  let listingUrls: Record<string, string> = {};
  let channelLabels: Record<string, string> = {};
  let anchorConfig: import('@/lib/pricing/anchorPricing').AnchorConfig | null = null;
  let anchorSaved = false;
  let parity: { ok: boolean; error?: string; windows?: unknown[]; summary?: unknown; meta?: unknown } = { ok: false, error: 'not loaded' };
  let position: { ok: boolean; error?: string; rows?: unknown[]; summary?: unknown; meta?: unknown } = { ok: false, error: 'not loaded' };
  let anchorPeriods: AnchoredPeriodInput[] = [];
  let tierMultipliers: TierMultipliers = DEFAULT_TIER_MULTIPLIERS;
  let netRetention: Record<string, number> = {};
  let directRetention = 1;

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

    // Built from the anchor settings, the way the owner's own sheet is built. Read-only work here;
    // rendering a page never writes.
    // The parity read degrades on its own (it returns {ok:false, error} rather than throwing), so a
    // missing channel config cannot take the whole pricing page down with it.
    const [anchor, periodDocs, parityRes, positionRes] = await Promise.all([
      getAnchorConfig(propertyId),
      getPeriods(propertyId),
      fetchParityView(propertyId),
      fetchPricingPosition(propertyId),
    ]);
    parity = parityRes;
    position = positionRes;
    anchorConfig = {
      anchorChannelId: anchor.anchorChannelId,
      weekdayPrice: anchor.weekdayPrice,
      weekendPrice: anchor.weekendPrice,
      directDiscountPct: anchor.directDiscountPct,
      channels: anchor.channels,
      directRounding: anchor.directRounding,
    };
    anchorSaved = anchor.saved;
    tierMultipliers = (prop as { pricingConfig?: { tierMultipliers?: TierMultipliers } } | null)
      ?.pricingConfig?.tierMultipliers ?? DEFAULT_TIER_MULTIPLIERS;

    const basePrice = (prop as { pricePerNight?: number } | null)?.pricePerNight ?? 0;
    const today = new Date().toISOString().slice(0, 10);
    anchorPeriods = periodDocs
      .filter((p) => p.status === 'active' && p.endDate >= today)
      .map<AnchoredPeriodInput>((p) => ({
        periodId: p.id,
        periodName: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        nights: datesInRange(p.startDate, p.endDate).length,
        tier: p.tier,
        fixedNightPrice: p.fixedNightPrice ?? null,
        // What the booking engine quotes today, so the screen can compare rather than assert.
        currentDirectWeekday: p.fixedNightPrice ?? Math.round(basePrice * (tierMultipliers[p.tier] ?? 1) * 100) / 100,
      }));

    // What reaches the owner from each 1 RON a guest pays, for the "you keep" column.
    directRetention = 1 - (channelSet.byId.get('direct')?.directEconomics?.paymentCostPct ?? 0);
    netRetention = Object.fromEntries(
      [...channelSet.byId.values()]
        .filter((c) => c.economics)
        .map((c) => [c.channelId, (1 - (c.economics!.guestFeePct ?? 0)) * (1 - c.economics!.commissionPct)]),
    );
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

      {/*
        Four tabs, one per QUESTION, instead of six shaped like Firestore collections. Position
        answers "where do I stand"; Prices and channels answers "what do I set, and where"; Rules
        holds the machinery that produces those prices and is rarely opened; Testing stays a tool.
      */}
      {propertyId ? (
        <Tabs defaultValue="position">
          <TabsList>
            <TabsTrigger value="position">Position</TabsTrigger>
            <TabsTrigger value="channels">Prices &amp; channels</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="position" className="space-y-6">
            {position.ok ? (
              <PositionView
                rows={position.rows as PositionRow[]}
                summary={position.summary as PositionSummaryShape}
                meta={position.meta as { generatedAt: string; parityAvailable: boolean; parityError: string | null; measuredWindows: number }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Your position</CardTitle>
                  <CardDescription>Could not be built: {position.error}</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>

          {/*
            The machinery that PRODUCES the prices on the other tabs — periods and seasons, hand-set
            overrides, the length-of-stay ladder, the generated calendar. Nested under one tab because
            "how is this price computed" is a far rarer question than "where do I stand".
          */}
          <TabsContent value="rules">
            <Tabs defaultValue="seasons">
              <TabsList>
                <TabsTrigger value="seasons">Seasonal Pricing</TabsTrigger>
                <TabsTrigger value="overrides">Date Overrides</TabsTrigger>
                <TabsTrigger value="discounts">Discounts</TabsTrigger>
                <TabsTrigger value="calendar">Price Calendar</TabsTrigger>
              </TabsList>
              <div className="mt-4">
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
              </div>
            </Tabs>
          </TabsContent>

          <TabsContent value="channels" className="space-y-6">
            {parity.ok ? (
              <ParityPanel
                windows={parity.windows as ParityWindow[]}
                summary={parity.summary as ParitySummaryShape}
                meta={parity.meta as { generatedAt: string; excluded: string[]; targetDiscountPct: number }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Where you sit against the OTAs</CardTitle>
                  <CardDescription>
                    No parity reading available: {parity.error}. Nothing is assumed — a verdict computed
                    against a guessed commission looks authoritative and is wrong in a direction you cannot see.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
            <ChannelsCard rows={channelRows} propertyId={propertyId} />
            {anchorConfig && (
              <RateSheetEditor
                propertyId={propertyId}
                initialConfig={anchorConfig}
                configSaved={anchorSaved}
                periods={anchorPeriods}
                tierMultipliers={tierMultipliers}
                channelLabels={channelLabels}
                listingUrls={listingUrls}
                netRetention={netRetention}
                directRetention={directRetention}
              />
            )}
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