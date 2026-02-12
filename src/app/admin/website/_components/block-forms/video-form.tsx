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

export function VideoForm({ content, onChange }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div>
        <Label>Video URL</Label>
        <Input
          value={(content.videoUrl as string) || ''}
          onChange={(e) => onChange({ ...content, videoUrl: e.target.value || undefined })}
          placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Paste a YouTube or Vimeo URL. The video will be embedded inline on the page. Leave empty to hide this block.
        </p>
      </div>

      <MultilingualInput
        label="Description"
        value={content.description as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, description: v })}
        multiline
      />
    </div>
  );
}
