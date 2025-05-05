// src/components/property/gallery-section.tsx
import Image from 'next/image';
import { Home } from 'lucide-react'; // Fallback icon

interface ImageType {
    url: string;
    alt: string;
    'data-ai-hint'?: string;
}

interface GallerySectionProps {
  images?: ImageType[]; // Pass the filtered gallery images
  propertyName: string; // For alt text
}

export function GallerySection({ images, propertyName }: GallerySectionProps) {
  if (!images || images.length === 0) {
    return null; // Don't render if no images
  }

  return (
    <section className="py-8 md:py-12" id="gallery">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-semibold text-foreground mb-6">Gallery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted">
              <Image
                src={image.url}
                alt={image.alt || `Gallery image ${index + 1} of ${propertyName}`}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw" // Basic responsive sizes
                loading="lazy" // Lazy load gallery images
                className="transition-transform duration-300 hover:scale-105"
                data-ai-hint={image['data-ai-hint']}
              />
            </div>
          ))}
           {/* Add more images or a modal viewer if needed */}
        </div>
      </div>
    </section>
  );
}
