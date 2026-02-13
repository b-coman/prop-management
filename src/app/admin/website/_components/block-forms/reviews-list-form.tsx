'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function ReviewsListForm({ content, onChange }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="flex items-center justify-between">
        <Label htmlFor="showAggregateStats">Show aggregate stats</Label>
        <Switch
          id="showAggregateStats"
          checked={content.showAggregateStats !== false}
          onCheckedChange={(v) => onChange({ ...content, showAggregateStats: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="showSourceFilter">Show source filter</Label>
        <Switch
          id="showSourceFilter"
          checked={content.showSourceFilter !== false}
          onCheckedChange={(v) => onChange({ ...content, showSourceFilter: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="showRatingFilter">Show rating filter</Label>
        <Switch
          id="showRatingFilter"
          checked={content.showRatingFilter !== false}
          onCheckedChange={(v) => onChange({ ...content, showRatingFilter: v })}
        />
      </div>

      <div>
        <Label>Reviews per page</Label>
        <Input
          type="number"
          min={5}
          max={50}
          value={(content.reviewsPerPage as number) || 20}
          onChange={(e) => onChange({ ...content, reviewsPerPage: parseInt(e.target.value) || 20 })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Number of reviews to show before &quot;Load more&quot; button.
        </p>
      </div>
    </div>
  );
}
