'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentBrief } from '@/lib/content-schemas';

interface DataSourcesTabProps {
  propertyId: string;
  brief: ContentBrief | null;
}

const DATA_SOURCES = [
  { key: 'googlePlaces', label: 'Google Places', description: 'Nearby attractions, restaurants, and points of interest' },
  { key: 'weather', label: 'Weather (Visual Crossing)', description: 'Climate data and seasonal weather patterns' },
  { key: 'events8pm', label: '8pm.ro Events', description: 'Upcoming local events, concerts, and shows' },
  { key: 'venues8pm', label: '8pm.ro Venues', description: 'Nearby restaurants, bars, theaters, and cultural venues' },
  { key: 'perplexityResearch', label: 'Perplexity Research', description: 'AI-powered web research for area insights' },
  { key: 'trainSchedule', label: 'Train Schedule', description: 'Train routes and schedules from major cities' },
] as const;

export function DataSourcesTab({ propertyId, brief }: DataSourcesTabProps) {
  const dataSources = brief?.dataSources;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>
            Configure which external data sources are used when generating content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {DATA_SOURCES.map((source) => {
              const config = dataSources?.[source.key as keyof typeof dataSources];
              const enabled = config && 'enabled' in config ? config.enabled : false;

              return (
                <div
                  key={source.key}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{source.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
