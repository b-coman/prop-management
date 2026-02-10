'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function GalleryForm({ content, onChange }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div>
        <Label>Max Images to Display</Label>
        <Input
          type="number"
          min={1}
          max={30}
          value={(content.maxImages as number) || ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
            onChange({ ...content, maxImages: val });
          }}
          placeholder="Show all images (no limit)"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Limits images shown on homepage. Remaining images accessible via &ldquo;View All&rdquo; button.
        </p>
      </div>

      <div>
        <Label>View All URL</Label>
        <Input
          value={(content.viewAllUrl as string) || ''}
          onChange={(e) => onChange({ ...content, viewAllUrl: e.target.value || undefined })}
          placeholder="/gallery"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Link for the &ldquo;View All Photos&rdquo; button. Relative paths are prefixed with the property URL automatically.
        </p>
      </div>

      <MultilingualInput
        label="View All Button Text"
        value={content.viewAllText as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, viewAllText: v })}
      />
    </div>
  );
}
