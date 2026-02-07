'use client';

import { MultilingualInput } from '../multilingual-input';
import { SortableList } from '../sortable-list';
import { Label } from '@/components/ui/label';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

export function PoliciesForm({ content, onChange }: BlockFormProps) {
  const policies = (content.policies || []) as Array<Record<string, unknown>>;

  const addPolicy = () => {
    onChange({
      ...content,
      policies: [...policies, { title: { en: '' }, description: { en: '' } }],
    });
  };

  const removePolicy = (i: number) => {
    onChange({ ...content, policies: policies.filter((_, idx) => idx !== i) });
  };

  const updatePolicy = (i: number, updates: Record<string, unknown>) => {
    const updated = policies.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, policies: updated });
  };

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Policies</Label>

        <SortableList
          items={policies}
          onReorder={(items) => onChange({ ...content, policies: items })}
          onRemove={removePolicy}
          onAdd={addPolicy}
          addLabel="Add Policy"
          renderItem={(policy, i) => (
            <div className="space-y-4">
              <MultilingualInput
                label="Title"
                value={policy.title as string | Record<string, string> | undefined}
                onChange={(v) => updatePolicy(i, { title: v })}
              />

              <MultilingualInput
                label="Description"
                value={policy.description as string | Record<string, string> | undefined}
                onChange={(v) => updatePolicy(i, { description: v })}
                multiline
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
