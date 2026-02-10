
// src/components/property/gallery-section.tsx
import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';
import { SafeImage } from '@/components/ui/safe-image';

interface ImageType {
    url: string;
    alt: string | { [key: string]: string };
    'data-ai-hint'?: string;
    blurDataURL?: string;
}

interface GalleryContent {
  title?: string | { [key: string]: string };
  images?: ImageType[];
  propertyName?: string | { [key: string]: string }; // For alt text
  'data-ai-hint'?: string;
  maxImages?: number;
  viewAllUrl?: string;
  viewAllText?: string | { [key: string]: string };
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
    propertyName = t('common.property'),
    maxImages,
    viewAllUrl,
    viewAllText,
  } = content;

  if (!images || images.length === 0) {
    return null; // Don't render if no images
  }

  const hasMore = maxImages !== undefined && images.length > maxImages;
  const displayImages = hasMore ? images.slice(0, maxImages) : images;
  const remainingCount = hasMore ? images.length - maxImages : 0;

  return (
    <section className="py-8 md:py-12" id="gallery">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-semibold text-foreground mb-6">{tc(title)}</h2>
         {/* Use a fluid grid layout */}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {displayImages.map((image, index) => {
            const isLastWithOverlay = hasMore && index === displayImages.length - 1;

            return (
              <div key={index} className="relative aspect-[4/3] w-full overflow-hidden rounded-lg shadow-md bg-muted">
                <SafeImage
                  src={image.url}
                  alt={tc(image.alt) || `${t('gallery.imageOf', undefined, { index: index + 1 })} ${tc(propertyName)}`}
                  fill
                  style={{ objectFit: "cover" }}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  loading="lazy"
                  className="transition-transform duration-300 hover:scale-105"
                  data-ai-hint={image['data-ai-hint']}
                  fallbackText={`${t('gallery.imageUnavailable', 'Image unavailable')}`}
                  blurDataURL={image.blurDataURL}
                />
                {isLastWithOverlay && viewAllUrl && (
                  <Link
                    href={viewAllUrl}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center transition-colors hover:bg-black/60"
                  >
                    <span className="text-white text-xl font-semibold">
                      +{remainingCount} {t('gallery.morePhotos', 'more photos')}
                    </span>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        {hasMore && viewAllUrl && (
          <div className="mt-6 text-center">
            <Link
              href={viewAllUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              {tc(viewAllText) || t('gallery.viewAll', 'View All Photos')}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
