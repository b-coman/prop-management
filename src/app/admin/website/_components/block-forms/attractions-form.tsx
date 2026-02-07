'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { SortableList } from '../sortable-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function AttractionsForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const attractions = (content.attractions || []) as Array<Record<string, unknown>>;

  const addAttraction = () => {
    onChange({
      ...content,
      attractions: [...attractions, { name: { en: '' }, description: { en: '' }, distance: '', image: '' }],
    });
  };

  const removeAttraction = (i: number) => {
    onChange({ ...content, attractions: attractions.filter((_, idx) => idx !== i) });
  };

  const updateAttraction = (i: number, updates: Record<string, unknown>) => {
    const updated = attractions.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, attractions: updated });
  };

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

      <div className="space-y-4">
        <Label className="text-base font-semibold">Attractions</Label>

        <SortableList
          items={attractions}
          onReorder={(items) => onChange({ ...content, attractions: items })}
          onRemove={removeAttraction}
          onAdd={addAttraction}
          addLabel="Add Attraction"
          renderItem={(attraction, i) => (
            <div className="space-y-4">
              <MultilingualInput
                label="Name"
                value={attraction.name as string | Record<string, string> | undefined}
                onChange={(v) => updateAttraction(i, { name: v })}
              />

              <MultilingualInput
                label="Description"
                value={attraction.description as string | Record<string, string> | undefined}
                onChange={(v) => updateAttraction(i, { description: v })}
                multiline
              />

              <div>
                <Label>Distance</Label>
                <Input
                  value={(attraction.distance as string) || ''}
                  onChange={(e) => updateAttraction(i, { distance: e.target.value })}
                  placeholder="e.g. 5 km, 10 min drive"
                />
              </div>

              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={(attraction.image as string) || ''}
                  onChange={(v) => updateAttraction(i, { image: v })}
                  propertySlug={propertySlug}
                  propertyImages={propertyImages}
                />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
