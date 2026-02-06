import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyDisplay } from '../pricing/_components/property-display';
import { ExportUrlCard } from './_components/export-url-card';
import { ICalFeedsTable } from './_components/ical-feeds-table';
import { AddFeedDialog } from './_components/add-feed-dialog';
import { fetchProperties, fetchICalFeeds, fetchExportConfig } from './actions';

export const dynamic = 'force-dynamic';

export default async function CalendarSyncPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  const properties = await fetchProperties();

  let feeds: Awaited<ReturnType<typeof fetchICalFeeds>> = [];
  let exportConfig: Awaited<ReturnType<typeof fetchExportConfig>> = {};

  if (propertyId) {
    [feeds, exportConfig] = await Promise.all([
      fetchICalFeeds(propertyId),
      fetchExportConfig(propertyId),
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calendar Sync</h1>
        <p className="text-muted-foreground mt-1">
          Synchronize availability with Booking.com, Airbnb, and other platforms via iCal
        </p>
      </div>

      <Suspense fallback={<div>Loading properties...</div>}>
        <PropertyDisplay properties={properties} selectedPropertyId={propertyId} />
      </Suspense>

      {propertyId ? (
        <Tabs defaultValue="ical-sync">
          <TabsList>
            <TabsTrigger value="ical-sync">iCal Sync</TabsTrigger>
            <TabsTrigger value="calendar-view" disabled>Calendar View (Coming Soon)</TabsTrigger>
          </TabsList>

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
