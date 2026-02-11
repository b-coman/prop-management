import Link from 'next/link';
import { Settings2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { ExportUrlCard } from './_components/export-url-card';
import { ICalFeedsTable } from './_components/ical-feeds-table';
import { AddFeedDialog } from './_components/add-feed-dialog';
import { fetchICalFeeds, fetchExportConfig, fetchAvailabilityCalendarData } from './actions';
import { AvailabilityCalendar } from './_components/availability-calendar';
import { format, addMonths } from 'date-fns';
import type { MonthAvailabilityData } from './_lib/availability-types';

export const dynamic = 'force-dynamic';

export default async function CalendarSyncPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let feeds: Awaited<ReturnType<typeof fetchICalFeeds>> = [];
  let exportConfig: Awaited<ReturnType<typeof fetchExportConfig>> = {};
  let initialMonths: MonthAvailabilityData[] = [];

  if (propertyId) {
    const now = new Date();
    const months = [0, 1, 2].map(i => format(addMonths(now, i), 'yyyy-MM'));
    const [feedsResult, exportResult, ...monthResults] = await Promise.all([
      fetchICalFeeds(propertyId),
      fetchExportConfig(propertyId),
      ...months.map(ym => fetchAvailabilityCalendarData(propertyId, ym)),
    ]);
    feeds = feedsResult;
    exportConfig = exportResult;
    initialMonths = monthResults;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar Sync</h1>
          <p className="text-muted-foreground mt-1">
            Synchronize availability with Booking.com, Airbnb, and other platforms via iCal
          </p>
        </div>
        {propertyId && (
          <Button variant="outline" asChild>
            <Link href={`/admin/pricing?propertyId=${propertyId}`}>
              <Settings2 className="mr-2 h-4 w-4" />
              Edit Pricing
            </Link>
          </Button>
        )}
      </div>

      <PropertyUrlSync />

      {propertyId ? (
        <Tabs defaultValue="calendar-view">
          <TabsList>
            <TabsTrigger value="calendar-view">Calendar View</TabsTrigger>
            <TabsTrigger value="ical-sync">iCal Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar-view">
            {initialMonths.length > 0 && (
              <AvailabilityCalendar
                propertyId={propertyId}
                initialMonths={initialMonths}
              />
            )}
          </TabsContent>

          <TabsContent value="ical-sync" className="space-y-6">
            {/* Export Section */}
            <ExportUrlCard
              propertyId={propertyId}
              exportToken={exportConfig.icalExportToken}
              exportEnabled={exportConfig.icalExportEnabled}
            />

            {/* Import Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>External Calendar Feeds</CardTitle>
                    <CardDescription>
                      Import availability from external platforms. Dates booked on other platforms
                      will be automatically blocked here. Syncs every hour.
                    </CardDescription>
                  </div>
                  <AddFeedDialog propertyId={propertyId} />
                </div>
              </CardHeader>
              <CardContent>
                <ICalFeedsTable feeds={feeds} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">
                Please select a property to manage its calendar sync
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
