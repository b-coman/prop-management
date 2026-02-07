'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function PageHeaderForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <MultilingualInput
        label="Subtitle"
        value={content.subtitle as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, subtitle: v })}
      />

      <div>
        <Label>Background Image</Label>
        <ImagePicker
          value={content.backgroundImage as string | undefined}
          onChange={(v) => onChange({ ...content, backgroundImage: v })}
          propertySlug={propertySlug}
          propertyImages={propertyImages}
        />
      </div>
    </div>
  );
}
