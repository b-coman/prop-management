'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ContentTopic } from '@/lib/content-schemas';

function getTitle(title: string | Record<string, string> | undefined): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.en || title.ro || Object.values(title)[0] || '';
}

interface TopicsTabProps {
  propertyId: string;
  topics: ContentTopic[];
}

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-100 text-blue-700',
  generating: 'bg-yellow-100 text-yellow-700',
  review: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

export function TopicsTab({ propertyId, topics }: TopicsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Content Topics</CardTitle>
          <CardDescription>
            {topics.length === 0
              ? 'No topics defined yet. Create topics to start generating content.'
              : `${topics.length} topic${topics.length === 1 ? '' : 's'} configured`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Topics define what content to generate — seasonal guides, evergreen articles, event roundups, etc.
            </p>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {getTitle(topic.title) || topic.slug}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-xs">
                        {topic.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {topic.priority}
                      </Badge>
                    </div>
                  </div>
                  <Badge className={statusColors[topic.status] || ''}>
                    {topic.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
