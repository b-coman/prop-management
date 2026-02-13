'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ContentTopic, ContentDraft } from '@/lib/content-schemas';

function getTitle(title: string | Record<string, string> | undefined): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.en || title.ro || Object.values(title)[0] || '';
}

interface GenerateTabProps {
  propertyId: string;
  topics: ContentTopic[];
  drafts: ContentDraft[];
}

const draftStatusColors: Record<string, string> = {
  'pending-review': 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-blue-100 text-blue-700',
};

export function GenerateTab({ propertyId, topics, drafts }: GenerateTabProps) {
  const publishableTopics = topics.filter((t) => t.status === 'scheduled' || t.status === 'draft');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate Content</CardTitle>
          <CardDescription>
            {publishableTopics.length === 0
              ? 'No topics ready for generation. Create and schedule topics first.'
              : `${publishableTopics.length} topic${publishableTopics.length === 1 ? '' : 's'} ready for generation`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Content generation will be available once the generation engine is implemented.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Drafts</CardTitle>
          <CardDescription>
            {drafts.length === 0
              ? 'No drafts generated yet.'
              : `${drafts.length} draft${drafts.length === 1 ? '' : 's'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Generated drafts will appear here for review before publishing.
            </p>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => {
                const topic = topics.find((t) => t.id === draft.topicId);
                return (
                  <div
                    key={draft.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {getTitle(topic?.title) || draft.topicId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        v{draft.version} — {draft.generationMeta?.model || 'unknown model'}
                        {draft.generationMeta?.generatedAt && ` — ${new Date(draft.generationMeta.generatedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Badge className={draftStatusColors[draft.status] || ''}>
                      {draft.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
