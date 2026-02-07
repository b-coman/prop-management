'use client';

import { MultilingualInput } from '../multilingual-input';
import { IconPicker } from '../icon-picker';
import { SortableList } from '../sortable-list';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function TransportForm({ content, onChange }: BlockFormProps) {
  const options = (content.options || []) as Array<Record<string, unknown>>;

  const addOption = () => {
    onChange({
      ...content,
      options: [...options, { icon: '', name: { en: '' }, description: { en: '' } }],
    });
  };

  const removeOption = (i: number) => {
    onChange({ ...content, options: options.filter((_, idx) => idx !== i) });
  };

  const updateOption = (i: number, updates: Record<string, unknown>) => {
    const updated = options.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, options: updated });
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
        <Label className="text-base font-semibold">Transport Options</Label>

        <SortableList
          items={options}
          onReorder={(items) => onChange({ ...content, options: items })}
          onRemove={removeOption}
          onAdd={addOption}
          addLabel="Add Option"
          renderItem={(option, i) => (
            <div className="space-y-4">
              <div>
                <Label>Icon</Label>
                <IconPicker
                  value={(option.icon as string) || ''}
                  onChange={(v) => updateOption(i, { icon: v })}
                />
              </div>

              <MultilingualInput
                label="Name"
                value={option.name as string | Record<string, string> | undefined}
                onChange={(v) => updateOption(i, { name: v })}
              />

              <MultilingualInput
                label="Description"
                value={option.description as string | Record<string, string> | undefined}
                onChange={(v) => updateOption(i, { description: v })}
                multiline
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
