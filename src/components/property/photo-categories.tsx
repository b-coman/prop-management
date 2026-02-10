// src/components/property/photo-categories.tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { PhotoCategoriesBlock } from '@/lib/overridesSchemas-multipage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface PhotoCategoriesProps {
  content: PhotoCategoriesBlock;
}

export function PhotoCategories({ content }: PhotoCategoriesProps) {
  const { title, categories } = content;
  const { t, tc } = useLanguage();
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);

  // Don't render if no categories configured
  if (!categories || categories.length === 0) {
    return null;
  }
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Find the current category object by index
  const currentCategory = categories[selectedCategoryIndex];
  
  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const handlePrevious = () => {
    if (!currentCategory) return;
    setCurrentImageIndex((prev) => 
      (prev === 0 ? currentCategory.images.length - 1 : prev - 1)
    );
  };

  const handleNext = () => {
    if (!currentCategory) return;
    setCurrentImageIndex((prev) => 
      (prev === currentCategory.images.length - 1 ? 0 : prev + 1)
    );
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>

        <Tabs
          defaultValue="0"
          onValueChange={(val) => setSelectedCategoryIndex(Number(val))}
          className="max-w-6xl mx-auto"
        >
          {/* Category Selector */}
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="md:w-1/3">
              <h3 className="text-xl font-semibold mb-4">{t('gallery.browseByCategory', 'Browse by Category')}</h3>
              <TabsList className="flex flex-col w-full h-auto space-y-1">
                {categories.map((category, idx) => (
                  <TabsTrigger
                    key={idx}
                    value={String(idx)}
                    className="justify-start px-4 py-3 text-left h-auto"
                  >
                    {tc(category.name)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="md:w-2/3">
              {categories.map((category, idx) => (
                <TabsContent key={idx} value={String(idx)} className="mt-0">
                  <div className="bg-card rounded-lg p-6 border">
                    <div className="relative w-full h-48 mb-4 rounded-md overflow-hidden">
                      <Image
                        src={category.thumbnail}
                        alt={tc(category.name)}
                        fill
                        className="object-cover"
                        {...((category as any).thumbnailBlur ? { placeholder: 'blur' as const, blurDataURL: (category as any).thumbnailBlur } : {})}
                      />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{tc(category.name)}</h3>
                    <p className="text-muted-foreground mb-6">{tc(category.description)}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {category.images.map((image, index) => (
                        <div
                          key={index}
                          className="relative h-32 rounded-md overflow-hidden cursor-pointer transition-transform hover:scale-[1.05]"
                          onClick={() => openLightbox(index)}
                        >
                          <Image
                            src={image.url}
                            alt={tc(image.alt) || ''}
                            fill
                            className="object-cover"
                            {...((image as any).blurDataURL ? { placeholder: 'blur' as const, blurDataURL: (image as any).blurDataURL } : {})}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
        
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
              
              {currentCategory && currentCategory.images.length > 0 && (
                <div className="relative h-full w-full max-h-[80vh]">
                  <Image
                    src={currentCategory.images[currentImageIndex].url}
                    alt={tc(currentCategory.images[currentImageIndex].alt) || ''}
                    fill
                    className="object-contain"
                    {...((currentCategory.images[currentImageIndex] as any).blurDataURL ? { placeholder: 'blur' as const, blurDataURL: (currentCategory.images[currentImageIndex] as any).blurDataURL } : {})}
                  />
                  <div className="absolute bottom-4 left-0 right-0 text-center text-white bg-black/50 py-2">
                    {tc(currentCategory.images[currentImageIndex].alt)}
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