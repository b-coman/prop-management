
// src/components/property/gallery-section.tsx
import Image from 'next/image';
import { Home } from 'lucide-react'; // Fallback icon
import { useLanguage } from '@/hooks/useLanguage';

interface ImageType {
    url: string;
    alt: string | { [key: string]: string };
    'data-ai-hint'?: string;
}

interface GalleryContent {
  title?: string | { [key: string]: string };
  images?: ImageType[];
  propertyName?: string | { [key: string]: string }; // For alt text
  'data-ai-hint'?: string;
}

interface GallerySectionProps {
  content: GalleryContent;
  language?: string;
}

export function GallerySection({ content, language = 'en' }: GallerySectionProps) {
  const { tc, t } = useLanguage();
  
  // Don't render if content is missing
  if (!content) {
    console.warn("GallerySection received invalid content");
    return null;
  }

  // Extract properties with defaults to prevent destructuring errors
  const {
    title = t('gallery.title'),
    images = [],
    propertyName = t('common.property')
  } = content;

  if (!images || images.length === 0) {
    return null; // Don't render if no images
  }

  return (
    <section className="py-8 md:py-12" id="gallery">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-semibold text-foreground mb-6">{tc(title, language)}</h2>
         {/* Use a fluid grid layout */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {images.map((image, index) => (
            <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted">
              <Image
                src={image.url}
                alt={tc(image.alt, language) || `${t('gallery.imageOf', { index: index + 1 })} ${tc(propertyName, language)}`}
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