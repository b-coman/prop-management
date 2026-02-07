'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ImagePickerProps {
  currentImage?: string | null;
  value?: string | null;
  onSelect?: (url: string | null) => void;
  onChange?: (url: string | null) => void;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
  propertySlug?: string;
}

export function ImagePicker({ currentImage, value, onSelect, onChange, propertyImages }: ImagePickerProps) {
  const imageUrl = currentImage ?? value;
  const handleChange = onSelect ?? onChange ?? (() => {});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(imageUrl || null);

  const handleConfirm = () => {
    handleChange(selected);
    setOpen(false);
  };

  const handleRemove = () => {
    handleChange(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-3 rounded-md border p-2 hover:bg-muted/50 transition-colors w-full text-left"
        >
          {imageUrl ? (
            <div className="relative h-12 w-16 rounded overflow-hidden shrink-0 bg-muted">
              <Image
                src={imageUrl!}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded bg-muted shrink-0">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <span className="text-sm text-muted-foreground truncate">
            {imageUrl ? 'Change image' : 'Select image'}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {propertyImages.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {propertyImages.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setSelected(img.url)}
                  className={cn(
                    'relative aspect-square rounded-md overflow-hidden border-2 transition-all',
                    selected === img.url
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/30'
                  )}
                >
                  <Image
                    src={img.thumbnailUrl || img.url}
                    alt={img.alt || ''}
                    fill
                    className="object-cover"
                    sizes="150px"
                  />
                  {selected === img.url && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="rounded-full bg-primary p-1">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No images available. Upload images in Property &gt; Images first.
            </p>
          )}
        </div>
        <div className="flex justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4 mr-1" />
            Remove Image
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Select
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
