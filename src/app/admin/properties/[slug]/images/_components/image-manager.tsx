'use client';

import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Upload, AlertTriangle, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SortableImageCard } from './sortable-image-card';
import { validateImageFile, processImageForUpload } from '@/lib/image-utils';
import { uploadPropertyImage, deleteStorageImage } from '@/lib/storage-upload';
import { savePropertyImages, deleteImageFromStorage } from '../actions';
import type { PropertyImage } from '@/types';

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'processing' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface ImageManagerProps {
  slug: string;
  initialImages: PropertyImage[];
}

const MAX_CONCURRENT_UPLOADS = 3;

export function ImageManager({ slug, initialImages }: ImageManagerProps) {
  const [images, setImages] = useState<PropertyImage[]>(initialImages);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---- Upload logic ----

  const processQueue = useCallback(async (queue: UploadItem[]) => {
    const pending = queue.filter((u) => u.status === 'queued');

    for (const item of pending) {
      if (activeUploadsRef.current >= MAX_CONCURRENT_UPLOADS) break;
      activeUploadsRef.current++;

      // Mark as processing
      setUploadQueue((q) =>
        q.map((u) => (u.id === item.id ? { ...u, status: 'processing' as const } : u))
      );

      (async () => {
        try {
          const processed = await processImageForUpload(item.file);

          setUploadQueue((q) =>
            q.map((u) =>
              u.id === item.id ? { ...u, status: 'uploading' as const } : u
            )
          );

          const result = await uploadPropertyImage(
            slug,
            processed.full,
            processed.thumbnail,
            processed.extension,
            (percent) => {
              setUploadQueue((q) =>
                q.map((u) =>
                  u.id === item.id ? { ...u, progress: percent } : u
                )
              );
            }
          );

          const newImage: PropertyImage = {
            url: result.fullUrl,
            alt: '',
            thumbnailUrl: result.thumbnailUrl,
            storagePath: result.storagePath,
            thumbnailStoragePath: result.thumbnailStoragePath,
          };

          setImages((prev) => [...prev, newImage]);
          setIsDirty(true);

          setUploadQueue((q) =>
            q.map((u) =>
              u.id === item.id
                ? { ...u, status: 'done' as const, progress: 100 }
                : u
            )
          );
        } catch (err) {
          setUploadQueue((q) =>
            q.map((u) =>
              u.id === item.id
                ? {
                    ...u,
                    status: 'error' as const,
                    error:
                      err instanceof Error ? err.message : 'Upload failed',
                  }
                : u
            )
          );
        } finally {
          activeUploadsRef.current--;
          // Trigger next in queue
          setUploadQueue((q) => {
            // Re-process remaining queued items
            setTimeout(() => processQueue(q), 0);
            return q;
          });
        }
      })();
    }
  }, [slug]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const newItems: UploadItem[] = [];

      for (const file of fileArray) {
        const validationError = validateImageFile(file);
        if (validationError) {
          newItems.push({
            id: crypto.randomUUID(),
            file,
            progress: 0,
            status: 'error',
            error: validationError,
          });
          continue;
        }
        newItems.push({
          id: crypto.randomUUID(),
          file,
          progress: 0,
          status: 'queued',
        });
      }

      setUploadQueue((prev) => {
        const updated = [...prev, ...newItems];
        setTimeout(() => processQueue(updated), 0);
        return updated;
      });
    },
    [processQueue]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ---- Reorder ----

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setImages((items) => {
      const oldIndex = items.findIndex((i) => i.url === active.id);
      const newIndex = items.findIndex((i) => i.url === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;
      setIsDirty(true);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  // ---- Update / Delete ----

  function handleUpdateImage(index: number, updates: Partial<PropertyImage>) {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
    setIsDirty(true);
  }

  async function handleDeleteImage() {
    if (deleteIndex === null) return;
    const image = images[deleteIndex];

    // Delete from Storage if it has a storagePath
    if (image.storagePath) {
      try {
        await deleteStorageImage(image.storagePath, image.thumbnailStoragePath);
      } catch {
        // Try server-side deletion as fallback
        await deleteImageFromStorage(slug, image.storagePath, image.thumbnailStoragePath);
      }
    }

    setImages((prev) => prev.filter((_, i) => i !== deleteIndex));
    setIsDirty(true);
    setDeleteIndex(null);
  }

  // ---- Save / Discard ----

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    const result = await savePropertyImages(slug, images);
    if (result.error) {
      setError(result.error);
    } else {
      setIsDirty(false);
      // Clear completed uploads
      setUploadQueue((q) => q.filter((u) => u.status !== 'done'));
    }
    setIsSaving(false);
  }

  function handleDiscard() {
    setImages(initialImages);
    setIsDirty(false);
    setError(null);
  }

  // ---- Active upload items (non-done, non-error for display) ----
  const activeUploads = uploadQueue.filter(
    (u) => u.status !== 'done'
  );

  return (
    <div className="space-y-6">
      {/* Warning banner: < 8 images */}
      {images.length < 8 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950/30">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Add more images for better visibility
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Google recommends at least 8 high-quality photos. You currently have{' '}
              {images.length} image{images.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          Drag and drop images here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPEG, PNG, or WebP. Max 10MB per file. Images are automatically resized.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Upload progress */}
      {activeUploads.length > 0 && (
        <div className="space-y-2">
          {activeUploads.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 text-sm rounded-md border p-3"
            >
              <span className="truncate flex-1 min-w-0">{item.file.name}</span>
              {item.status === 'error' ? (
                <span className="text-destructive text-xs shrink-0">
                  {item.error}
                </span>
              ) : (
                <div className="w-32 shrink-0">
                  <Progress value={item.progress} className="h-2" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Sortable image grid */}
      {images.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((i) => i.url)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <SortableImageCard
                  key={image.url}
                  image={image}
                  index={index}
                  onUpdate={handleUpdateImage}
                  onDelete={setDeleteIndex}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>No images yet. Upload some photos to get started.</p>
        </div>
      )}

      {/* Sticky save bar */}
      {isDirty && (
        <div className="sticky bottom-4 z-40">
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-4 shadow-lg">
            <span className="text-sm text-muted-foreground">
              {images.length} image{images.length !== 1 ? 's' : ''} &mdash;
              unsaved changes
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={isSaving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the image
              {deleteIndex !== null && images[deleteIndex]?.storagePath
                ? ' from storage and'
                : ''}{' '}
              from the gallery. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteImage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
