// src/components/property/gallery-grid.tsx
"use client";

import { useState } from 'react';
import { GalleryGridBlock } from '@/lib/overridesSchemas-multipage';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SafeImage } from '@/components/ui/safe-image';
import { useLanguage } from '@/hooks/useLanguage';

interface GalleryGridProps {
  content: GalleryGridBlock;
}

export function GalleryGrid({ content }: GalleryGridProps) {
  const { title, description, layout = 'grid', enableLightbox = true, images = [] } = content;
  const { tc } = useLanguage();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openLightbox = (index: number) => {
    if (!enableLightbox) return;
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
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

  return (
    <section className="py-16 bg-background" onKeyDown={lightboxOpen ? handleKeyDown : undefined}>
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-4">{tc(title)}</h2>
          {description && <p className="text-muted-foreground">{tc(description)}</p>}
        </div>
        
        {/* Grid Layout */}
        {layout === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min">
            {images.map((image, index) => (
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
                  src={image.url}
                  alt={tc(image.alt) || `Property image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  fallbackText="Property image not available"
                />
              </div>
            ))}
          </div>
        )}
        
        {/* Masonry Layout */}
        {layout === 'masonry' && (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
            {images.map((image, index) => (
              <div 
                key={index}
                className="relative cursor-pointer overflow-hidden rounded-lg break-inside-avoid"
                onClick={() => openLightbox(index)}
              >
                <SafeImage
                  src={image.url}
                  alt={tc(image.alt) || `Property image ${index + 1}`}
                  width={800}
                  height={600}
                  className="w-full h-auto object-cover hover:scale-[1.02] transition-transform"
                  fallbackText="Property image not available"
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
              {images.map((image, index) => (
                <div 
                  key={index}
                  className={cn(
                    "absolute top-0 left-0 w-full h-full transition-opacity duration-500",
                    index === currentImageIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  <SafeImage
                    src={image.url}
                    alt={tc(image.alt) || `Property image ${index + 1}`}
                    fill
                    className="object-cover"
                    fallbackText="Property image not available"
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
              
              {images.length > 0 && (
                <div className="relative h-full w-full max-h-[80vh]">
                  <SafeImage
                    src={images[currentImageIndex].url}
                    alt={tc(images[currentImageIndex].alt) || `Property image ${currentImageIndex + 1}`}
                    fill
                    className="object-contain"
                    fallbackText="Property image not available"
                  />
                  <div className="absolute bottom-4 left-0 right-0 text-center text-white bg-black/50 py-2">
                    {tc(images[currentImageIndex].alt)}
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