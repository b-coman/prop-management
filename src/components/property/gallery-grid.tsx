// src/components/property/gallery-grid.tsx
"use client";

import { useState, useMemo } from 'react';
import { GalleryGridBlock } from '@/lib/overridesSchemas-multipage';
import {
  Dialog,
  DialogContent,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SafeImage } from '@/components/ui/safe-image';
import { useLanguage } from '@/hooks/useLanguage';
import { displaySrc, fullSrc } from '@/lib/image-src';
import { trackUiEvent } from '@/lib/tracking';
import { DEFAULT_TAG_LABELS, type TagLabel } from '@/lib/tag-labels';

// Default bilingual labels for common image tags.

/**
 * The photo's stable name, not its CDN URL — a signed/resized URL changes and would split one photo
 * into many rows in a report. The filename is what the owner recognises when deciding which photos
 * to shoot more of, or which to put in an ad.
 */
function photoId(url: string): string {
  try {
    const clean = decodeURIComponent(url.split('?')[0]);
    return clean.substring(clean.lastIndexOf('/') + 1) || clean;
  } catch {
    return url.slice(-60);
  }
}

interface GalleryGridProps {
  content: GalleryGridBlock;
}

export function GalleryGrid({ content }: GalleryGridProps) {
  const { title, description, layout = 'grid', enableLightbox = true, images: rawImages = [] } = content;
  const images = useMemo(() => rawImages.filter((img: any) => img.showInGallery !== false), [rawImages]);
  const { tc, currentLang } = useLanguage();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Merge default tag labels with per-property overrides from Firestore
  const tagLabels = useMemo(() => {
    const customLabels = (content as any).tagLabels as Record<string, TagLabel> | undefined;
    if (!customLabels) return DEFAULT_TAG_LABELS;
    return { ...DEFAULT_TAG_LABELS, ...customLabels };
  }, [content]);

  // Compute available filter tags with counts (only tags with labels)
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const image of images) {
      const tags = (image as any).tags as string[] | undefined;
      if (!tags) continue;
      for (const tag of tags) {
        if (tagLabels[tag]) {
          counts[tag] = (counts[tag] || 0) + 1;
        }
      }
    }
    return counts;
  }, [images, tagLabels]);

  const availableTags = useMemo(() => {
    // Only show tags with 2+ images, sorted by count descending
    return Object.keys(tagCounts)
      .filter((tag) => tagCounts[tag] >= 2)
      .sort((a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b));
  }, [tagCounts]);

  const hasTags = availableTags.length > 0;

  // Filter images by active tag
  const filteredImages = useMemo(() => {
    if (!activeTag) return images;
    return images.filter((image) => {
      const tags = (image as any).tags as string[] | undefined;
      return tags?.includes(activeTag);
    });
  }, [images, activeTag]);

  const openLightbox = (index: number) => {
    if (!enableLightbox) return;
    setCurrentImageIndex(index);
    setLightboxOpen(true);
    // The question this answers: WHICH photos earn a click. Index alone is useless once a filter is
    // applied — position 1 under "outdoor" is a different photo than position 1 under "all" — so the
    // filename travels with it, along with the filter that was active when they chose it.
    const img: any = filteredImages[index];
    if (img) {
      trackUiEvent('select_photo', {
        photo_id: photoId(String(img.url || '')),
        photo_index: index,
        photo_tag: (img.tags as string[] | undefined)?.[0],
        gallery_filter: activeTag ?? 'all',
        position: 'grid',
      });
    }
  };

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? filteredImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev === filteredImages.length - 1 ? 0 : prev + 1));
  };

  // Key event handler for lightbox
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrevious();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    } else if (e.key === 'Escape') {
      setLightboxOpen(false);
    }
  };

  const handleTagClick = (tag: string | null) => {
    setActiveTag(tag);
    setCurrentImageIndex(0);
    // A filter click is the visitor stating an interest in words — the most direct read available on
    // what they came to see. Worth more per event than any scroll threshold.
    trackUiEvent('gallery_filter', { gallery_filter: tag ?? 'all' });
  };

  const lang = currentLang || 'en';

  // Names the photo's most specific category in the lightbox. Skips tags with no
  // label — they are structural, and rendering the raw slug would leak an
  // untranslated English word onto the page.
  const chipLabel = (tags?: string[]) => {
    const tag = tags?.find((t) => tagLabels[t]);
    return tag ? tagLabels[tag][lang as 'en' | 'ro'] : null;
  };

  return (
    <section className="py-8 md:py-12 bg-background" onKeyDown={lightboxOpen ? handleKeyDown : undefined}>
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-6">
          <h2 className="text-3xl font-bold mb-4">{tc(title)}</h2>
          {description && <p className="text-muted-foreground">{tc(description)}</p>}
        </div>

        {/* Tag Filter Pills — horizontal scroll on mobile, wrap on desktop */}
        {hasTags && (
          <div className="mb-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 md:justify-center md:flex-wrap px-1 py-1">
              <button
                onClick={() => handleTagClick(null)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  activeTag === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {lang === 'ro' ? 'Toate' : 'All'} ({images.length})
              </button>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                    activeTag === tag
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tagLabels[tag]?.[lang as 'en' | 'ro'] || tag} ({tagCounts[tag]})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid Layout */}
        {layout === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
            {filteredImages.map((image, index) => (
              <div
                key={index}
                className={cn(
                  "relative cursor-pointer overflow-hidden rounded-lg",
                  index === 0 && "md:col-span-2 md:row-span-2",
                  "transition-transform hover:scale-[1.02]"
                )}
                style={{
                  height: index === 0 ? '500px' : '250px'
                }}
                onClick={() => openLightbox(index)}
              >
                <SafeImage
                  src={displaySrc(image)}
                  alt={tc(image.alt) || `Property image ${index + 1}`}
                  fill
                  {...(index === 0 ? { priority: true } : { loading: "lazy" as const })}
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  fallbackText="Property image not available"
                  blurDataURL={(image as any).blurDataURL}
                />
              </div>
            ))}
          </div>
        )}

        {/* Masonry Layout */}
        {layout === 'masonry' && (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {filteredImages.map((image, index) => (
              <div
                key={index}
                className="relative cursor-pointer overflow-hidden rounded-lg break-inside-avoid"
                onClick={() => openLightbox(index)}
              >
                <SafeImage
                  src={displaySrc(image)}
                  alt={tc(image.alt) || `Property image ${index + 1}`}
                  width={800}
                  height={600}
                  {...(index === 0 ? { priority: true } : { loading: "lazy" as const })}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="w-full h-auto object-cover hover:scale-[1.02] transition-transform"
                  fallbackText="Property image not available"
                  blurDataURL={(image as any).blurDataURL}
                />
              </div>
            ))}
          </div>
        )}

        {/* Slider Layout */}
        {layout === 'slider' && (
          <div className="relative max-w-5xl mx-auto overflow-hidden rounded-lg">
            <div className="flex justify-between absolute top-1/2 left-0 right-0 z-10 px-4 transform -translate-y-1/2">
              <Button
                size="icon"
                variant="ghost"
                className="bg-black/30 text-white hover:bg-black/50"
                onClick={handlePrevious}
              >
                <ArrowLeft />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="bg-black/30 text-white hover:bg-black/50"
                onClick={handleNext}
              >
                <ArrowRight />
              </Button>
            </div>

            <div className="relative h-[600px] w-full">
              {filteredImages.map((image, index) => (
                <div
                  key={index}
                  className={cn(
                    "absolute top-0 left-0 w-full h-full transition-opacity duration-500",
                    index === currentImageIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  <SafeImage
                    src={displaySrc(image)}
                    alt={tc(image.alt) || `Property image ${index + 1}`}
                    fill
                    {...(index === 0 ? { priority: true } : { loading: "lazy" as const })}
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-cover"
                    fallbackText="Property image not available"
                    blurDataURL={(image as any).blurDataURL}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox Dialog */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-7xl p-0 bg-transparent border-0">
            <div className="relative h-[80vh] flex items-center justify-center bg-black">
              <DialogClose className="absolute right-4 top-4 z-10">
                <Button size="icon" variant="ghost" className="text-white bg-black/50 hover:bg-black/80">
                  <X />
                </Button>
              </DialogClose>

              <div className="flex justify-between absolute top-1/2 left-0 right-0 z-10 px-4 transform -translate-y-1/2 w-full">
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-black/30 text-white hover:bg-black/50"
                  onClick={handlePrevious}
                >
                  <ArrowLeft />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="bg-black/30 text-white hover:bg-black/50"
                  onClick={handleNext}
                >
                  <ArrowRight />
                </Button>
              </div>

              {filteredImages.length > 0 && currentImageIndex < filteredImages.length && (
                <div className="relative h-full w-full max-h-[80vh]">
                  <SafeImage
                    src={fullSrc(filteredImages[currentImageIndex])}
                    alt={tc(filteredImages[currentImageIndex].alt) || `Property image ${currentImageIndex + 1}`}
                    fill
                    className="object-contain"
                    fallbackText="Property image not available"
                    blurDataURL={(filteredImages[currentImageIndex] as any).blurDataURL}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-4 pt-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {chipLabel(filteredImages[currentImageIndex].tags) && (
                          <span className="text-xs font-medium bg-white/20 text-white px-2 py-0.5 rounded-full">
                            {chipLabel(filteredImages[currentImageIndex].tags)}
                          </span>
                        )}
                        {tc(filteredImages[currentImageIndex].alt) && (
                          <span className="text-sm text-white/90">
                            {tc(filteredImages[currentImageIndex].alt)}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-white/60">
                        {currentImageIndex + 1} / {filteredImages.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
