// src/components/homepage/hero-section.tsx
"use client";

import Image from 'next/image';
import { Star } from 'lucide-react';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import type { Property, CurrencyCode } from '@/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react'; // Import useEffect and useState

export interface HeroData {
  backgroundImage?: string | null;
  'data-ai-hint'?: string;
  title?: string | null;
  subtitle?: string | null;
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
}

export function HeroSection({ content }: HeroSectionProps) {
  // Ensure content exists with defaults
  if (!content) {
    console.warn("HeroSection received invalid content");
    return (
      <section className="relative h-[70vh] min-h-[500px] md:h-[80vh] md:min-h-[600px] w-full flex text-white">
        <div className="absolute inset-0 bg-black/80"></div>
        <div className="container mx-auto px-4 flex items-center justify-center">
          <h1 className="text-3xl">Welcome</h1>
        </div>
      </section>
    );
  }

  const { formatPrice, selectedCurrency, baseCurrencyForProperty, convertToSelectedCurrency, ratesLoading } = useCurrency();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Extract properties with defaults to prevent destructuring errors
  const {
    backgroundImage = null,
    title = "Welcome",
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

  const property = bookingFormProperty || {
    id: propertySlug || 'default',
    slug: propertySlug || 'default',
    name: title || 'Property',
    baseCurrency: 'EUR',
    baseRate: price || 150, // Use price from content or default
    advertisedRate: price || 150,
    advertisedRateType: "from",
    minNights: 2,
    maxNights: 14,
    maxGuests: 6
  };

  const propertyBaseCcy = baseCurrencyForProperty(property.baseCurrency || 'EUR');

  // Convert the hero's advertised price to the selected display currency
  const displayPriceAmount = price !== null && price !== undefined && !ratesLoading && hasMounted
    ? convertToSelectedCurrency(price, propertyBaseCcy)
    : price; // Fallback to base price if not mounted or rates loading

  const currencyToDisplay = !hasMounted || ratesLoading ? propertyBaseCcy : selectedCurrency;

  const formattedDisplayPrice = displayPriceAmount !== null && displayPriceAmount !== undefined
    ? formatPrice(displayPriceAmount, currencyToDisplay)
    : null;

  const rating = property.ratings?.average;
  const reviewsCount = property.ratings?.count;

  const formPositionClasses = {
    center: 'items-center justify-center',
    top: 'items-start justify-center',
    bottom: 'items-end justify-center',
    'top-left': 'items-start justify-start',
    'top-right': 'items-start justify-end',
    'bottom-left': 'items-end justify-start',
    'bottom-right': 'items-end justify-end',
  };

  const currentPositionClass = bookingForm?.position ? formPositionClasses[bookingForm.position] : formPositionClasses.bottom;

  const formWrapperClasses = cn(
    'bg-background/80 backdrop-blur-sm p-6 md:p-8 rounded-xl shadow-2xl w-full',
     bookingForm?.size === 'large' ? 'max-w-3xl' : 'max-w-md'
  );

  return (
    <section className="relative h-[70vh] min-h-[500px] md:h-[80vh] md:min-h-[600px] w-full flex text-white" id="hero">
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt={title || property.name || 'Hero background image'}
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="-z-10"
          data-ai-hint={dataAiHint}
        />
      )}
      <div className="absolute inset-0 bg-black/40 -z-10"></div>

      <div className={`container mx-auto px-4 flex flex-col h-full w-full ${currentPositionClass} py-8 md:py-12`}>
        <div className="text-center mb-8 max-w-2xl mx-auto">
          {title && <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-md">{title}</h1>}
          {subtitle && <p className="text-lg md:text-xl mb-6 drop-shadow-sm">{subtitle}</p>}
        </div>

        {showBookingForm && (
           <div className={formWrapperClasses}>
             <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
                {hasMounted && formattedDisplayPrice !== null ? (
                  <div className='text-center md:text-left'>
                    <p className="text-2xl md:text-3xl font-bold text-foreground">
                      {formattedDisplayPrice}
                      <span className="text-base font-normal text-muted-foreground">/night</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {property.advertisedRateType || "special deal / starting with"}
                    </p>
                  </div>
                ) : (
                   <div className='text-center md:text-left'>
                     <p className="text-2xl md:text-3xl font-bold text-foreground">
                       {/* Placeholder or base currency price before hydration */}
                       {property.baseRate ? formatPrice(property.baseRate, propertyBaseCcy) : "Loading price..."}
                       <span className="text-base font-normal text-muted-foreground">/night</span>
                     </p>
                      <p className="text-xs text-muted-foreground mt-1">
                       {property.advertisedRateType || "special deal / starting with"}
                     </p>
                   </div>
                )}
                {showRating && rating && reviewsCount && (
                  <div className="flex items-center gap-1 text-foreground">
                    <Star className="h-5 w-5 text-primary fill-primary" />
                    <span className="font-semibold">{rating.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">({reviewsCount} reviews)</span>
                  </div>
                )}
             </div>
            <InitialBookingForm property={property} size={bookingForm?.size || 'compressed'} />
          </div>
        )}
      </div>
    </section>
  );
}