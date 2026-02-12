// src/components/homepage/hero-section.tsx
"use client";

import Image from 'next/image';
import type { Property } from '@/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { setupHeroContentAdjustment } from './hero-helper';
import { useLanguage } from '@/hooks/useLanguage';
import { BookingContainer } from '@/components/booking-widget';
import { Users, BedDouble, Bath, Home } from 'lucide-react';

// Module-level flag: survives component remounts (unlike React state).
// Ensures the fade-in animation only plays on first page load, not on
// language switches which cause Next.js to remount the component.
let heroHasBeenShown = false;

export interface HeroData {
  backgroundImage?: string | null;
  backgroundImageBlur?: string | null;
  'data-ai-hint'?: string;
  title?: string | { [key: string]: string } | null;
  subtitle?: string | { [key: string]: string } | null;
  price?: number | null; // Advertised rate from property's base currency
  showRating?: boolean;
  showBookingForm?: boolean;
  bookingFormProperty?: Property;
  bookingForm?: {
    position?: 'center' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'compressed' | 'large';
  };
}

interface HeroSectionProps {
  content: HeroData | any; // Accept content instead of heroData to match other components
  language?: string; // Add language prop
}

export function HeroSection({ content, language = 'en' }: HeroSectionProps) {
  const { tc, t } = useLanguage();
  
  // Ensure content exists with defaults
  if (!content) {
    console.warn("[HeroSection] ⚠️ Received invalid content");
    return (
      <section className="relative h-[70vh] min-h-[500px] md:h-[80vh] md:min-h-[600px] w-full flex text-white">
        <div className="absolute inset-0 bg-black/80"></div>
        <div className="container mx-auto px-4 flex items-center justify-center">
          <h1 className="text-3xl">{t('common.welcome')}</h1>
        </div>
      </section>
    );
  }

  const isFirstShow = !heroHasBeenShown;
  const [hasMounted, setHasMounted] = useState(!isFirstShow);

  useEffect(() => {
    // Only run the hero content adjustment when the component actually has the booking form
    let cleanup: (() => void) | undefined;

    // Small delay to ensure all components are rendered
    const positionTimer = setTimeout(() => {
      cleanup = setupHeroContentAdjustment();
    }, 100);

    // Fade in after positioning is done (only on very first page load)
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    if (isFirstShow) {
      fadeTimer = setTimeout(() => {
        heroHasBeenShown = true;
        setHasMounted(true);
      }, 350);
    }

    return () => {
      clearTimeout(positionTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (cleanup) {
        cleanup();
      }
    };
  }, []); // Empty dependency array ensures this only runs once

  // Extract properties with defaults to prevent destructuring errors
  const {
    backgroundImage = null,
    backgroundImageBlur = null,
    title = null,
    subtitle = null,
    price = null,
    showRating = false,
    showBookingForm = false,
    bookingFormProperty = null,
    bookingForm = { position: 'bottom', size: 'compressed' },
    'data-ai-hint': dataAiHint = "property image",
  } = content;

  // Load property data with defaults
  // We'll keep this even if property data isn't available, but log a warning
  if (!bookingFormProperty) {
    console.warn("HeroSection: Missing property data for booking form. Using default values.");
  }

  // Extract property slug from bookingFormProperty
  const propertySlug = bookingFormProperty?.slug || 'default';

  const property = bookingFormProperty || {
    id: propertySlug || 'default',
    slug: propertySlug || 'default',
    name: tc(title) || 'Property',
    baseCurrency: 'EUR',
    baseRate: price || 150, // Use price from content or default
    advertisedRate: price || 150,
    advertisedRateType: "from",
    minNights: 2,
    maxNights: 14,
    maxGuests: 6
  };

  // Extract form position and size for the BookingContainer
  const formPosition = bookingForm?.position || 'bottom';
  const formSize = bookingForm?.size || 'compressed';
  
  
  const showMobileSpecs = bookingFormProperty && (bookingFormProperty.maxGuests || bookingFormProperty.bedrooms);

  return (
    <>
    <section
      className="relative h-[70vh] min-h-[600px] md:h-[80vh] md:min-h-[700px] w-full flex text-white has-transparent-header slides-under-header"
      id="hero"
      data-form-position={formPosition} // Pass position data for JavaScript positioning
      data-form-size={formSize} // Pass size data for future use
      style={{ position: 'relative', overflow: 'visible' }} // Ensure relative positioning for absolute children
    >
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt={tc(title) || property.name || t('common.heroBackgroundImage')}
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="-z-10"
          data-ai-hint={dataAiHint}
          {...(backgroundImageBlur ? { placeholder: 'blur' as const, blurDataURL: backgroundImageBlur } : {})}
        />
      )}
      <div className="absolute inset-0 bg-black/40 -z-10"></div>

      {/* 
        Main container for hero content
        - Uses flex column layout (items stacked vertically)
        - Items are horizontally centered (items-center)
        - Vertical alignment starts from top (justify-start)
        - This layout works with our JS positioning in hero-helper.ts
      */}
      <div className="container mx-auto px-4 flex flex-col h-full w-full justify-start items-center py-6 md:py-12 relative" style={{ position: 'relative', overflow: 'visible' }}>
        <div className={cn("text-center mx-auto transition-opacity duration-300", !hasMounted && "opacity-0")}>
          {title && tc(title) && <h1 className="whitespace-nowrap text-2xl md:[font-size:clamp(1.75rem,5vw,3.75rem)] font-bold mb-4 drop-shadow-md">{tc(title)}</h1>}
          {subtitle && tc(subtitle) && <p className="text-lg md:text-xl mb-4 drop-shadow-sm line-clamp-2 max-w-2xl mx-auto">{tc(subtitle)}</p>}
        </div>

        {/* V2 Booking Widget for Hero Section */}
        {showBookingForm && property && (
          <div className={cn("transition-opacity duration-300", !hasMounted && "opacity-0")}
            style={{
              zIndex: 10,
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: formSize === 'large' ? '840px' : 'auto',
              maxWidth: '90%',
              minWidth: '320px'
            }}
          >
            {/* Property specs bar — sits above the booking widget, hidden on mobile */}
            {bookingFormProperty && (bookingFormProperty.maxGuests || bookingFormProperty.bedrooms) && (
              <div className="hidden md:flex justify-center mb-3">
                <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-white/90 text-base">
                  {bookingFormProperty.maxGuests && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      <span>{bookingFormProperty.maxGuests} {t('specs.guests', 'guests')}</span>
                    </span>
                  )}
                  {bookingFormProperty.bedrooms && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="flex items-center gap-1.5">
                        <BedDouble className="h-4 w-4" />
                        <span>{bookingFormProperty.bedrooms} {bookingFormProperty.bedrooms === 1 ? t('specs.bedroom', 'bedroom') : t('specs.bedrooms', 'bedrooms')}</span>
                      </span>
                    </>
                  )}
                  {bookingFormProperty.bathrooms && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="flex items-center gap-1.5">
                        <Bath className="h-4 w-4" />
                        <span>{bookingFormProperty.bathrooms} {bookingFormProperty.bathrooms === 1 ? t('specs.bathroom', 'bath') : t('specs.bathrooms', 'baths')}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            <BookingContainer
              property={property}
              position={formPosition}
              size={formSize}
              showRating={showRating}
              variant="embedded"
              className="min-w-[320px]"
            />
          </div>
        )}
      </div>
    </section>
    {/* Mobile-only specs strip below hero */}
    {showMobileSpecs && (
      <div className="flex md:hidden items-center justify-center gap-3 py-2.5 bg-muted/60 border-b text-xs text-muted-foreground">
        {bookingFormProperty.maxGuests && (
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            <span>{bookingFormProperty.maxGuests} {t('specs.guests', 'guests')}</span>
          </span>
        )}
        {bookingFormProperty.bedrooms && (
          <>
            <span className="opacity-40">&middot;</span>
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              <span>{bookingFormProperty.bedrooms} {bookingFormProperty.bedrooms === 1 ? t('specs.bedroom', 'bedroom') : t('specs.bedrooms', 'bedrooms')}</span>
            </span>
          </>
        )}
        {bookingFormProperty.bathrooms && (
          <>
            <span className="opacity-40">&middot;</span>
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              <span>{bookingFormProperty.bathrooms} {bookingFormProperty.bathrooms === 1 ? t('specs.bathroom', 'bath') : t('specs.bathrooms', 'baths')}</span>
            </span>
          </>
        )}
      </div>
    )}
    </>
  );
}