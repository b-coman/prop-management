'use client';

import { MultilingualInput } from '../multilingual-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function LocationHighlightsForm({ content, onChange }: BlockFormProps) {
  const mapCenter = (content.mapCenter || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Latitude</Label>
          <Input
            type="number"
            step="any"
            value={(mapCenter.lat as number) ?? ''}
            onChange={(e) =>
              onChange({
                ...content,
                mapCenter: { ...mapCenter, lat: parseFloat(e.target.value) || 0 },
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
            value={(mapCenter.lng as number) ?? ''}
            onChange={(e) =>
              onChange({
                ...content,
                mapCenter: { ...mapCenter, lng: parseFloat(e.target.value) || 0 },
              })
            }
            placeholder="25.0"
          />
        </div>
      </div>
    </div>
  );
}
