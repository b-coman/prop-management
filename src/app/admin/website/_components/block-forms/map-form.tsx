'use client';

import { MultilingualInput } from '../multilingual-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function MapForm({ content, onChange }: BlockFormProps) {
  const coordinates = (content.coordinates || {}) as Record<string, unknown>;

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
        label="Address"
        value={content.address as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, address: v })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={(coordinates.lat as number) ?? ''}
            onChange={(e) =>
              onChange({
                ...content,
                coordinates: { ...coordinates, lat: parseFloat(e.target.value) || 0 },
              })
            }
            placeholder="45.0"
          />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input
            type="number"
            step="any"
            value={(coordinates.lng as number) ?? ''}
            onChange={(e) =>
              onChange({
                ...content,
                coordinates: { ...coordinates, lng: parseFloat(e.target.value) || 0 },
              })
            }
            placeholder="25.0"
          />
        </div>
      </div>

      <div>
        <Label>Zoom Level</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={(content.zoom as number) ?? 14}
          onChange={(e) => onChange({ ...content, zoom: parseInt(e.target.value) || 14 })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Show Directions</Label>
        <Switch
          checked={!!content.showDirections}
          onCheckedChange={(v) => onChange({ ...content, showDirections: v })}
        />
      </div>
    </div>
  );
}
