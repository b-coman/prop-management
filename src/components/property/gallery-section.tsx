
// src/components/property/gallery-section.tsx
import Image from 'next/image';
import { Home } from 'lucide-react'; // Fallback icon

interface ImageType {
    url: string;
    alt: string;
    'data-ai-hint'?: string;
}

interface GalleryContent {
  title?: string;
  images?: ImageType[];
  propertyName?: string; // For alt text
  'data-ai-hint'?: string;
}

interface GallerySectionProps {
  content: GalleryContent;
}

export function GallerySection({ content }: GallerySectionProps) {
  // Don't render if content is missing
  if (!content) {
    console.warn("GallerySection received invalid content");
    return null;
  }

  // Extract properties with defaults to prevent destructuring errors
  const {
    title = "Gallery",
    images = [],
    propertyName = "Property"
  } = content;

  if (!images || images.length === 0) {
    return null; // Don't render if no images
  }

  return (
    <section className="py-8 md:py-12" id="gallery">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-semibold text-foreground mb-6">{title}</h2>
         {/* Use a fluid grid layout */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {images.map((image, index) => (
            <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted">
              <Image
                src={image.url}
                alt={image.alt || `Gallery image ${index + 1} of ${propertyName}`}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // Adjust sizes for better fit
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