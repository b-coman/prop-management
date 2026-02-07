'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function CtaForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <MultilingualInput
        label="Description"
        value={content.description as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, description: v })}
        multiline
      />

      <MultilingualInput
        label="Button Text"
        value={content.buttonText as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, buttonText: v })}
      />

      <div>
        <Label>Button URL</Label>
        <Input
          value={(content.buttonUrl as string) || ''}
          onChange={(e) => onChange({ ...content, buttonUrl: e.target.value })}
          placeholder="/booking"
        />
      </div>

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
