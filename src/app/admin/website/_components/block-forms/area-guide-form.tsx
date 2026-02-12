'use client';

import { MultilingualInput } from '../multilingual-input';
import { ImagePicker } from '../image-picker';
import { SortableList } from '../sortable-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function AreaGuideForm({ content, onChange, propertySlug, propertyImages }: BlockFormProps) {
  const sections = (content.sections || []) as Array<Record<string, unknown>>;

  const addSection = () => {
    onChange({
      ...content,
      sections: [...sections, { heading: { en: '' }, description: { en: '' }, icon: '', image: '', highlights: [] }],
    });
  };

  const removeSection = (i: number) => {
    onChange({ ...content, sections: sections.filter((_, idx) => idx !== i) });
  };

  const updateSection = (i: number, updates: Record<string, unknown>) => {
    const updated = sections.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, sections: updated });
  };

  const addHighlight = (sectionIdx: number) => {
    const section = sections[sectionIdx];
    const highlights = ((section.highlights || []) as Array<Record<string, unknown>>);
    updateSection(sectionIdx, {
      highlights: [...highlights, { label: { en: '' }, value: { en: '' } }],
    });
  };

  const removeHighlight = (sectionIdx: number, hlIdx: number) => {
    const section = sections[sectionIdx];
    const highlights = ((section.highlights || []) as Array<Record<string, unknown>>);
    updateSection(sectionIdx, {
      highlights: highlights.filter((_, idx) => idx !== hlIdx),
    });
  };

  const updateHighlight = (sectionIdx: number, hlIdx: number, updates: Record<string, unknown>) => {
    const section = sections[sectionIdx];
    const highlights = ((section.highlights || []) as Array<Record<string, unknown>>);
    const updated = highlights.map((item, idx) => (idx === hlIdx ? { ...item, ...updates } : item));
    updateSection(sectionIdx, { highlights: updated });
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
        <Label className="text-base font-semibold">Sections</Label>

        <SortableList
          items={sections}
          onReorder={(items) => onChange({ ...content, sections: items })}
          onRemove={removeSection}
          onAdd={addSection}
          addLabel="Add Section"
          renderItem={(section, i) => (
            <div className="space-y-4">
              <MultilingualInput
                label="Heading"
                value={section.heading as string | Record<string, string> | undefined}
                onChange={(v) => updateSection(i, { heading: v })}
              />

              <MultilingualInput
                label="Description"
                value={section.description as string | Record<string, string> | undefined}
                onChange={(v) => updateSection(i, { description: v })}
                multiline
              />

              <div>
                <Label>Icon (Lucide icon name, e.g. Mountain, Utensils, TreePine)</Label>
                <Input
                  value={(section.icon as string) || ''}
                  onChange={(e) => updateSection(i, { icon: e.target.value })}
                  placeholder="e.g. Mountain"
                />
              </div>

              <div>
                <Label>Image</Label>
                <ImagePicker
                  value={(section.image as string) || ''}
                  onChange={(v) => updateSection(i, { image: v })}
                  propertySlug={propertySlug}
                  propertyImages={propertyImages}
                />
              </div>

              {/* Highlights sub-list */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Highlights (optional key-value pairs)</Label>
                {((section.highlights || []) as Array<Record<string, unknown>>).map((hl, hlIdx) => (
                  <div key={hlIdx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                      <MultilingualInput
                        label="Label"
                        value={hl.label as string | Record<string, string> | undefined}
                        onChange={(v) => updateHighlight(i, hlIdx, { label: v })}
                      />
                      <MultilingualInput
                        label="Value"
                        value={hl.value as string | Record<string, string> | undefined}
                        onChange={(v) => updateHighlight(i, hlIdx, { value: v })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 mt-6"
                      onClick={() => removeHighlight(i, hlIdx)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addHighlight(i)}
                >
                  <Plus size={14} className="mr-1" /> Add Highlight
                </Button>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
