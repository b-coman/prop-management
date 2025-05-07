// src/components/homepage/hero-section.tsx
'use client';

import Image from 'next/image';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star, Home as HomeIcon } from 'lucide-react'; 
import type { Property, CurrencyCode } from '@/types';
import type { heroSchema } from '@/lib/overridesSchemas';
import type { z } from 'zod';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext'; // Import useCurrency

type HeroData = z.infer<typeof heroSchema> & {
  ratings?: { average: number; count: number };
  bookingFormProperty: Property; 
  'data-ai-hint'?: string;
};

interface HeroSectionProps {
  heroData: HeroData;
}

export function HeroSection({ heroData }: HeroSectionProps) {
  const { convertToSelectedCurrency, formatPrice, selectedCurrency, baseCurrencyForProperty } = useCurrency();
  const {
    backgroundImage: backgroundImageUrl,
    showRating,
    showBookingForm = true,
    bookingForm,
    bookingFormProperty,
    'data-ai-hint': dataAiHint,
  } = heroData;

  const propertyBaseCurrency = baseCurrencyForProperty(bookingFormProperty.baseCurrency);
  const { advertisedRate, advertisedRateType, pricePerNight, ratings } = bookingFormProperty;
  const heroBlockSpecificPrice = heroData.price;

  const position = bookingForm?.position || 'center';
  const size = bookingForm?.size || 'large';

  const positionClasses: { [key: string]: string } = {
    center: 'justify-center items-center',
    top: 'justify-center items-start pt-20',
    bottom: 'justify-center items-end pb-10',
    'top-left': 'justify-start items-start pt-20',
    'top-right': 'justify-end items-start pt-20',
    'bottom-left': 'justify-start items-end pb-10',
    'bottom-right': 'justify-end items-end pb-10',
  };

  const cardSizeClasses = cn(
    "w-full bg-background/90 backdrop-blur-sm shadow-xl border-border",
    size === 'large' ? 'max-w-4xl p-3 md:p-4' : 'max-w-sm p-3 md:p-4'
  );

  const innerContainerClasses = cn(
    size === 'large' ? 'flex flex-col md:flex-row md:items-end md:gap-4' : 'space-y-4'
  );

  const headerClasses = cn(
    "p-0",
    size === 'large' ? 'mb-0 md:flex-grow-0 md:shrink-0' : 'mb-4 text-center'
  );

  const priceRatingContainerClasses = cn(
    "flex flex-col items-center gap-2 mb-2 flex-wrap",
    size === 'large' ? 'md:flex-row md:items-baseline' : 'justify-center' // Align items baseline for large
  );

  const contentClasses = cn(
     "p-0",
     size === 'large' ? 'md:flex-grow' : ''
  );

  const displayPrice = (price: number, baseCcy: CurrencyCode) => {
    const convertedPrice = convertToSelectedCurrency(price, baseCcy);
    return formatPrice(convertedPrice, selectedCurrency);
  };
  
  // Logic to determine which price to show
  let finalPriceToShow: string | null = null;

  if (advertisedRate) { 
    finalPriceToShow = advertisedRate; // Show as is, assuming it's pre-formatted string like "$150" or "From €120"
                                     // No conversion needed as it's already the desired display string.
  } else if (heroBlockSpecificPrice !== undefined && heroBlockSpecificPrice > 0) {
    finalPriceToShow = displayPrice(heroBlockSpecificPrice, propertyBaseCurrency);
  } else if (pricePerNight > 0) {
    finalPriceToShow = displayPrice(pricePerNight, propertyBaseCurrency);
  }


  return (
    <section className="relative h-[60vh] md:h-[75vh] w-full" id="hero">
      {backgroundImageUrl ? (
        <Image
          src={backgroundImageUrl}
          alt={`Featured image of ${bookingFormProperty.name}`}
          fill
          style={{ objectFit: 'cover' }}
          priority
          className="brightness-75"
          data-ai-hint={dataAiHint || 'property hero image'}
        />
      ) : (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <HomeIcon className="h-24 w-24 text-muted-foreground/30" />
        </div>
      )}

      {showBookingForm && (
          <div className={cn("absolute inset-0 flex p-4 md:p-8", positionClasses[position])}>
            <Card className={cardSizeClasses} id="booking">
                 <div className={innerContainerClasses}>
                    <CardHeader className={headerClasses}>
                        <div className={priceRatingContainerClasses}>
                            {finalPriceToShow && (
                              <div className="flex flex-col items-center md:items-start">
                                <Badge variant="secondary" className="text-base md:text-lg px-3 py-1">
                                  {finalPriceToShow}
                                  { !(advertisedRate && (advertisedRateType === 'starting' || advertisedRateType === 'special')) && <span className="text-xs font-normal ml-1">/night</span> }
                                </Badge>
                                {(advertisedRateType === 'starting' || advertisedRateType === 'special') && advertisedRate && (
                                    <div className="mt-[-2px] w-full text-center md:text-left">
                                        {advertisedRateType === 'starting' && (
                                        <span className="text-[10px] font-normal text-muted-foreground">starting from</span>
                                        )}
                                        {advertisedRateType === 'special' && (
                                        <span className="text-[10px] font-normal text-muted-foreground">special deal</span>
                                        )}
                                    </div>
                                )}
                              </div>
                            )}
                            

                            {showRating && ratings && ratings.count > 0 && (
                              <Badge variant="secondary" className="text-base md:text-lg px-3 py-1 flex items-center">
                                <Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" />
                                {ratings.average.toFixed(1)}
                                <span className="text-xs font-normal ml-1">({ratings.count} reviews)</span>
                              </Badge>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className={contentClasses}>
                      <InitialBookingForm property={bookingFormProperty} size={size} />
                    </CardContent>
                </div>
            </Card>
          </div>
      )}
    </section>
  );
}