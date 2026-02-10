'use client';

import { useState } from 'react';
import { MultilingualInput } from '../multilingual-input';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';

interface BlockFormProps {
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

type TagLabels = Record<string, { en: string; ro: string }>;

export function GalleryGridForm({ content, onChange }: BlockFormProps) {
  const [newTagKey, setNewTagKey] = useState('');

  const tagLabels = (content.tagLabels as TagLabels) || {};
  const tagKeys = Object.keys(tagLabels);

  const updateTagLabel = (key: string, label: { en: string; ro: string }) => {
    const updated = { ...tagLabels, [key]: label };
    onChange({ ...content, tagLabels: updated });
  };

  const removeTagLabel = (key: string) => {
    const updated = { ...tagLabels };
    delete updated[key];
    onChange({ ...content, tagLabels: Object.keys(updated).length > 0 ? updated : undefined });
  };

  const addTagLabel = () => {
    const key = newTagKey.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key || tagLabels[key]) return;
    const updated = { ...tagLabels, [key]: { en: '', ro: '' } };
    onChange({ ...content, tagLabels: updated });
    setNewTagKey('');
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

      <div>
        <Label>Layout</Label>
        <Select
          value={(content.layout as string) || 'grid'}
          onValueChange={(v) => onChange({ ...content, layout: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="masonry">Masonry</SelectItem>
            <SelectItem value="slider">Slider</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Enable Lightbox</Label>
        <Switch
          checked={!!content.enableLightbox}
          onCheckedChange={(v) => onChange({ ...content, enableLightbox: v })}
        />
      </div>

      {/* Tag Filter Labels */}
      <div className="space-y-3">
        <div>
          <Label>Tag Filter Labels</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Override or extend the default filter pill labels. Only tags listed here will override defaults.
          </p>
        </div>

        {tagKeys.length > 0 && (
          <div className="space-y-2">
            {tagKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1.5 rounded shrink-0 min-w-[80px]">
                  {key}
                </code>
                <MultilingualInput
                  label={key}
                  value={tagLabels[key]}
                  onChange={(v) => updateTagLabel(key, v as { en: string; ro: string })}
                  inline
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTagLabel(key)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={newTagKey}
            onChange={(e) => setNewTagKey(e.target.value)}
            placeholder="Tag key (e.g. pool, spa)"
            className="text-sm h-8 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTagLabel();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTagLabel}
            disabled={!newTagKey.trim()}
            className="h-8 shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
