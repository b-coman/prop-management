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

export function SpecificationsForm({ content, onChange }: BlockFormProps) {
  const specifications = (content.specifications || []) as Array<Record<string, unknown>>;

  const addSpecification = () => {
    onChange({
      ...content,
      specifications: [...specifications, { name: '', value: '' }],
    });
  };

  const removeSpecification = (i: number) => {
    onChange({ ...content, specifications: specifications.filter((_, idx) => idx !== i) });
  };

  const updateSpecification = (i: number, updates: Record<string, unknown>) => {
    const updated = specifications.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, specifications: updated });
  };

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Specifications</Label>

        <SortableList
          items={specifications}
          onReorder={(items) => onChange({ ...content, specifications: items })}
          onRemove={removeSpecification}
          onAdd={addSpecification}
          addLabel="Add Specification"
          renderItem={(spec, i) => (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={(spec.name as string) || ''}
                  onChange={(e) => updateSpecification(i, { name: e.target.value })}
                  placeholder="e.g. Bedrooms, Bathrooms, Area"
                />
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={(spec.value as string) || ''}
                  onChange={(e) => updateSpecification(i, { value: e.target.value })}
                  placeholder="e.g. 3, 2, 120 sqm"
                />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
