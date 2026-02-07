'use client';

import { MultilingualInput } from '../multilingual-input';
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

export function AmenitiesForm({ content, onChange }: BlockFormProps) {
  const categories = (content.categories || []) as Array<Record<string, unknown>>;

  const addCategory = () => {
    onChange({
      ...content,
      categories: [...categories, { name: { en: '' }, amenities: [] }],
    });
  };

  const removeCategory = (i: number) => {
    onChange({ ...content, categories: categories.filter((_, idx) => idx !== i) });
  };

  const updateCategory = (i: number, updates: Record<string, unknown>) => {
    const updated = categories.map((item, idx) => (idx === i ? { ...item, ...updates } : item));
    onChange({ ...content, categories: updated });
  };

  const addAmenity = (catIndex: number) => {
    const cat = categories[catIndex];
    const amenities = (cat.amenities || []) as string[];
    updateCategory(catIndex, { amenities: [...amenities, ''] });
  };

  const removeAmenity = (catIndex: number, amenityIndex: number) => {
    const cat = categories[catIndex];
    const amenities = (cat.amenities || []) as string[];
    updateCategory(catIndex, { amenities: amenities.filter((_, idx) => idx !== amenityIndex) });
  };

  const updateAmenity = (catIndex: number, amenityIndex: number, value: string) => {
    const cat = categories[catIndex];
    const amenities = (cat.amenities || []) as string[];
    const updated = amenities.map((a, idx) => (idx === amenityIndex ? value : a));
    updateCategory(catIndex, { amenities: updated });
  };

  return (
    <div className="space-y-6">
      <MultilingualInput
        label="Title"
        value={content.title as string | Record<string, string> | undefined}
        onChange={(v) => onChange({ ...content, title: v })}
      />

      <div className="space-y-4">
        <Label className="text-base font-semibold">Categories</Label>

        <SortableList
          items={categories}
          onReorder={(items) => onChange({ ...content, categories: items })}
          onRemove={removeCategory}
          onAdd={addCategory}
          addLabel="Add Category"
          renderItem={(category, i) => (
            <div className="space-y-4">
              <MultilingualInput
                label="Category Name"
                value={category.name as string | Record<string, string> | undefined}
                onChange={(v) => updateCategory(i, { name: v })}
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Amenities</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => addAmenity(i)}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>

                {((category.amenities || []) as string[]).map((amenity, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Input
                      value={amenity}
                      onChange={(e) => updateAmenity(i, j, e.target.value)}
                      placeholder="Amenity name"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAmenity(i, j)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
