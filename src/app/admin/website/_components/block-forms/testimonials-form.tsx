'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function TestimonialsForm({ content, onChange }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="flex items-center justify-between">
        <Label>Show Rating</Label>
        <Switch
          checked={!!content.showRating}
          onCheckedChange={(v) => onChange({ ...content, showRating: v })}
        />
      </div>
    </div>
  );
}
