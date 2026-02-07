'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { IconPicker } from '../icon-picker';
import { SortableList } from '../sortable-list';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function FeaturesForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const features = (content.features || []) as Array<Record<string, unknown>>;

  const addFeature = () => {
    onChange({
      ...content,
      features: [...features, { icon: '', title: { en: '' }, description: { en: '' }, image: '' }],
    });
  };

  const removeFeature = (i: number) => {
    onChange({ ...content, features: features.filter((_, idx) => idx !== i) });
  };

  const updateFeature = (i: number, updates: Record<string, unknown>) => {
    const updated = features.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, features: updated });
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
        <Label className="text-base font-semibold">Features</Label>

        <SortableList
          items={features}
          onReorder={(items) => onChange({ ...content, features: items })}
          onRemove={removeFeature}
          onAdd={addFeature}
          addLabel="Add Feature"
          renderItem={(feature, i) => (
            <div className="space-y-4">
              <div>
                <Label>Icon</Label>
                <IconPicker
                  value={(feature.icon as string) || ''}
                  onChange={(v) => updateFeature(i, { icon: v })}
                />
              </div>

              <MultilingualInput
                label="Title"
                value={feature.title as string | Record<string, string> | undefined}
                onChange={(v) => updateFeature(i, { title: v })}
              />

              <MultilingualInput
                label="Description"
                value={feature.description as string | Record<string, string> | undefined}
                onChange={(v) => updateFeature(i, { description: v })}
                multiline
              />

              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={(feature.image as string) || ''}
                  onChange={(v) => updateFeature(i, { image: v })}
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
