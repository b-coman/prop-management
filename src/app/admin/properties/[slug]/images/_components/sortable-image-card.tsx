'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Star, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { PropertyImage } from '@/types';

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
        <Input
          type="text"
          placeholder="Tags (comma-separated)"
          value={image.tags?.join(', ') || ''}
          onChange={(e) => {
            const tags = e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean);
            onUpdate(index, { tags: tags.length > 0 ? tags : undefined });
          }}
          className="text-sm h-8"
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
