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

export function ExperienceForm({ content, onChange }: BlockFormProps) {
  const highlights = (content.highlights || []) as Array<Record<string, unknown>>;

  const addHighlight = () => {
    onChange({
      ...content,
      highlights: [...highlights, { icon: '', title: { en: '' }, description: { en: '' } }],
    });
  };

  const removeHighlight = (i: number) => {
    onChange({ ...content, highlights: highlights.filter((_, idx) => idx !== i) });
  };

  const updateHighlight = (i: number, updates: Record<string, unknown>) => {
    const updated = highlights.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, highlights: updated });
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
        <Label className="text-base font-semibold">Highlights</Label>

        <SortableList
          items={highlights}
          onReorder={(items) => onChange({ ...content, highlights: items })}
          onRemove={removeHighlight}
          onAdd={addHighlight}
          addLabel="Add Highlight"
          renderItem={(highlight, i) => (
            <div className="space-y-4">
              <div>
                <Label>Icon</Label>
                <IconPicker
                  value={(highlight.icon as string) || ''}
                  onChange={(v) => updateHighlight(i, { icon: v })}
                />
              </div>

              <MultilingualInput
                label="Title"
                value={highlight.title as string | Record<string, string> | undefined}
                onChange={(v) => updateHighlight(i, { title: v })}
              />

              <MultilingualInput
                label="Description"
                value={highlight.description as string | Record<string, string> | undefined}
                onChange={(v) => updateHighlight(i, { description: v })}
                multiline
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
