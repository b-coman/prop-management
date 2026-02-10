'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PropertyImage } from '@/types';

const SUGGESTED_TAGS = [
  'bedroom', 'living-room', 'kitchen', 'bathroom', 'dining',
  'kids', 'terrace', 'garden', 'outdoor', 'pool',
  'spa', 'balcony', 'parking', 'beach-access', 'deck',
];

interface SortableImageCardProps {
  image: PropertyImage;
  index: number;
  onUpdate: (index: number, updates: Partial<PropertyImage>) => void;
  onDelete: (index: number) => void;
}

export function SortableImageCard({
  image,
  index,
  onUpdate,
  onDelete,
}: SortableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`relative overflow-hidden ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing bg-black/50 rounded p-1"
      >
        <GripVertical className="h-4 w-4 text-white" />
      </div>

      {/* Featured star */}
      <button
        type="button"
        onClick={() => onUpdate(index, { isFeatured: !image.isFeatured })}
        className="absolute top-2 right-2 z-10 bg-black/50 rounded p-1 hover:bg-black/70 transition-colors"
        title={image.isFeatured ? 'Remove featured' : 'Set as featured'}
      >
        <Star
          className={`h-4 w-4 ${
            image.isFeatured
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-white'
          }`}
        />
      </button>

      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-muted">
        <Image
          src={image.thumbnailUrl || image.url}
          alt={image.alt || 'Property image'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          unoptimized={
            !image.url.includes('firebasestorage') &&
            !image.url.includes('picsum.photos')
          }
        />
      </div>

      {/* Controls */}
      <div className="p-3 space-y-2">
        <Input
          type="text"
          placeholder="Alt text (accessibility)"
          value={image.alt || ''}
          onChange={(e) => onUpdate(index, { alt: e.target.value })}
          className="text-sm h-8"
        />
        <ImageTagInput
          tags={image.tags || []}
          onChange={(tags) => onUpdate(index, { tags: tags.length > 0 ? tags : undefined })}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            #{index + 1}
            {image.storagePath ? '' : ' (external)'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(index)}
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ImageTagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [customInput, setCustomInput] = useState('');

  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!normalized || tags.includes(normalized)) return;
    onChange([...tags, normalized]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(customInput);
      setCustomInput('');
    }
  };

  const unusedSuggestions = SUGGESTED_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="space-y-1.5">
      {/* Applied tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-destructive ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unusedSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}

      {/* Custom tag input */}
      <Input
        type="text"
        placeholder="Custom tag + Enter"
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        onKeyDown={handleCustomKeyDown}
        className="text-sm h-7"
      />
    </div>
  );
}
