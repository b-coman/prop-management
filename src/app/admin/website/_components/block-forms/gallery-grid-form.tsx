'use client';

import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function GalleryGridForm({ content, onChange }: BlockFormProps) {
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

      <div>
        <Label>Layout</Label>
        <Select
          value={(content.layout as string) || 'grid'}
          onValueChange={(v) => onChange({ ...content, layout: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="masonry">Masonry</SelectItem>
            <SelectItem value="slider">Slider</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Enable Lightbox</Label>
        <Switch
          checked={!!content.enableLightbox}
          onCheckedChange={(v) => onChange({ ...content, enableLightbox: v })}
        />
      </div>
    </div>
  );
}
