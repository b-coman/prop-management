'use client';

import { MultilingualInput } from '../multilingual-input';
import { SortableList } from '../sortable-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function DistancesForm({ content, onChange }: BlockFormProps) {
  const distances = (content.distances || []) as Array<Record<string, unknown>>;

  const addDistance = () => {
    onChange({
      ...content,
      distances: [...distances, { place: '', distance: '', time: '' }],
    });
  };

  const removeDistance = (i: number) => {
    onChange({ ...content, distances: distances.filter((_, idx) => idx !== i) });
  };

  const updateDistance = (i: number, updates: Record<string, unknown>) => {
    const updated = distances.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, distances: updated });
  };

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Distances</Label>

        <SortableList
          items={distances}
          onReorder={(items) => onChange({ ...content, distances: items })}
          onRemove={removeDistance}
          onAdd={addDistance}
          addLabel="Add Distance"
          renderItem={(dist, i) => (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Place</Label>
                <Input
                  value={(dist.place as string) || ''}
                  onChange={(e) => updateDistance(i, { place: e.target.value })}
                  placeholder="e.g. Bucharest Airport"
                />
              </div>
              <div>
                <Label>Distance</Label>
                <Input
                  value={(dist.distance as string) || ''}
                  onChange={(e) => updateDistance(i, { distance: e.target.value })}
                  placeholder="e.g. 150 km"
                />
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  value={(dist.time as string) || ''}
                  onChange={(e) => updateDistance(i, { time: e.target.value })}
                  placeholder="e.g. 2h 30min"
                />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
