import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { IdentityTab } from './_components/identity-tab';
import { TopicsTab } from './_components/topics-tab';
import { DataSourcesTab } from './_components/data-sources-tab';
import { GenerateTab } from './_components/generate-tab';
import { fetchContentBrief, fetchContentTopics, fetchContentDrafts } from './actions';

export const dynamic = 'force-dynamic';

export default async function ContentStrategyPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let brief: Awaited<ReturnType<typeof fetchContentBrief>> = null;
  let topics: Awaited<ReturnType<typeof fetchContentTopics>> = [];
  let drafts: Awaited<ReturnType<typeof fetchContentDrafts>> = [];

  if (propertyId) {
    [brief, topics, drafts] = await Promise.all([
      fetchContentBrief(propertyId),
      fetchContentTopics(propertyId),
      fetchContentDrafts(propertyId),
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Content Strategy</h1>
        <p className="text-muted-foreground mt-1">
          Manage content briefs, topics, and AI-generated drafts
        </p>
      </div>

      <PropertyUrlSync />

      {propertyId ? (
        <Tabs defaultValue="identity">
          <TabsList>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="space-y-4">
            <IdentityTab propertyId={propertyId} brief={brief} />
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <TopicsTab propertyId={propertyId} topics={topics} />
          </TabsContent>

          <TabsContent value="data-sources" className="space-y-4">
            <DataSourcesTab propertyId={propertyId} brief={brief} />
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <GenerateTab propertyId={propertyId} topics={topics} drafts={drafts} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-slate-500">
                Please select a property to manage its content strategy
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
